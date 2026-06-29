from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.cafe import Cafe
from app.models.menu import MenuSection, MenuItem
from app.schemas.menu import MenuSaveIn, MenuOut, MenuSectionOut

router = APIRouter(prefix="/menu", tags=["menu"])
bearer_scheme = HTTPBearer()


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kawiarnia nie znaleziona.")
    return cafe


@router.get("", response_model=MenuOut, summary="Pobierz menu kawiarni")
def get_menu(current_cafe: Cafe = Depends(get_current_cafe), db: Session = Depends(get_db)):
    sections = (
        db.query(MenuSection)
        .options(selectinload(MenuSection.items))
        .filter(MenuSection.cafe_id == current_cafe.id)
        .order_by(MenuSection.position)
        .all()
    )
    return MenuOut(cafe_id=current_cafe.id, sections=sections)


@router.put("", response_model=MenuOut, summary="Zapisz / zaktualizuj całe menu")
def save_menu(
    payload: MenuSaveIn,
    current_cafe: Cafe = Depends(get_current_cafe),
    db: Session = Depends(get_db),
):
    # Usuń stare sekcje (kaskadowo usunie też pozycje)
    db.query(MenuSection).filter(MenuSection.cafe_id == current_cafe.id).delete()

    new_sections = []
    for sec_data in payload.sections:
        section = MenuSection(
            cafe_id=current_cafe.id,
            name=sec_data.name,
            position=sec_data.position,
        )
        db.add(section)
        db.flush()  # żeby dostać section.id przed dodaniem items

        for item_data in sec_data.items:
            item = MenuItem(
                section_id=section.id,
                name=item_data.name,
                description=item_data.description,
                price=item_data.price,
                position=item_data.position,
                is_vege=item_data.is_vege,
                is_hot=item_data.is_hot,
                is_unavailable=item_data.is_unavailable,
            )
            db.add(item)

        new_sections.append(section)

    db.commit()
    for s in new_sections:
        db.refresh(s)

    # reload with items
    sections = (
        db.query(MenuSection)
        .options(selectinload(MenuSection.items))
        .filter(MenuSection.cafe_id == current_cafe.id)
        .order_by(MenuSection.position)
        .all()
    )
    return MenuOut(cafe_id=current_cafe.id, sections=sections)