from __future__ import annotations

import threading
import time
import logging
from collections import OrderedDict
from datetime import datetime
from app.core.config import settings

from sqlalchemy import event, update
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.cafe import Cafe
from app.models.review import Review
from app.models.news import NewsPost, NewsSettings
from app.models.gallery import CafeGalleryImage
from app.models.site import CafeSite

CACHE_MAX = 500  # wpisów
log = logging.getLogger(__name__)


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

    def drop_cafe(self, cafe_id: str) -> int:
        with self._lock:
            keys = [k for k in self._data if k[0] == cafe_id]
            for k in keys:
                del self._data[k]
            return len(keys)


# Każdy proces ma własny cache, więc bez Redis invalidacja nie jest wspólna.
# Na teraz proponuję pozostać przy cache per proces z krótkim TTL; Redis warto
# dodać dopiero, gdy potrzebna będzie natychmiastowa spójność między workerami.
page_cache = _TTLCache(settings.PAGE_CACHE_TTL, CACHE_MAX)


def touch_cafe(cafe_id: str) -> None:
    """Aktualizuje datę publicznej treści używaną przez sitemapę."""
    try:
        with engine.begin() as conn:
            conn.execute(update(CafeSite).where(CafeSite.cafe_id == cafe_id)
                         .values(updated_at=datetime.utcnow()))
    except Exception:
        log.exception("touch_cafe failed: %s", cafe_id)


def invalidate_cafe(cafe_id: str, *, touch: bool = True) -> None:
    """Wołać PO db.commit() — przed commitem równoległe żądanie mogłoby
    ponownie wcisnąć do cache stare dane."""
    page_cache.drop_cafe(cafe_id)
    if touch:
        touch_cafe(cafe_id)


# ── Siatka bezpieczeństwa: automatyczne unieważnianie po commicie ──────────
# Każda zmiana obiektu z kolumną `cafe_id` (profil, galeria, opinie, newsy,
# ustawienia stron/zamówień/rezerwacji/lojalności, publikacja) albo samej
# Cafe unieważnia cache tej kawiarni po udanym commicie — bez ręcznego
# wołania w każdym routerze. Nie obejmuje tabel BEZ cafe_id (np. MenuItem,
# nagrody lojalnościowe) — tam wołamy invalidate_cafe jawnie.

_PENDING = "caffenacci_pending_cafe_ids"
_TOUCH = "caffenacci_pending_touch"
_PUBLIC = (Cafe, Review, NewsPost, NewsSettings, CafeGalleryImage, CafeSite)


@event.listens_for(Session, "before_flush")
def _collect_cafe_ids(session, flush_context, instances):
    ids = session.info.setdefault(_PENDING, set())
    touch_ids = session.info.setdefault(_TOUCH, set())
    for obj in (*session.new, *session.dirty, *session.deleted):
        cid = obj.id if isinstance(obj, Cafe) else getattr(obj, "cafe_id", None)
        if isinstance(cid, str):
            ids.add(cid)
            if isinstance(obj, _PUBLIC):
                touch_ids.add(cid)


@event.listens_for(Session, "after_commit")
def _invalidate_after_commit(session):
    for cid in session.info.pop(_PENDING, ()):
        invalidate_cafe(cid, touch=False)
    for cid in session.info.pop(_TOUCH, ()):
        touch_cafe(cid)


@event.listens_for(Session, "after_rollback")
def _drop_pending_on_rollback(session):
    session.info.pop(_PENDING, None)
    session.info.pop(_TOUCH, None)
