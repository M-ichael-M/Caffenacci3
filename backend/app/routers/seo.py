from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
from datetime import date as date_cls, timedelta
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse, RedirectResponse, Response
from jinja2 import Environment
from sqlalchemy.orm import Session

from app.core import seo_listenings as listings
from app.core.config import settings
from app.core.currency import currency_exponent
from app.core.database import get_db
from app.core.images import LOGO_TIERS, logo_url as _logo_url_v, gallery_url
from app.core.page_cache import page_cache
from app.core.seo_i18 import (
    BADGE_LABELS, badge_label, badge_path, city_path, home_path, reviews_label, site_lang, ui,
)
from app.core.slugs import resolve_slug, slugify
from app.core.translations import (
    get_current_translation, get_settings as lang_settings, language_out, normalize_text,
)
from app.models.cafe import Cafe
from app.models.site import CafeSite
from app.models.cafe_profile import CafeProfile
from app.models.gallery import CafeGalleryImage
from app.routers.site import _build_public_site, PUBLIC_REVIEWS_PAGE
from app.schemas.badges import ALLOWED_BADGE_KEYS
from app.schemas.site import PublicSiteOut

log = logging.getLogger("caffenacci.seo")
router = APIRouter(tags=["seo"])

HEAD_MARKER = "<!--SEO_HEAD-->"
BODY_MARKER = "<!--SEO_BODY-->"

CACHE_CONTROL = f"public, max-age=60, s-maxage={settings.PUBLIC_CACHE_S_MAXAGE}, stale-while-revalidate=600"

DAYS_SCHEMA = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

HOME_LIST_LIMIT = 12
ROBOTS_INDEX = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
TITLE_MAX = 70
DESC_MAX = 160
LD_MAX_MENU_ITEMS = 200


# ── Szablon: zbudowany index.html klienta (przeładowywany po zmianie mtime) ─

_tpl_lock = threading.Lock()
_tpl: dict = {"mtime": None, "html": None}


def _load_index() -> tuple[str, float] | None:
    dist = settings.CUSTOMER_DIST_DIR
    if not dist:
        log.error("CUSTOMER_DIST_DIR nie jest ustawione - nie mozna wyrenderowac stron SEO.")
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


def _no_template() -> Response:
    return PlainTextResponse(
        "Błąd konfiguracji serwera: brak zbudowanego klienta (sprawdź CUSTOMER_DIST_DIR).",
        status_code=500,
    )


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
{% endif %}{% for code, href in alternates %}<link rel="alternate" hreflang="{{ code }}" href="{{ href }}">
{% endfor %}<meta property="og:type" content="website">
<meta property="og:site_name" content="{{ site_name }}">
{% if icon %}<link rel="icon" href="{{ icon }}">
{% endif %}
{% if og_locale %}<meta property="og:locale" content="{{ og_locale }}">
{% endif %}{% for loc in og_alternates %}<meta property="og:locale:alternate" content="{{ loc }}">
{% endfor %}<meta property="og:title" content="{{ title }}">
<meta property="og:description" content="{{ description }}">
{% if image %}<meta property="og:image" content="{{ image }}">
{% if image_type %}<meta property="og:image:type" content="{{ image_type }}">
{% endif %}{% if image_w and image_h %}<meta property="og:image:width" content="{{ image_w }}">
<meta property="og:image:height" content="{{ image_h }}">
{% endif %}{% if image_alt %}<meta property="og:image:alt" content="{{ image_alt }}">
{% endif %}<meta name="twitter:image" content="{{ image }}">
{% if image_alt %}<meta name="twitter:image:alt" content="{{ image_alt }}">
{% endif %}{% endif %}{% if logo_srcset %}<link rel="preload" as="image" imagesrcset="{{ logo_srcset }}" imagesizes="112px" fetchpriority="high">
{% endif %}<meta name="twitter:card" content="{{ 'summary_large_image' if image_large else 'summary' }}">
<meta name="twitter:title" content="{{ title }}">
<meta name="twitter:description" content="{{ description }}">
{% for j in jsonld_list %}<script type="application/ld+json">{{ j|safe }}</script>
{% endfor %}""")

_CAFE_BODY_TPL = _env.from_string("""\
<article class="seo-content">
<nav aria-label="breadcrumb"><ol>{% for k in c.crumbs %}<li>{% if k.href %}<a href="{{ k.href }}">{{ k.name }}</a>{% else %}{{ k.name }}{% endif %}</li>{% endfor %}</ol></nav>
<h1>{{ c.name }}</h1>
<p>{{ c.address }}</p>
{% if c.phone %}<p>{{ c.u.phone }}: {{ c.phone }}</p>{% endif %}
{% if c.email %}<p>{{ c.u.email }}: {{ c.email }}</p>{% endif %}
{% if c.description %}<p>{{ c.description }}</p>{% endif %}
{% if c.news %}<section><h2>{{ c.u.h_news }}</h2>
{% for n in c.news %}<div><h3>{{ n.title }}</h3><p>{{ n.date }}</p><p>{{ n.content }}</p></div>
{% endfor %}</section>{% endif %}
{% if c.menu %}<section><h2>{{ c.u.h_menu }}</h2>
{% for s in c.menu %}<h3>{{ s.name }}</h3><ul>
{% for i in s.dishes %}<li><strong>{{ i.name }}</strong> – {{ i.price }}{% if i.description %}. {{ i.description }}{% endif %}</li>
{% endfor %}</ul>
{% endfor %}</section>{% endif %}
{% if c.services %}<section><h2>{{ c.u.h_services }}</h2><ul>
{% for s in c.services %}<li>{{ s }}</li>
{% endfor %}</ul></section>{% endif %}
{% if c.gallery %}<section><h2>{{ c.u.h_gallery }}</h2>
{% for g in c.gallery %}<img src="{{ g.src }}" alt="{{ g.alt }}"{% if g.w and g.h %} width="{{ g.w }}" height="{{ g.h }}"{% endif %} loading="lazy">
{% endfor %}</section>{% endif %}
{% if c.amenities %}<section><h2>{{ c.u.h_amenities }}</h2><ul>
{% for a in c.amenities %}<li>{{ a }}</li>
{% endfor %}</ul></section>{% endif %}
{% if c.hours %}<section><h2>{{ c.u.h_hours }}</h2><ul>
{% for h in c.hours %}<li>{{ h.day }}: {{ h.text }}</li>
{% endfor %}</ul></section>{% endif %}
{% if c.reviews %}<section><h2>{{ c.u.h_reviews }}</h2>
{% if c.rating_line %}<p>{{ c.rating_line }}</p>{% endif %}
<ul>{% for r in c.reviews %}<li>{{ r.nick }} – {{ r.rating }}/5{% if r.comment %}: {{ r.comment }}{% endif %} ({{ r.date }})</li>
{% endfor %}</ul></section>{% endif %}
{% if c.nearby %}<section><h2>{{ c.nearby_heading }}</h2><ul>
{% for n in c.nearby %}<li><a href="{{ n.href }}">{{ n.name }}</a></li>
{% endfor %}</ul></section>{% endif %}
<p><a href="{{ c.city_href }}">{{ c.city_link }}</a></p>
</article>""")

# Wspólny szablon dla strony głównej / miasta / miasta + plakietki.
_LIST_TPL = _env.from_string("""\
<article class="seo-content">
{% if crumbs %}<nav aria-label="breadcrumb"><ol>{% for k in crumbs %}<li>{% if k.href %}<a href="{{ k.href }}">{{ k.name }}</a>{% else %}{{ k.name }}{% endif %}</li>{% endfor %}</ol></nav>
{% endif %}<h1>{{ h1 }}</h1>
{% for para in intro %}<p>{{ para }}</p>
{% endfor %}{% for s in sections %}<section><h2>{{ s.heading }}</h2><ul>
{% for i in s.links %}<li><a href="{{ i.href }}">{{ i.name }}</a>{% if i.note %} – {{ i.note }}{% endif %}</li>
{% endfor %}</ul></section>
{% endfor %}</article>""")


def _head(**kw) -> str:
    base = dict(
        robots=ROBOTS_INDEX, canonical=None, alternates=[], og_locale=None, og_alternates=[],
        image=None, image_type=None, image_w=None, image_h=None, image_alt=None,
        image_large=False, logo_srcset=None, jsonld_list=[],
        site_name="Caffenacci", icon=None,
    )
    base.update(kw)
    return _HEAD_TPL.render(**base)


# ── Adresy ──────────────────────────────────────────────────────────────────

def _abs(path: str) -> str:
    return f"{settings.PUBLIC_SITE_URL.rstrip('/')}{path}"


def _cafe_path(slug: str, lang_code: str | None = None) -> str:
    p = f"/kawiarnia/{quote(slug, safe='')}"
    return f"{p}/{quote(lang_code, safe='')}" if lang_code else p


def _public_url(slug: str, lang_code: str | None = None) -> str:
    return _abs(_cafe_path(slug, lang_code))


def _abs_api(path: str | None) -> str | None:
    return f"{settings.API_PUBLIC_URL.rstrip('/')}{path}" if path else None


def _clip(text: str | None, limit: int) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0].rstrip(",.;:–- ") + "…"


def _num(v: float, lang: str) -> str:
    s = f"{v:.1f}"
    return s.replace(".", ",") if lang in _COMMA_DECIMAL else s


def _with_w(url: str, w: int) -> str:
    return f"{url}{'&' if '?' in url else '?'}w={w}"


def _badge_keys(site: PublicSiteOut) -> list[str]:
    """Wyróżnione plakietki najpierw (sort jest stabilny)."""
    return [b.key for b in sorted(site.badges, key=lambda b: not b.featured)]


def _og_image_url(site: PublicSiteOut) -> str | None:
    """Obraz 1200×630 generowany po stronie API (galeria → logo). None = nie ma z czego."""
    first = site.gallery_images[0].url if site.gallery_images else ""
    if not (first or site.logo_url):
        return None
    v = hashlib.sha1(f"{first}|{site.logo_url or ''}".encode()).hexdigest()[:8]
    return _abs_api(f"/profile/og/{site.cafe_id}?v={v}")


# Języki z przecinkiem dziesiętnym (SEO-owy HTML nie ma Intl, więc formatujemy ręcznie).
_COMMA_DECIMAL = {"pl", "de", "fr", "es", "it", "pt", "ru", "uk", "cs", "sk", "nl", "tr", "sv",
                  "da", "no", "fi", "hu", "ro", "bg", "hr", "sl", "lt", "lv", "et", "el", "id", "vi"}
_CURRENCY_LABEL = {"PLN": "zł"}
_OG_LOCALES = {
    "pl": "pl_PL", "en": "en_GB", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "it": "it_IT",
    "pt": "pt_PT", "nl": "nl_NL", "ru": "ru_RU", "uk": "uk_UA", "cs": "cs_CZ", "sk": "sk_SK",
    "sv": "sv_SE", "da": "da_DK", "no": "nb_NO", "fi": "fi_FI", "hu": "hu_HU", "ro": "ro_RO",
    "bg": "bg_BG", "hr": "hr_HR", "el": "el_GR", "tr": "tr_TR", "ja": "ja_JP", "ko": "ko_KR",
    "zh": "zh_CN", "ar": "ar_AR", "he": "he_IL", "vi": "vi_VN", "id": "id_ID", "th": "th_TH",
}


def _fmt_price(p: float, currency: str, lang: str) -> str:
    s = f"{p:.{currency_exponent(currency)}f}"
    if lang in _COMMA_DECIMAL:
        s = s.replace(".", ",")
    return f"{s} {_CURRENCY_LABEL.get(currency, currency)}"


# ── Wstrzykiwanie do index.html ─────────────────────────────────────────────

def _inject(index_html: str, head_html: str, body_html: str, data_script: str = "",
            lang: str = "pl", direction: str = "ltr") -> str:
    html = re.sub(r"<title\b[^>]*>.*?</title>", "", index_html, count=1, flags=re.I | re.S)
    html = re.sub(r"<html\b[^>]*>", f'<html lang="{lang}" dir="{direction}">', html, count=1, flags=re.I)
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


def _etag_matches(header: str | None, etag: str) -> bool:
    if not header:
        return False
    if header.strip() == "*":
        return True
    norm = lambda t: t.strip().removeprefix("W/").strip('"')
    target = norm(etag)
    return any(norm(t) == target for t in header.split(","))


def _html_response(request: Request, key: tuple, build) -> Response:
    """Cache ciała (per proces, krótki TTL) + ETag/304. build() zwraca HTML albo None (=404)."""
    cached = page_cache.get(key)
    if cached is None:
        html = build()
        if html is None:
            return _not_found_response()
        body = html.encode("utf-8")
        etag = '"' + hashlib.sha1(body).hexdigest()[:32] + '"'
        page_cache.set(key, body, etag)
    else:
        body, etag = cached
    headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL}
    if _etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="text/html; charset=utf-8", headers=headers)


def _data_script(listing: dict | None = None, cities: list | None = None) -> str:
    parts = []
    if listing is not None:
        parts.append("window.__LISTING__=" + _safe_json(listing) + ";")
    if cities is not None:
        parts.append("window.__HOME__=" + _safe_json({"cities": cities}) + ";")
    return "<script>" + "".join(parts) + "</script>" if parts else ""


def _cities_payload(city_list: list[listings.City], limit: int = 40) -> list[dict]:
    return [{"name": c.name, "slug": c.slug, "count": c.count} for c in city_list[:limit]]


def _breadcrumb_ld(items: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name, "item": url}
            for i, (name, url) in enumerate(items, 1)
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# STRONA KAWIARNI
# ══════════════════════════════════════════════════════════════════════════════

def _localize(site: PublicSiteOut, entries: dict[str, str]) -> PublicSiteOut:
    """Lustro localizeSite.ts: tłumaczy tylko teksty kawiarni (opis, menu, aktualności)."""
    def tr(s):
        return entries.get(normalize_text(s), s) if s else s

    sections = [
        sec.model_copy(update={
            "name": tr(sec.name),
            "items": [i.model_copy(update={"name": tr(i.name), "description": tr(i.description)})
                      for i in sec.items],
        })
        for sec in site.menu_sections
    ]
    news = [p.model_copy(update={"title": tr(p.title), "content": tr(p.content)})
            for p in site.news_posts]
    return site.model_copy(update={
        "description": tr(site.description), "menu_sections": sections, "news_posts": news,
    })


def _title(site: PublicSiteOut, u: dict) -> str:
    return site.cafe_name


def _meta_description(site: PublicSiteOut, u: dict, lang: str) -> str:
    extras: list[str] = []
    if site.reviews_count:
        extras.append(u["desc_rating"].format(
            avg=_num(site.reviews_average, lang), count=reviews_label(site.reviews_count, lang)))
    labels = [badge_label(k, lang) for k in _badge_keys(site)[:3]]
    if labels:
        extras.append(u["desc_amenities"].format(list=", ".join(labels)))
    tail = " ".join(extras)
    lead = site.description or u["desc_default"].format(
        name=site.cafe_name, city=site.city, street=site.street, no=site.building_number)
    budget = max(DESC_MAX - len(tail) - 1, 70) if tail else DESC_MAX
    return _clip(f"{_clip(lead, budget)} {tail}".strip(), DESC_MAX)


def _json_ld(site: PublicSiteOut, url: str, base_url: str, lang_code: str,
             u: dict, og_url: str | None) -> dict:
    cur = site.i18n.currency if site.i18n else "PLN"
    exp = currency_exponent(cur)
    ui_code = site_lang(lang_code)
    data: dict = {
        "@context": "https://schema.org",
        "@type": "CafeOrCoffeeShop",
        "@id": f"{base_url}#cafe",
        "name": site.cafe_name,
        "url": url,
        "inLanguage": lang_code,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": f"{site.street} {site.building_number}",
            "addressLocality": site.city,
            "postalCode": site.postal_code,
            "addressCountry": site.country,
        },
        "currenciesAccepted": cur,
        "acceptsReservations": f"{url}#cp-reservations" if site.reservations_enabled else False,
    }
    images: list[str] = []
    if og_url:
        images.append(og_url)
    images += [_abs_api(_with_w(g.url, 1600)) for g in site.gallery_images]
    logo = _abs_api(site.logo_url)
    if logo:
        images.append(logo)
        data["logo"] = logo
    if images:
        data["image"] = images
    if site.contact_phone:
        data["telephone"] = site.contact_phone
    if site.contact_email:
        data["email"] = site.contact_email
    if site.latitude is not None and site.longitude is not None:
        data["geo"] = {"@type": "GeoCoordinates", "latitude": site.latitude, "longitude": site.longitude}
        if site.location_show_gmaps_link:
            data["hasMap"] = f"https://www.google.com/maps?q={site.latitude},{site.longitude}"

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

    cutoff = (date_cls.today() - timedelta(days=1)).isoformat()
    special = []
    for e in sorted(site.hour_exceptions, key=lambda x: x.date):
        if e.date < cutoff:
            continue
        ok = (not e.is_closed) and e.open_time and e.close_time
        special.append({
            "@type": "OpeningHoursSpecification", "validFrom": e.date, "validThrough": e.date,
            "opens": e.open_time if ok else "00:00", "closes": e.close_time if ok else "00:00",
        })
    if special:
        data["specialOpeningHoursSpecification"] = special

    sections, count, prices, has_vege = [], 0, [], False
    for s in site.menu_sections:
        items = []
        for i in s.items:
            if count >= LD_MAX_MENU_ITEMS:
                break
            count += 1
            item: dict = {"@type": "MenuItem", "name": i.name}
            if i.description:
                item["description"] = i.description
            item["offers"] = {
                "@type": "Offer", "price": f"{i.price:.{exp}f}", "priceCurrency": cur,
                "availability": "https://schema.org/OutOfStock" if i.is_unavailable
                                else "https://schema.org/InStock",
            }
            if i.is_vege:
                item["suitableForDiet"] = "https://schema.org/VegetarianDiet"
                has_vege = True
            if i.price > 0 and not i.is_unavailable:
                prices.append(i.price)
            items.append(item)
        if items:
            sections.append({"@type": "MenuSection", "name": s.name, "hasMenuItem": items})
    if sections:
        data["hasMenu"] = {
            "@type": "Menu", "name": u["h_menu"], "inLanguage": lang_code,
            "url": f"{url}#cp-menu", "hasMenuSection": sections,
        }
    if prices:
        data["priceRange"] = f"{min(prices):.{exp}f}-{max(prices):.{exp}f} {cur}"
    data["servesCuisine"] = ["Coffee", "Vegetarian"] if has_vege else ["Coffee"]
    keys = _badge_keys(site)
    if keys:
        data["amenityFeature"] = [
            {"@type": "LocationFeatureSpecification", "name": badge_label(k, ui_code), "value": True}
            for k in keys
        ]

    if site.reviews_count > 0:
        data["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": site.reviews_average,
            "reviewCount": site.reviews_count,
        }
    same_as = []
    same_as += [s.url for s in site.social_links if s.url.lower().startswith(("http://", "https://"))]
    if same_as:
        data["sameAs"] = list(dict.fromkeys(same_as))
    return data


def _cafe_crumbs(site: PublicSiteOut, u: dict, lang_code: str) -> list[dict]:
    crumbs = [{"name": u["crumb_home"], "href": home_path(lang_code)}]
    if site.city_slug:
        crumbs.append({"name": site.city, "href": city_path(lang_code, site.city_slug)})
    crumbs.append({"name": site.cafe_name, "href": None})
    return crumbs


def _body_context(site: PublicSiteOut, u: dict, lang_code: str) -> dict:
    cur = site.i18n.currency if site.i18n else "PLN"
    hours = []
    for h in sorted(site.weekly_hours, key=lambda x: x.day_of_week):
        if not 0 <= h.day_of_week <= 6:
            continue
        ok = h.open_time and h.close_time
        hours.append({"day": u["days"][h.day_of_week], "text": f"{h.open_time}–{h.close_time}" if ok else u["closed"]})

    menu = [
        {
            "name": s.name,
            "dishes": [
                {"name": i.name, "description": i.description, "price": _fmt_price(i.price, cur, lang_code)}
                for i in s.items
            ],
        }
        for s in site.menu_sections if s.items
    ]
    reviews = [
        {"nick": r.nick, "rating": r.rating, "comment": r.comment, "date": r.created_at.strftime("%Y-%m-%d")}
        for r in site.reviews[:PUBLIC_REVIEWS_PAGE]
    ]

    services = []
    if site.reservations_enabled:
        services.append(u["svc_reservations"])
    if site.orders_enabled:
        services.append(u["svc_orders"])
    if site.loyalty_enabled:
        services.append(u["svc_loyalty"])

    gallery = []
    for n, g in enumerate(site.gallery_images, 1):
        w = min(g.width, 960) if g.width else None
        h = round(g.height * w / g.width) if (w and g.height) else None
        gallery.append({
            "src": _abs_api(_with_w(g.url, 960)),
            "alt": u["gallery_alt"].format(name=site.cafe_name, city=site.city, n=n),
            "w": w, "h": h,
        })

    news = [
        {"title": p.title, "content": p.content, "date": p.created_at.strftime("%Y-%m-%d")}
        for p in site.news_posts
    ] if site.news_enabled else []

    return {
        "u": u,
        "crumbs": _cafe_crumbs(site, u, lang_code),
        "name": site.cafe_name,
        "address": f"{site.street} {site.building_number}, {site.postal_code} {site.city}",
        "phone": site.contact_phone,
        "email": site.contact_email,
        "description": site.description,
        "news": news,
        "services": services,
        "gallery": gallery,
        "amenities": [badge_label(k, lang_code) for k in _badge_keys(site)],
        "hours": hours,
        "menu": menu,
        "reviews": reviews,
        "rating_line": (
            u["rating_line"].format(
                avg=_num(site.reviews_average, lang_code),
                count=reviews_label(site.reviews_count, lang_code))
            if site.reviews_count else None
        ),
        "nearby_heading": u["h_nearby"].format(city=site.city),
        "nearby": [{"name": n.cafe_name, "href": _cafe_path(n.slug)} for n in site.nearby_cafes],
        "city_href": city_path(lang_code, site.city_slug) if site.city_slug else home_path(lang_code),
        "city_link": u["city_link"].format(city=site.city),
    }


def _render_cafe(index_html: str, site: PublicSiteOut, lang_code: str | None,
                 entries: dict[str, str] | None) -> str:
    i18n = site.i18n
    primary = i18n.primary if i18n else language_out("pl")
    secondary = i18n.secondary if i18n else None
    active = secondary if (lang_code and secondary) else primary
    view = _localize(site, entries) if (lang_code and entries is not None) else site

    ui_code = site_lang(active.code)
    u = ui(ui_code)
    base_url = _public_url(site.slug or "")
    url = _public_url(site.slug or "", lang_code)

    alternates: list[tuple[str, str]] = []
    og_alternates: list[str] = []
    if secondary:
        alternates = [(primary.code, base_url), (secondary.code, _public_url(site.slug or "", secondary.code)),
                      ("x-default", base_url)]
        other = primary if active is secondary else secondary
        if _OG_LOCALES.get(other.code):
            og_alternates = [_OG_LOCALES[other.code]]

    og = _og_image_url(site)
    logo = _abs_api(site.logo_url)
    crumbs = _cafe_crumbs(view, u, ui_code)
    ld = [
        _json_ld(view, url, base_url, active.code, u, og),
        _breadcrumb_ld([(c["name"], _abs(c["href"]) if c["href"] else url) for c in crumbs]),
    ]
    logo_srcset = ", ".join(f"{logo}&w={w} {w}w" for w in LOGO_TIERS) if logo else None
    head = _head(
        title=_title(view, u), description=_meta_description(view, u, ui_code), canonical=url,
        alternates=alternates, og_locale=_OG_LOCALES.get(active.code), og_alternates=og_alternates,
        image=og or logo, image_large=bool(og),
        image_type="image/jpeg" if og else None,
        image_w=1200 if og else None, image_h=630 if og else None,
        image_alt=f"{view.cafe_name} – {view.city}",
        logo_srcset=logo_srcset, jsonld_list=[_safe_json(x) for x in ld],
        site_name=site.cafe_name, icon=site.icon_url,
    )
    body = _CAFE_BODY_TPL.render(c=_body_context(view, u, ui_code))
    # Klient dostaje dane ORYGINALNE (to on tłumaczy je przez localizeSite).
    data_script = "<script>window.__SITE_DATA__=" + _safe_json(site.model_dump(mode="json")) + ";</script>"
    return _inject(index_html, head, body, data_script, lang=active.code, direction=active.dir)


# ── Endpointy: kawiarnia ────────────────────────────────────────────────────

def _not_found_response(status_code: int = 404) -> Response:
    loaded = _load_index()
    if loaded is None:
        return _no_template()
    index_html, _ = loaded
    head = _head(
        title=("Strona wycofana" if status_code == 410 else "Nie znaleziono strony") + " | Caffenacci",
        description="Ta strona nie jest dostępna.", robots="noindex",
    )
    return Response(
        content=_inject(index_html, head, ""),
        status_code=status_code,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": "public, max-age=30"},
    )


def _redirect(path: str) -> RedirectResponse:
    # Krótki max-age: 301 bywa cache'owany przez przeglądarki "na zawsze",
    # a slug może jeszcze wrócić (powrót do starej nazwy).
    return RedirectResponse(path, status_code=301, headers={"Cache-Control": "public, max-age=300"})


def _resolve_published(slug: str, db: Session) -> tuple[Cafe | None, bool]:
    """(cafe, is_current) tylko dla OPUBLIKOWANEJ kawiarni. Nieopublikowana
    => None, więc stary slug nie przekierowuje na 404 (brak łańcucha)."""
    cafe, is_current = resolve_slug(slug, db)
    if cafe is None or not cafe.slug:
        return None, False
    published = (
        db.query(CafeSite.id)
        .filter(CafeSite.cafe_id == cafe.id, CafeSite.is_published.is_(True))
        .first()
        is not None
    )
    return (cafe, is_current) if published else (None, False)


def _was_published(slug: str, db: Session) -> bool:
    cafe, _ = resolve_slug(slug, db)
    if cafe is None:
        return False
    site = db.query(CafeSite).filter(CafeSite.cafe_id == cafe.id).first()
    return bool(site and site.published_at and not site.is_published)


def _serve_cafe(slug: str, lang: str | None, request: Request, db: Session) -> Response:
    if slug != slug.lower():
        return _redirect(_cafe_path(slug.lower(), lang))
    # Publikacja sprawdzana przy każdym żądaniu — cache nie przedłuża życia wycofanej strony.
    cafe, is_current = _resolve_published(slug, db)
    if cafe is None:
        return _not_found_response(410 if _was_published(slug, db) else 404)
    if not is_current:
        return _redirect(_cafe_path(cafe.slug, lang))

    loaded = _load_index()
    if loaded is None:
        return _no_template()
    index_html, mtime = loaded

    def build() -> str | None:
        site = _build_public_site(cafe, db)
        entries = None
        if lang:
            # Wersja językowa istnieje tylko dla AKTUALNEGO tłumaczenia drugiego języka kawiarni.
            if not site.i18n or not site.i18n.secondary or site.i18n.secondary.code != lang:
                return None
            tr = get_current_translation(cafe.id, lang, db)
            if tr is None:
                return None
            entries = json.loads(tr.entries)
        return _render_cafe(index_html, site, lang, entries)

    # page_cache.drop_cafe() czyści wszystkie klucze zaczynające się od cafe.id
    return _html_response(request, (cafe.id, mtime, lang or ""), build)


@router.get("/kawiarnia", include_in_schema=False)
@router.get("/kawiarnia/", include_in_schema=False)
@router.get("/cafe", include_in_schema=False)
@router.get("/kawiarnie", include_in_schema=False)
@router.get("/kawiarnie/", include_in_schema=False)
def bare_listing_redirect():
    return _redirect("/")


@router.get("/en/cafes", include_in_schema=False)
@router.get("/en/cafes/", include_in_schema=False)
def bare_listing_redirect_en():
    return _redirect("/en/")


@router.get("/kawiarnia/{slug}", include_in_schema=False)
def cafe_page(slug: str, request: Request, db: Session = Depends(get_db)):
    return _serve_cafe(slug, None, request, db)


@router.get("/kawiarnia/{slug}/{lang}", include_in_schema=False)
def cafe_page_lang(slug: str, lang: str, request: Request, db: Session = Depends(get_db)):
    return _serve_cafe(slug, lang, request, db)


@router.get("/cafe/{slug}", include_in_schema=False)
def legacy_cafe_redirect(slug: str, db: Session = Depends(get_db)):
    # Jeden skok: /cafe/{dowolny-slug} -> /kawiarnia/{AKTUALNY-slug} (bez 301->301).
    cafe, _ = _resolve_published(slug, db)
    if cafe is None:
        return _not_found_response()
    return _redirect(_cafe_path(cafe.slug))


# ══════════════════════════════════════════════════════════════════════════════
# STRONA GŁÓWNA
# ══════════════════════════════════════════════════════════════════════════════

def _home_alternates() -> list[tuple[str, str]]:
    return [("pl", _abs("/")), ("en", _abs("/en/")), ("x-default", _abs("/"))]


def _build_home(index_html: str, db: Session, lang: str) -> str:
    rows = listings.load_cafes(db)
    city_list = listings.cities(rows)
    u = ui(lang)

    sections = []
    if city_list:
        sections.append({
            "heading": u["h_cities"],
            "links": [{"href": city_path(lang, c.slug), "name": c.name, "note": c.country}
                      for c in city_list[:40]],
        })
    top = sorted(rows, key=lambda r: (-r.reviews, r.name.lower()))[:HOME_LIST_LIMIT]
    if top:
        sections.append({
            "heading": u["h_popular"],
            "links": [{"href": _cafe_path(r.slug), "name": r.name,
                       "note": f"{r.street} {r.building_number}, {r.city}"} for r in top],
        })

    canonical = _abs(home_path(lang))
    ld = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": "Caffenacci",
         "alternateName": ["Caffenacci cafe finder", "Caffenacci wyszukiwarka kawiarni"],
         "url": _abs("/"), "inLanguage": lang},
        {"@context": "https://schema.org", "@type": "Organization", "name": "Caffenacci", "url": _abs("/")},
    ]
    head = _head(
        title=u["home_title"], description=u["home_desc"], canonical=canonical,
        alternates=_home_alternates(), og_locale=_OG_LOCALES[lang],
        og_alternates=[_OG_LOCALES["en" if lang == "pl" else "pl"]],
        jsonld_list=[_safe_json(x) for x in ld],
    )
    body = _LIST_TPL.render(crumbs=None, h1=u["home_h1"], intro=u["home_intro"], sections=sections)
    return _inject(index_html, head, body, _data_script(cities=_cities_payload(city_list)), lang=lang)


def _serve_home(request: Request, db: Session, lang: str) -> Response:
    loaded = _load_index()
    if loaded is None:
        return _no_template()
    index_html, mtime = loaded
    return _html_response(request, ("__home__", mtime, lang), lambda: _build_home(index_html, db, lang))


@router.get("/", include_in_schema=False)
def home_pl(request: Request, db: Session = Depends(get_db)):
    return _serve_home(request, db, "pl")


@router.get("/en", include_in_schema=False)
@router.get("/en/", include_in_schema=False)
def home_en(request: Request, db: Session = Depends(get_db)):
    return _serve_home(request, db, "en")


# ══════════════════════════════════════════════════════════════════════════════
# MIASTA I PLAKIETKI  (programmatic SEO: "kawiarnie Kraków", "kawiarnie Kraków wifi")
# ══════════════════════════════════════════════════════════════════════════════

def _listing_alternates(city_slug: str, badge_key: str | None) -> list[tuple[str, str]]:
    def path(lang: str) -> str:
        return badge_path(lang, city_slug, badge_key) if badge_key else city_path(lang, city_slug)
    return [("pl", _abs(path("pl"))), ("en", _abs(path("en"))), ("x-default", _abs(path("pl")))]


def _build_city(index_html: str, db: Session, lang: str, city_slug: str, badge_key: str | None) -> str | None:
    all_rows = listings.load_cafes(db)
    city_rows = listings.city_cafes(all_rows, city_slug)
    if len(city_rows) < listings.MIN_CITY_CAFES:
        return None
    shown = [r for r in city_rows if badge_key in r.badges] if badge_key else city_rows
    if badge_key and len(shown) < listings.MIN_BADGE_CAFES:
        return None

    u = ui(lang)
    city = listings.city_name(city_rows)
    country = city_rows[0].country
    city_list = listings.cities(all_rows)
    counts = listings.badge_counts(city_rows)
    eligible = [k for k in BADGE_LABELS if counts.get(k, 0) >= listings.MIN_BADGE_CAFES]
    blabel = badge_label(badge_key, lang) if badge_key else None

    if badge_key:
        title = u["badge_title"].format(city=city, badge=blabel)
        description = u["badge_desc"].format(city=city, badge=blabel)
        h1 = u["badge_h1"].format(city=city, badge=blabel)
        intro = [u["badge_intro"].format(city=city, badge=blabel), u["count_line"].format(count=len(shown))]
    else:
        title = u["city_title"].format(city=city)
        description = u["city_desc"].format(city=city)
        h1 = u["city_h1"].format(city=city)
        intro = [u["city_intro"].format(city=city), u["count_line"].format(count=len(shown))]

    sections = []
    if badge_key:
        sections.append({"heading": city, "links": [
            {"href": city_path(lang, city_slug), "name": u["city_link"].format(city=city), "note": None}]})
    else:
        if eligible:
            sections.append({"heading": u["h_filters"], "links": [
                {"href": badge_path(lang, city_slug, k), "name": badge_label(k, lang), "note": str(counts[k])}
                for k in eligible]})
    # Lista kawiarni (po sekcji filtrów, żeby nagłówek "Lista kawiarni" nie dublował się dla plakietki)
    sections.append({"heading": u["h_cafes"], "links": [
        {"href": _cafe_path(r.slug), "name": r.name,
         "note": f"{r.street} {r.building_number}" + (f" · {r.rating}/5" if r.rating else "")}
        for r in shown]})
    if badge_key:
        others = [k for k in eligible if k != badge_key]
        if others:
            sections.append({"heading": u["h_other_badges"], "links": [
                {"href": badge_path(lang, city_slug, k), "name": badge_label(k, lang), "note": str(counts[k])}
                for k in others]})
    other_cities = [c for c in city_list if c.slug != city_slug][:HOME_LIST_LIMIT]
    if other_cities:
        sections.append({"heading": u["h_other_cities"], "links": [
            {"href": city_path(lang, c.slug), "name": c.name, "note": c.country} for c in other_cities]})

    canonical_path = badge_path(lang, city_slug, badge_key) if badge_key else city_path(lang, city_slug)
    canonical = _abs(canonical_path)
    crumbs = [{"name": u["crumb_home"], "href": home_path(lang)},
              {"name": city, "href": city_path(lang, city_slug) if badge_key else None}]
    if badge_key:
        crumbs.append({"name": blabel, "href": None})

    ld = [
        {"@context": "https://schema.org", "@type": "ItemList", "name": h1,
         "itemListElement": [
             {"@type": "ListItem", "position": i, "name": r.name, "url": _public_url(r.slug)}
             for i, r in enumerate(shown, 1)]},
        _breadcrumb_ld([(c["name"], _abs(c["href"]) if c["href"] else canonical) for c in crumbs]),
    ]
    head = _head(
        title=title, description=description, canonical=canonical,
        alternates=_listing_alternates(city_slug, badge_key), og_locale=_OG_LOCALES[lang],
        og_alternates=[_OG_LOCALES["en" if lang == "pl" else "pl"]],
        jsonld_list=[_safe_json(x) for x in ld],
    )
    body = _LIST_TPL.render(crumbs=crumbs, h1=h1, intro=intro, sections=sections)
    script = _data_script(
        listing={"city": city, "country": country, "badge": badge_key},
        cities=_cities_payload(city_list),
    )
    return _inject(index_html, head, body, script, lang=lang)


def _serve_city(request: Request, db: Session, lang: str, city: str, badge: str | None) -> Response:
    norm_city = slugify(city)
    if norm_city != city:      # np. /kawiarnie/Kraków -> /kawiarnie/krakow
        target = badge_path(lang, norm_city, badge.replace("-", "_")) if badge else city_path(lang, norm_city)
        return _redirect(quote(target, safe="/-")) if norm_city else _not_found_response()

    badge_key = None
    if badge:
        badge_key = badge.replace("-", "_")
        if badge_key not in ALLOWED_BADGE_KEYS or badge != badge_key.replace("_", "-"):
            return _not_found_response()

    loaded = _load_index()
    if loaded is None:
        return _no_template()
    index_html, mtime = loaded
    key = ("__listing__", mtime, lang, city, badge or "")
    return _html_response(request, key, lambda: _build_city(index_html, db, lang, city, badge_key))


@router.get("/kawiarnie/{city}", include_in_schema=False)
def city_pl(city: str, request: Request, db: Session = Depends(get_db)):
    return _serve_city(request, db, "pl", city, None)


@router.get("/kawiarnie/{city}/{badge}", include_in_schema=False)
def city_badge_pl(city: str, badge: str, request: Request, db: Session = Depends(get_db)):
    return _serve_city(request, db, "pl", city, badge)


@router.get("/en/cafes/{city}", include_in_schema=False)
def city_en(city: str, request: Request, db: Session = Depends(get_db)):
    return _serve_city(request, db, "en", city, None)


@router.get("/en/cafes/{city}/{badge}", include_in_schema=False)
def city_badge_en(city: str, badge: str, request: Request, db: Session = Depends(get_db)):
    return _serve_city(request, db, "en", city, badge)


# ══════════════════════════════════════════════════════════════════════════════
# SITEMAP + ROBOTS
# ══════════════════════════════════════════════════════════════════════════════

_sm_lock = threading.Lock()
_sm: dict = {"at": 0.0, "xml": None}
SITEMAP_TTL = 600.0     # budowa sprawdza aktualność tłumaczeń każdej kawiarni — nie robimy tego na każde żądanie


def _sm_entries(alts: list[tuple[str, str]], lastmod: str | None = None, images=()) -> list[str]:
    """Każdy wariant językowy to osobny <url> z kompletem xhtml:link (wymóg Google)."""
    lm = f"<lastmod>{lastmod}</lastmod>" if lastmod else ""
    imgs = "".join(
        f"<image:image><image:loc>{xml_escape(u)}</image:loc></image:image>" for u in images
    )
    links = ""
    if len(alts) > 1:
        links = "".join(
            f'<xhtml:link rel="alternate" hreflang="{xml_escape(c)}" href="{xml_escape(h)}"/>' for c, h in alts
        ) + f'<xhtml:link rel="alternate" hreflang="x-default" href="{xml_escape(alts[0][1])}"/>'
    return [f"<url><loc>{xml_escape(h)}</loc>{lm}{links}{imgs}</url>" for _, h in alts]


def _sitemap_images(db: Session, cafe_ids: list[str]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {cid: [] for cid in cafe_ids}
    if not cafe_ids:
        return out
    for cid, logo in (db.query(CafeProfile.cafe_id, CafeProfile.logo_path)
                      .filter(CafeProfile.cafe_id.in_(cafe_ids), CafeProfile.logo_path.isnot(None))):
        out[cid].append(_abs_api(f"{_logo_url_v(cid, logo)}&w={LOGO_TIERS[-1]}"))
    q = (db.query(CafeGalleryImage.cafe_id, CafeGalleryImage.id, CafeGalleryImage.image_path)
         .join(CafeProfile, CafeProfile.cafe_id == CafeGalleryImage.cafe_id)
         .filter(CafeProfile.gallery_visible.is_(True), CafeGalleryImage.cafe_id.in_(cafe_ids))
         .order_by(CafeGalleryImage.cafe_id, CafeGalleryImage.position))
    for cid, iid, path in q:
        out[cid].append(_abs_api(f"{gallery_url(cid, iid, path)}&w=1600"))
    return out


def _build_sitemap(db: Session) -> str:
    rows = listings.load_cafes(db)
    cafe_rows = (
        db.query(Cafe.id, Cafe.slug, CafeSite.published_at, CafeSite.updated_at)
        .join(CafeSite, CafeSite.cafe_id == Cafe.id)
        .filter(CafeSite.is_published.is_(True), Cafe.slug.isnot(None))
        .order_by(Cafe.slug).all()
    )
    lm: dict[str, str | None] = {}
    for _, slug, pub, upd in cafe_rows:
        d = max((x for x in (upd, pub) if x), default=None)
        lm[slug] = d.strftime("%Y-%m-%d") if d else None

    def newest(slugs):
        vals = [lm[s] for s in slugs if lm.get(s)]
        return max(vals) if vals else None

    entries: list[str] = []
    entries += _sm_entries([("pl", _abs("/")), ("en", _abs("/en/"))], newest(lm))
    for city in listings.cities(rows):
        if city.count < listings.MIN_CITY_CAFES:
            continue
        city_rows = listings.city_cafes(rows, city.slug)
        entries += _sm_entries([("pl", _abs(city_path("pl", city.slug))), ("en", _abs(city_path("en", city.slug)))],
                               newest(r.slug for r in city_rows))
        counts = listings.badge_counts(city_rows)
        for key in BADGE_LABELS:
            if counts.get(key, 0) >= listings.MIN_BADGE_CAFES:
                entries += _sm_entries([
                    ("pl", _abs(badge_path("pl", city.slug, key))),
                    ("en", _abs(badge_path("en", city.slug, key))),
                ], newest(r.slug for r in city_rows if key in r.badges))

    images = _sitemap_images(db, [c[0] for c in cafe_rows])
    for cafe_id, slug, _, _ in cafe_rows:
        s = lang_settings(cafe_id, db)
        alts = [(s.primary_language, _public_url(slug))]
        if s.secondary_language and get_current_translation(cafe_id, s.secondary_language, db):
            alts.append((s.secondary_language, _public_url(slug, s.secondary_language)))
        entries += _sm_entries(alts, lm[slug], images.get(cafe_id, ()))

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml" '
        'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "\n".join(entries) + "\n</urlset>"
    )


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(db: Session = Depends(get_db)):
    with _sm_lock:
        fresh = _sm["xml"] is not None and time.monotonic() - _sm["at"] < SITEMAP_TTL
        xml = _sm["xml"] if fresh else None
    if xml is None:
        xml = _build_sitemap(db)
        with _sm_lock:
            _sm["xml"], _sm["at"] = xml, time.monotonic()
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=300"})


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
