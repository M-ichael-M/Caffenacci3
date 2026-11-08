from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index, PrimaryKeyConstraint

from app.core.database import Base
from app.core.types import ID


class AnalyticsDaily(Base):
    """Dzienne liczniki — jedyne dane trwałe. Brak danych osobowych.
    metric: pageviews | visits | visitors | visits_by_source | visits_by_device | event:<nazwa>"""
    __tablename__ = "analytics_daily"
    __table_args__ = (
        PrimaryKeyConstraint("cafe_id", "day", "metric", "dim"),
        Index("ix_analytics_daily_cafe_day", "cafe_id", "day"),
    )

    cafe_id = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False)
    day     = Column(String(10), nullable=False)      # YYYY-MM-DD w strefie kawiarni
    metric  = Column(String(40), nullable=False)
    dim     = Column(String(40), nullable=False, default="")
    value   = Column(Integer, nullable=False, default=0)


class AnalyticsVisitorDay(Base):
    """Skrót odwiedzającego ważny TYLKO w danym dniu (sól dobowa) — służy wyłącznie do
    deduplikacji i wykrywania wizyt. Kasowany po 2 dniach (core/jobs.py)."""
    __tablename__ = "analytics_visitor_day"
    __table_args__ = (
        PrimaryKeyConstraint("cafe_id", "day", "visitor_hash"),
        Index("ix_analytics_visitor_day_day", "day"),
    )

    cafe_id      = Column(ID, ForeignKey("cafes.id", ondelete="CASCADE"), nullable=False)
    day          = Column(String(10), nullable=False)
    visitor_hash = Column(String(32), nullable=False)
    last_seen    = Column(DateTime, nullable=False)
    pageviews    = Column(Integer, nullable=False, default=1)
