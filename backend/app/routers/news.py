from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.page_cache import invalidate_cafe
from app.core.images import (
    GALLERY_TIERS, save_image_variants_async, delete_image_files,
    image_response, news_image_url,
)
from app.models.cafe import Cafe
from app.models.news import NewsSettings, NewsPost
from app.schemas.news import (
    NewsSettingsIn, NewsSettingsOut, NewsPostOut, NewsPostListOut,
    MAX_NEWS_POSTS, MAX_NEWS_IMAGE_BYTES, ALLOWED_NEWS_IMAGE_CONTENT_TYPES,
)

router = APIRouter(prefix="/news", tags=["news"])
bearer_scheme = HTTPBearer()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "news")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_current_cafe(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Cafe:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    cafe = db.query(Cafe).filter(Cafe.id == payload.get("sub")).first()
    if not cafe:
        raise HTTPException(status_code=404, detail="Kawiarnia nie znaleziona.")
    return cafe


def _get_or_create_settings(cafe_id: str, db: Session) -> NewsSettings:
    s = db.query(NewsSettings).filter(NewsSettings.cafe_id == cafe_id).first()
    if not s:
        s = NewsSettings(cafe_id=cafe_id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _image_url(cafe_id: str, post: NewsPost) -> str | None:
    return news_image_url(cafe_id, post.id, post.image_path)


def _post_to_out(cafe_id: str, post: NewsPost) -> NewsPostOut:
    return NewsPostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        image_url=_image_url(cafe_id, post),
        image_width=post.image_width,
        image_height=post.image_height,
        created_at=post.created_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# USTAWIENIA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/settings", response_model=NewsSettingsOut, summary="Pobierz ustawienia aktualności")
def get_settings(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    return _get_or_create_settings(current_cafe.id, db)


@router.put("/settings", response_model=NewsSettingsOut, summary="Włącz / wyłącz sekcję aktualności")
def save_settings(
    payload:      NewsSettingsIn,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    s = _get_or_create_settings(current_cafe.id, db)
    s.enabled = payload.enabled
    db.commit()
    db.refresh(s)
    invalidate_cafe(current_cafe.id)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# LISTA (właściciel)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=NewsPostListOut, summary="Pobierz własne aktualności")
def list_news(
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    rows = (
        db.query(NewsPost)
        .filter(NewsPost.cafe_id == current_cafe.id)
        .order_by(NewsPost.created_at.desc())
        .all()
    )
    return NewsPostListOut(posts=[_post_to_out(current_cafe.id, p) for p in rows])


# ══════════════════════════════════════════════════════════════════════════════
# DODAWANIE (multipart: title, content, opcjonalny plik)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=NewsPostOut, status_code=status.HTTP_201_CREATED,
             summary="Dodaj nową aktualność")
async def create_news(
    title:        str = Form(...),
    content:      str = Form(...),
    file:         UploadFile | None = File(None),
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    existing_count = db.query(NewsPost).filter(NewsPost.cafe_id == current_cafe.id).count()
    if existing_count >= MAX_NEWS_POSTS:
        raise HTTPException(
            400,
            detail=f"Można mieć maksymalnie {MAX_NEWS_POSTS} aktualności jednocześnie. Usuń jedną, aby dodać nową.",
        )

    title = title.strip()
    content = content.strip()
    if len(title) < 2 or len(title) > 200:
        raise HTTPException(400, detail="Tytuł musi mieć od 2 do 200 znaków.")
    if len(content) < 2 or len(content) > 5000:
        raise HTTPException(400, detail="Treść musi mieć od 2 do 5000 znaków.")

    image_path = image_w = image_h = None
    if file is not None and file.filename:
        if file.content_type not in ALLOWED_NEWS_IMAGE_CONTENT_TYPES:
            raise HTTPException(400, detail="Dozwolone formaty grafiki: PNG, JPEG, WEBP.")
        raw = await file.read()
        if len(raw) > MAX_NEWS_IMAGE_BYTES:
            raise HTTPException(400, detail="Plik jest za duży. Maksymalny rozmiar to 10 MB.")
        base  = f"{current_cafe.id}_{uuid.uuid4().hex[:10]}"
        saved = await save_image_variants_async(raw, base, UPLOAD_DIR, GALLERY_TIERS)
        image_path, image_w, image_h = base, saved.width, saved.height

    post = NewsPost(
        cafe_id=current_cafe.id,
        title=title,
        content=content,
        image_path=image_path,
        image_width=image_w,
        image_height=image_h,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    invalidate_cafe(current_cafe.id)
    return _post_to_out(current_cafe.id, post)


# ══════════════════════════════════════════════════════════════════════════════
# USUNIĘCIE
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Usuń aktualność")
def delete_news(
    post_id:      str,
    current_cafe: Cafe    = Depends(get_current_cafe),
    db:           Session = Depends(get_db),
):
    post = db.query(NewsPost).filter(NewsPost.id == post_id, NewsPost.cafe_id == current_cafe.id).first()
    if not post:
        raise HTTPException(404, detail="Aktualność nie istnieje.")
    old_path = post.image_path
    db.delete(post)
    db.commit()
    delete_image_files(UPLOAD_DIR, old_path)
    invalidate_cafe(current_cafe.id)


# ══════════════════════════════════════════════════════════════════════════════
# PLIK GRAFIKI (publiczny)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/image/{cafe_id}/{post_id}", summary="Pobierz grafikę aktualności (publiczne)")
def get_news_image(cafe_id: str, post_id: str, request: Request,
                   w: int | None = Query(None), db: Session = Depends(get_db)):
    post = db.query(NewsPost).filter(NewsPost.id == post_id, NewsPost.cafe_id == cafe_id).first()
    if not post or not post.image_path:
        raise HTTPException(404, detail="Grafika nie istnieje.")
    return image_response(request, UPLOAD_DIR, post.image_path, w, GALLERY_TIERS)