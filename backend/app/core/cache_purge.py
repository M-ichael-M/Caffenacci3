import logging

log = logging.getLogger(__name__)

def cafe_page_urls(slug: str | None, api_base: str) -> list[str]:
    return [f"{api_base.rstrip('/')}/kawiarnia/{slug}"] if slug else []

def purge_urls(urls: list[str]) -> None:
    """No-op until AFTER-A connects this hook to Cloudflare."""
    log.debug("CDN purge requested for %d URL(s): %s", len(urls), urls)
