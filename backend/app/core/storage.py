"""Local filesystem storage behind a small provider-neutral interface."""
from __future__ import annotations

import os
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings


class Storage:
    def put(self, key: str, data: bytes, content_type: str | None = None) -> None: raise NotImplementedError
    def open(self, key: str) -> BinaryIO: raise NotImplementedError
    def get_bytes(self, key: str) -> bytes:
        with self.open(key) as f: return f.read()
    def stat(self, key: str) -> tuple[int, int] | None: raise NotImplementedError
    def exists(self, key: str) -> bool: return self.stat(key) is not None
    def delete(self, key: str) -> None: raise NotImplementedError
    def delete_prefix(self, prefix: str) -> None: raise NotImplementedError
    def local_path(self, key: str) -> Path: raise NotImplementedError


class LocalStorage(Storage):
    def __init__(self, root: str | Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def local_path(self, key: str) -> Path:
        normalized = key.replace("\\", "/")
        if not normalized or normalized.startswith("/") or any(p in ("", ".", "..") for p in normalized.split("/")):
            raise ValueError("Invalid storage key")
        path = (self.root / normalized).resolve()
        if not path.is_relative_to(self.root): raise ValueError("Invalid storage key")
        return path

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        path = self.local_path(key); path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
    def open(self, key: str) -> BinaryIO: return self.local_path(key).open("rb")
    def stat(self, key: str) -> tuple[int, int] | None:
        try:
            st = self.local_path(key).stat(); return st.st_size, st.st_mtime_ns
        except FileNotFoundError: return None
    def delete(self, key: str) -> None:
        try: self.local_path(key).unlink()
        except FileNotFoundError: pass
    def delete_prefix(self, prefix: str) -> None:
        base = self.local_path(prefix)
        targets = list(base.parent.glob(base.name + "*"))
        for target in targets:
            if target.is_file() or target.is_symlink(): target.unlink()
            elif target.is_dir():
                for path in sorted(target.rglob("*"), reverse=True):
                    if path.is_file() or path.is_symlink(): path.unlink()
                    elif path.is_dir(): path.rmdir()
                target.rmdir()


_storage: Storage | None = None
def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = LocalStorage(settings.STORAGE_LOCAL_DIR)
    return _storage
