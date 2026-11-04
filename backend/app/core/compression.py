import re
from starlette.middleware.gzip import GZipMiddleware

# Pliki obrazów są już skompresowane (WebP/JPEG) — gzip tylko marnuje CPU.
_SKIP = re.compile(r"^/(profile/(logo|gallery)|news/image|uploads)/")


class SelectiveGZipMiddleware:
    def __init__(self, app, minimum_size: int = 500, compresslevel: int = 6):
        self.app = app
        self._gzip = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and _SKIP.match(scope["path"]):
            await self.app(scope, receive, send)
        else:
            await self._gzip(scope, receive, send)