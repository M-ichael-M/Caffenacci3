import re


MSG_FULL_NAME = "Imię i nazwisko musi mieć od 2 do 150 znaków."
MSG_NICK_LENGTH = "Nick musi mieć od 3 do 40 znaków."
MSG_NICK_CHARS = "Nick może zawierać tylko litery, cyfry, kropki i podkreślenia."


def clean(value: str) -> str:
    """Trim a string and collapse repeated whitespace."""
    return " ".join(value.split())


def normalize_phone(value: str) -> str:
    phone = re.sub(r"[\s().-]", "", value)
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if not re.fullmatch(r"\+?\d{7,15}", phone):
        raise ValueError("Podaj prawidłowy numer telefonu.")
    return phone


def validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Hasło musi mieć co najmniej 8 znaków.")
    return value


def _validate_text(value: str, label: str, minimum: int, maximum: int) -> str:
    value = clean(value)
    if not minimum <= len(value) <= maximum:
        raise ValueError(f"{label} musi mieć od {minimum} do {maximum} znaków.")
    return value


def validate_owner_name(value: str) -> str:
    return _validate_text(value, "Imię i nazwisko właściciela", 2, 100)


def validate_cafe_name(value: str) -> str:
    return _validate_text(value, "Nazwa kawiarni", 2, 150)


def validate_street(value: str) -> str:
    return _validate_text(value, "Ulica", 2, 150)


def validate_building_number(value: str) -> str:
    return _validate_text(value, "Numer budynku", 1, 20)


def validate_postal_code(value: str) -> str:
    return _validate_text(value, "Kod pocztowy", 3, 20)


def validate_city(value: str) -> str:
    return _validate_text(value, "Miasto", 2, 100)


def validate_country(value: str) -> str:
    return _validate_text(value, "Kraj", 2, 100)
