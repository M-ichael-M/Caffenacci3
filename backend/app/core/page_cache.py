from __future__ import annotations

import threading
import time
from collections import OrderedDict

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.cafe import Cafe

CACHE_TTL = 60   # sekundy
CACHE_MAX = 500  # wpisów


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


page_cache = _TTLCache(CACHE_TTL, CACHE_MAX)


def invalidate_cafe(cafe_id: str) -> None:
    """Wołać PO db.commit() — przed commitem równoległe żądanie mogłoby
    ponownie wcisnąć do cache stare dane."""
    page_cache.drop_cafe(cafe_id)


# ── Siatka bezpieczeństwa: automatyczne unieważnianie po commicie ──────────
# Każda zmiana obiektu z kolumną `cafe_id` (profil, galeria, opinie, newsy,
# ustawienia stron/zamówień/rezerwacji/lojalności, publikacja) albo samej
# Cafe unieważnia cache tej kawiarni po udanym commicie — bez ręcznego
# wołania w każdym routerze. Nie obejmuje tabel BEZ cafe_id (np. MenuItem,
# nagrody lojalnościowe) — tam wołamy invalidate_cafe jawnie.

_PENDING = "caffenacci_pending_cafe_ids"


@event.listens_for(Session, "before_flush")
def _collect_cafe_ids(session, flush_context, instances):
    ids = session.info.setdefault(_PENDING, set())
    for obj in (*session.new, *session.dirty, *session.deleted):
        cid = obj.id if isinstance(obj, Cafe) else getattr(obj, "cafe_id", None)
        if isinstance(cid, str):
            ids.add(cid)


@event.listens_for(Session, "after_commit")
def _invalidate_after_commit(session):
    for cid in session.info.pop(_PENDING, ()):
        invalidate_cafe(cid)


@event.listens_for(Session, "after_rollback")
def _drop_pending_on_rollback(session):
    session.info.pop(_PENDING, None)