"""Wspólne warunki dostępu do publicznej strony kawiarni."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.billing import Subscription
from app.models.site import CafeSite


def live_cafe_ids():
    """Selectable identyfikatorów kawiarni z opublikowaną i dostępną stroną."""
    now = datetime.utcnow()
    has_access = or_(
        # Płatna subskrypcja odnawia się automatycznie, chyba że anulowano ją
        # na koniec okresu. Wtedy dostęp trwa do period_end.
        and_(Subscription.kind == "subscription", Subscription.cancel_at_period_end.is_(False)),
        Subscription.period_end > now,
    )
    return (
        select(CafeSite.cafe_id)
        .join(Subscription, Subscription.cafe_id == CafeSite.cafe_id)
        .where(CafeSite.is_published.is_(True), has_access)
    )


def is_site_live(cafe_id: str, db: Session) -> bool:
    """Czy strona jest opublikowana i kawiarnia ma aktualny dostęp."""
    return db.query(live_cafe_ids().where(CafeSite.cafe_id == cafe_id).exists()).scalar() is True
