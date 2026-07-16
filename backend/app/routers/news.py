from __future__ import annotations

import io
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from PIL import Image, ImageOps

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.news import NewsSettings, NewsPost
from app.schemas.news import (
    NewsSettingsIn, NewsSettingsOut, NewsPostOut, NewsPostListOut,
    MAX_NEWS_POSTS, MAX_NEWS_IMAGE_BYTES, ALLOWED_NEWS_IMAGE_CONTENT_TYPES,
    NEWS_IMAGE_MAX_DIMENSION, NEWS_IMAGE_JPEG_QUALITY,
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
    if not post.image_path:
        return None
    return f"/news/image/{cafe_id}/{post.id}"


def _post_to_out(cafe_id: str, post: NewsPost) -> NewsPostOut:
    return NewsPostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        image_url=_image_url(cafe_id, post),
        created_at=post.created_at,
    )


def _process_news_image(raw: bytes) -> Image.Image:
    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()
        img = Image.open(io.BytesIO(raw))
    except Exception:
        raise HTTPException(400, detail="Plik nie jest prawidłowym obrazem.")

    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    else:
        img = img.convert("RGB")

    img.thumbnail((NEWS_IMAGE_MAX_DIMENSION, NEWS_IMAGE_MAX_DIMENSION), Image.Resampling.LANCZOS)
    return img


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

    image_path = None
    if file is not None and file.filename:
        if file.content_type not in ALLOWED_NEWS_IMAGE_CONTENT_TYPES:
            raise HTTPException(400, detail="Dozwolone formaty grafiki: PNG, JPEG, WEBP.")
        raw = await file.read()
        if len(raw) > MAX_NEWS_IMAGE_BYTES:
            raise HTTPException(400, detail="Plik jest za duży. Maksymalny rozmiar to 10 MB.")
        img = _process_news_image(raw)
        filename = f"{current_cafe.id}_{uuid.uuid4().hex[:10]}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)
        img.save(filepath, "JPEG", quality=NEWS_IMAGE_JPEG_QUALITY, optimize=True)
        image_path = filename

    post = NewsPost(
        cafe_id=current_cafe.id,
        title=title,
        content=content,
        image_path=image_path,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
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
    if post.image_path:
        filepath = os.path.join(UPLOAD_DIR, post.image_path)
        if os.path.exists(filepath):
            os.remove(filepath)
    db.delete(post)
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# PLIK GRAFIKI (publiczny)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/image/{cafe_id}/{post_id}", summary="Pobierz grafikę aktualności (publiczne)")
def get_news_image(cafe_id: str, post_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse

    post = db.query(NewsPost).filter(NewsPost.id == post_id, NewsPost.cafe_id == cafe_id).first()
    if not post or not post.image_path:
        raise HTTPException(404, detail="Grafika nie istnieje.")
    filepath = os.path.join(UPLOAD_DIR, post.image_path)
    if not os.path.exists(filepath):
        raise HTTPException(404, detail="Plik grafiki nie istnieje.")
    return FileResponse(filepath)