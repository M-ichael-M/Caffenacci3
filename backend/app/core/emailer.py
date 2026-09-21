from __future__ import annotations
import smtplib
from email.mime.text import MIMEText

from app.core.config import settings

PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.example.caffenacci"


def send_employee_invite_email(to_email: str, cafe_name: str, invite_code: str) -> None:
    subject = f"Zaproszenie do aplikacji Caffenacci Business — {cafe_name}"
    body = (
        f"Cześć!\n\n"
        f"Zostałeś/aś zaproszony/a do aplikacji Caffenacci Business dla kawiarni „{cafe_name}”.\n\n"
        f"1. Pobierz aplikację: {PLAY_STORE_URL}\n"
        f"2. Twój osobisty kod logowania: {invite_code}\n"
        f"   (kod jest ważny 30 minut od otrzymania tej wiadomości — poproś "
        f"właściciela o nowe zaproszenie, jeśli zdąży wygasnąć)\n"
        f"3. Poproś właściciela kawiarni o stały kod kawiarni — będzie potrzebny "
        f"przy pierwszym logowaniu.\n\n"
        f"Do zobaczenia!"
    )

    if not settings.SMTP_HOST:
        # Brak skonfigurowanego SMTP — tryb deweloperski: log do konsoli.
        print(f"[DEV EMAIL] To: {to_email}\nSubject: {subject}\n\n{body}\n")
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], [to_email], msg.as_string())