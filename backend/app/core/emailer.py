from __future__ import annotations

import logging
import ssl
import smtplib
from email.message import EmailMessage
from typing import Protocol

from app.core.config import settings

log = logging.getLogger(__name__)


class EmailProvider(Protocol):
    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None: ...


class ConsoleEmailProvider:
    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None:
        log.info("[DEV EMAIL] To: %s\nSubject: %s\n\n%s", to, subject, text)


class SmtpEmailProvider:
    def send(self, to: str, subject: str, text: str, html: str | None = None) -> None:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
        msg["To"] = to
        msg.set_content(text)
        if html: msg.add_alternative(html, subtype="html")
        with smtplib.SMTP(settings.SMTP_HOST or "smtp.gmail.com", settings.SMTP_PORT, timeout=20) as server:
            if settings.SMTP_STARTTLS: server.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER: server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.send_message(msg)


def get_email_provider() -> EmailProvider:
    return SmtpEmailProvider() if settings.EMAIL_BACKEND == "smtp" else ConsoleEmailProvider()


def send_employee_invite_email(to_email: str, cafe_name: str, invite_code: str) -> None:
    subject = f"Zaproszenie do aplikacji Caffenacci Business — {cafe_name}"
    play_url = settings.PLAY_STORE_URL or ""
    body = (f"Cześć!\n\nZostałeś/aś zaproszony/a do aplikacji Caffenacci Business dla kawiarni „{cafe_name}”.\n\n"
            f"1. Pobierz aplikację: {play_url}\n2. Twój osobisty kod logowania: {invite_code}\n"
            "   (kod jest ważny 30 minut od otrzymania tej wiadomości — poproś właściciela o nowe zaproszenie, jeśli zdąży wygasnąć)\n"
            "3. Poproś właściciela kawiarni o stały kod kawiarni — będzie potrzebny przy pierwszym logowaniu.\n\nDo zobaczenia!")
    try: get_email_provider().send(to_email, subject, body)
    except Exception: log.exception("Employee invitation email failed for %s", to_email)
