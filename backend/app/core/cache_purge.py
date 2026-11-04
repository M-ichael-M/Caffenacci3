import logging
from urllib.parse import quote

log = logging.getLogger(__name__)

def cafe_page_urls(slug: str | None, public_site_url: str) -> list[str]:
    return [f"{public_site_url.rstrip('/')}/kawiarnia/{quote(slug, safe='')}"] if slug else []

def purge_urls(urls: list[str]) -> None:
    """No-op until AFTER-A connects this hook to Cloudflare."""
    log.debug("CDN purge requested for %d URL(s): %s", len(urls), urls)
