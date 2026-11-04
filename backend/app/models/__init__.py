"""Import all ORM models so Base.metadata is complete for Alembic and tools."""
from app.models.billing import Subscription
from app.models.cafe import Cafe
from app.models.cafe_profile import (
    CafeProfile, ProfileWeeklyHours, ProfileHourException,
    ProfileSocialLink, ProfileEmployee, CafeProfileBadge,
)
from app.models.client import Client
from app.models.gallery import CafeGalleryImage
from app.models.loyalty import LoyaltySettings, LoyaltyReward, ClientLoyalty, LoyaltyTransaction
from app.models.menu import MenuSection, MenuItem
from app.models.news import NewsSettings, NewsPost
from app.models.order import OrderSettings, Order, OrderItem, OrderStatus
from app.models.reservation import (
    ReservationSettings, DayHours, CafeTable, Reservation,
    ReservationStatus, TableType,
)
from app.models.review import Review
from app.models.site import CafeSite
from app.models.slug_history import CafeSlugHistory

__all__ = [name for name in globals() if not name.startswith("_")]
