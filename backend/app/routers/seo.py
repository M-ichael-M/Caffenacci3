from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse, RedirectResponse, Response
from jinja2 import Environment
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.cafe import Cafe
from app.models.site import CafeSite
from app.routers.site import _build_public_site
from app.schemas.site import PublicSiteOut

log = logging.getLogger("caffenacci.seo")
router = APIRouter(tags=["seo"])

HEAD_MARKER = "<!--SEO_HEAD-->"
BODY_MARKER = "<!--SEO_BODY-->"

CACHE_TTL = 60          # sekundy
CACHE_MAX = 500         # wpisów
CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600"

DAYS_PL = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"]
DAYS_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Cache in-memory (TTL + limit, thread-safe) ──────────────────────────────

class _TTLCache:
    def __init__(self, ttl: float, maxsize: int):
        self._ttl = ttl
        self._max = maxsize
        self._data: OrderedDict[tuple, tuple[float, bytes, str]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple) -> tuple[bytes, str] | None:
        now = time.monotonic()
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            expires, body, etag = item
            if expires <= now:
                del self._data[key]
                return None
            self._data.move_to_end(key)
            return body, etag

    def set(self, key: tuple, body: bytes, etag: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._data[key] = (now + self._ttl, body, etag)
            self._data.move_to_end(key)
            if len(self._data) > self._max:
                for k in [k for k, v in self._data.items() if v[0] <= now]:
                    del self._data[k]
                while len(self._data) > self._max:
                    self._data.popitem(last=False)


_cache = _TTLCache(CACHE_TTL, CACHE_MAX)


# ── Szablon: zbudowany index.html klienta (przeładowywany po zmianie mtime) ─

_tpl_lock = threading.Lock()
_tpl: dict = {"mtime": None, "html": None}


def _load_index() -> tuple[str, float] | None:
    dist = settings.CUSTOMER_DIST_DIR
    if not dist:
        log.error("CUSTOMER_DIST_DIR nie jest ustawione - nie mozna wyrenderowac /kawiarnia/{slug}.")
        return None
    path = Path(dist) / "index.html"
    try:
        mtime = path.stat().st_mtime
        with _tpl_lock:
            if _tpl["mtime"] != mtime:
                _tpl["html"] = path.read_text(encoding="utf-8")
                _tpl["mtime"] = mtime
            return _tpl["html"], mtime
    except OSError as e:
        log.error("Nie mozna odczytac %s: %s (zbuduj klienta: npm run build)", path, e)
        return None


# ── Bezpieczna serializacja JSON do <script> ────────────────────────────────

_JS_ESC = {
    "<": "\\u003c", ">": "\\u003e", "&": "\\u0026",
    "\u2028": "\\u2028", "\u2029": "\\u2029",
}


def _safe_json(obj) -> str:
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return re.sub(r"[<>&\u2028\u2029]", lambda m: _JS_ESC[m.group()], s)


# ── Szablony Jinja2 (autoescape włączony) tylko dla fragmentów ──────────────
# Sam index.html NIE przechodzi przez Jinję (zbudowany JS mógłby zawierać {{ }}).

_env = Environment(autoescape=True)

_HEAD_TPL = _env.from_string("""\
<title>{{ title }}</title>
<meta name="description" content="{{ description }}">
<meta name="robots" content="{{ robots }}">
{% if canonical %}<link rel="canonical" href="{{ canonical }}">
<meta property="og:url" content="{{ canonical }}">
{% endif %}<meta property="og:type" content="website">
<meta property="og:site_name" content="Caffenacci">
<meta property="og:locale" content="pl_PL">
<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ description }}">
{% if image %}<meta property="og:image" content="{{ image }}">
{% endif %}<meta name="twitter:card" content="summary">
{% if jsonld %}<script type="application/ld+json">{{ jsonld|safe }}</script>
{% endif %}""")

_BODY_TPL = _env.from_string("""\
<article class="seo-content">
<h1>{{ c.name }}</h1>
<p>{{ c.address }}</p>
{% if c.phone %}<p>Telefon: {{ c.phone }}</p>{% endif %}
{% if c.email %}<p>E-mail: {{ c.email }}</p>{% endif %}
{% if c.description %}<p>{{ c.description }}</p>{% endif %}
{% if c.hours %}<section><h2>Godziny otwarcia</h2><ul>
{% for h in c.hours %}<li>{{ h.day }}: {{ h.text }}</li>
{% endfor %}</ul></section>{% endif %}
{% if c.menu %}<section><h2>Menu</h2>
{% for s in c.menu %}<h3>{{ s.name }}</h3><ul>
{% for i in s.dishes %}<li><strong>{{ i.name }}</strong> – {{ i.price }}{% if i.description %}. {{ i.description }}{% endif %}</li>
{% endfor %}</ul>
{% endfor %}</section>{% endif %}
{% if c.reviews %}<section><h2>Opinie gości</h2>
{% if c.rating_line %}<p>{{ c.rating_line }}</p>{% endif %}
<ul>{% for r in c.reviews %}<li>{{ r.nick }} – {{ r.rating }}/5{% if r.comment %}: {{ r.comment }}{% endif %} ({{ r.date }})</li>
{% endfor %}</ul></section>{% endif %}
</article>""")


# ── Budowanie fragmentów ────────────────────────────────────────────────────

def _public_url(slug: str) -> str:
    return f"{settings.PUBLIC_SITE_URL.rstrip('/')}/kawiarnia/{quote(slug, safe='')}"


def _abs_api(path: str | None) -> str | None:
    return f"{settings.API_PUBLIC_URL.rstrip('/')}{path}" if path else None


def _fmt_price(p: float) -> str:
    return f"{p:.2f}".replace(".", ",") + " zł"


def _title(site: PublicSiteOut) -> str:
    return f"{site.cafe_name} – kawiarnia {site.city}, {site.street} {site.building_number} | Caffenacci"


def _meta_description(site: PublicSiteOut) -> str:
    if site.description:
        text = re.sub(r"\s+", " ", site.description).strip()
        if len(text) > 160:
            text = text[:157].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
        return text
    return (
        f"{site.cafe_name} – kawiarnia w {site.city}, {site.street} {site.building_number}. "
        f"Menu, godziny otwarcia i opinie gości."
    )


def _json_ld(site: PublicSiteOut, url: str) -> dict:
    data: dict = {
        "@context": "https://schema.org",
        "@type": "CafeOrCoffeeShop",
        "name": site.cafe_name,
        "url": url,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": f"{site.street} {site.building_number}",
            "addressLocality": site.city,
            "postalCode": site.postal_code,
            "addressCountry": site.country,
        },
    }
    logo = _abs_api(site.logo_url)
    if logo:
        data["image"] = logo
        data["logo"] = logo
    if site.contact_phone:
        data["telephone"] = site.contact_phone
    if site.contact_email:
        data["email"] = site.contact_email
    if site.latitude is not None and site.longitude is not None:
        data["geo"] = {"@type": "GeoCoordinates", "latitude": site.latitude, "longitude": site.longitude}

    specs = []
    for h in sorted(site.weekly_hours, key=lambda x: x.day_of_week):
        if h.open_time and h.close_time and 0 <= h.day_of_week <= 6:
            specs.append({
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": f"https://schema.org/{DAYS_SCHEMA[h.day_of_week]}",
                "opens": h.open_time,
                "closes": h.close_time,
            })
    if specs:
        data["openingHoursSpecification"] = specs

    if site.reviews_count > 0:
        data["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": site.reviews_average,
            "reviewCount": site.reviews_count,
        }
    same_as = [s.url for s in site.social_links if s.url.lower().startswith(("http://", "https://"))]
    if same_as:
        data["sameAs"] = same_as
    return data


def _body_context(site: PublicSiteOut) -> dict:
    hours = []
    for h in sorted(site.weekly_hours, key=lambda x: x.day_of_week):
        if not 0 <= h.day_of_week <= 6:
            continue
        ok = h.open_time and h.close_time
        hours.append({"day": DAYS_PL[h.day_of_week], "text": f"{h.open_time}–{h.close_time}" if ok else "Zamknięte"})

    menu = [
        {
            "name": s.name,
            "dishes": [
                {"name": i.name, "description": i.description, "price": _fmt_price(i.price)}
                for i in s.items
            ],
        }
        for s in site.menu_sections if s.items
    ]
    reviews = [
        {"nick": r.nick, "rating": r.rating, "comment": r.comment, "date": r.created_at.strftime("%Y-%m-%d")}
        for r in site.reviews[:10]
    ]
    return {
        "name": site.cafe_name,
        "address": f"{site.street} {site.building_number}, {site.postal_code} {site.city}",
        "phone": site.contact_phone,
        "email": site.contact_email,
        "description": site.description,
        "hours": hours,
        "menu": menu,
        "reviews": reviews,
        "rating_line": (
            f"Średnia ocena {site.reviews_average:.1f}/5 ({site.reviews_count})"
            if site.reviews_count else None
        ),
    }


def _inject(index_html: str, head_html: str, body_html: str, data_script: str = "") -> str:
    html = re.sub(r"<title\b[^>]*>.*?</title>", "", index_html, count=1, flags=re.I | re.S)
    # str.replace (nie re.sub) - fragmenty zawierają \u003c, których regex by nie zniósł.
    if HEAD_MARKER in html:
        html = html.replace(HEAD_MARKER, head_html, 1)
    else:
        html = html.replace("</head>", head_html + "</head>", 1)
    html = html.replace("</head>", data_script + "</head>", 1)
    if BODY_MARKER in html:
        html = html.replace(BODY_MARKER, body_html, 1)
    else:
        html = html.replace('<div id="root"></div>', f'<div id="root">{body_html}</div>', 1)
    return html


def _render(index_html: str, site: PublicSiteOut) -> str:
    url = _public_url(site.slug or "")
    head = _HEAD_TPL.render(
        title=_title(site),
        description=_meta_description(site),
        robots="index,follow",
        canonical=url,
        image=_abs_api(site.logo_url),
        jsonld=_safe_json(_json_ld(site, url)),
    )
    body = _BODY_TPL.render(c=_body_context(site))
    data_script = "<script>window.__SITE_DATA__=" + _safe_json(site.model_dump(mode="json")) + ";</script>"
    return _inject(index_html, head, body, data_script)


def _etag_matches(header: str | None, etag: str) -> bool:
    if not header:
        return False
    if header.strip() == "*":
        return True
    norm = lambda t: t.strip().removeprefix("W/").strip('"')
    target = norm(etag)
    return any(norm(t) == target for t in header.split(","))


# ── Endpointy ───────────────────────────────────────────────────────────────

@router.get("/kawiarnia/{slug}", include_in_schema=False)
def cafe_page(slug: str, request: Request, db: Session = Depends(get_db)):
    loaded = _load_index()
    if loaded is None:
        return PlainTextResponse(
            "Błąd konfiguracji serwera: brak zbudowanego klienta (sprawdź CUSTOMER_DIST_DIR).",
            status_code=500,
        )
    index_html, mtime = loaded

    # Publikacja sprawdzana przy każdym żądaniu (lekkie zapytanie) - cache
    # nigdy nie przedłuża życia wycofanej strony.
    cafe = (
        db.query(Cafe)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .filter(Cafe.slug == slug, CafeSite.is_published.is_(True))
        .first()
    )
    if cafe is None:
        head = _HEAD_TPL.render(
            title="Nie znaleziono kawiarni | Caffenacci",
            description="Ta strona nie jest dostępna.",
            robots="noindex",
            canonical=None, image=None, jsonld=None,
        )
        return Response(
            content=_inject(index_html, head, ""),
            status_code=404,
            media_type="text/html; charset=utf-8",
            headers={"Cache-Control": "no-cache"},
        )

    key = (slug, mtime)
    cached = _cache.get(key)
    if cached is None:
        site = _build_public_site(cafe, db)
        body = _render(index_html, site).encode("utf-8")
        etag = '"' + hashlib.sha1(body).hexdigest()[:32] + '"'
        _cache.set(key, body, etag)
    else:
        body, etag = cached

    headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL}
    if _etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="text/html; charset=utf-8", headers=headers)


@router.get("/cafe/{slug}", include_in_schema=False)
def legacy_cafe_redirect(slug: str):
    return RedirectResponse(f"/kawiarnia/{quote(slug, safe='')}", status_code=301)


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    rows = (
        db.query(Cafe.slug, CafeSite.published_at, CafeSite.updated_at)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .filter(CafeSite.is_published.is_(True), Cafe.slug.isnot(None))
        .order_by(Cafe.slug)
        .all()
    )
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
             f"<url><loc>{xml_escape(base + '/')}</loc></url>"]
    for slug, published_at, updated_at in rows:
        dates = [d for d in (updated_at, published_at) if d]
        lastmod = f"<lastmod>{max(dates).strftime('%Y-%m-%d')}</lastmod>" if dates else ""
        loc = xml_escape(f"{base}/kawiarnia/{quote(slug, safe='')}")
        parts.append(f"<url><loc>{loc}</loc>{lastmod}</url>")
    parts.append("</urlset>")
    return Response(
        content="\n".join(parts),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/robots.txt", include_in_schema=False)
def robots():
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    txt = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /preview/\n"
        "Disallow: /konto\n"
        "\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return PlainTextResponse(txt, headers={"Cache-Control": "public, max-age=3600"})