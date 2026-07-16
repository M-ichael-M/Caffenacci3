from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

MAX_NEWS_POSTS = 3
MAX_NEWS_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_NEWS_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
NEWS_IMAGE_MAX_DIMENSION = 1600
NEWS_IMAGE_JPEG_QUALITY = 82


class NewsSettingsIn(BaseModel):
    enabled: bool = False


class NewsSettingsOut(BaseModel):
    id: str
    cafe_id: str
    enabled: bool
    model_config = {"from_attributes": True}


class NewsPostOut(BaseModel):
    id: str
    title: str
    content: str
    image_url: Optional[str] = None
    created_at: datetime


class NewsPostListOut(BaseModel):
    posts: List[NewsPostOut]
    max_posts: int = MAX_NEWS_POSTS