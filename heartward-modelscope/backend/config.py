"""Read literal local configuration without overriding process environment."""
import os
import re
import threading
from pathlib import Path


ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def read_env(path=ENV_PATH):
    path = Path(path)
    if not path.is_file():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def load_env(path=ENV_PATH):
    for key, value in read_env(path).items():
        os.environ.setdefault(key, value)


class ReloadableEnv:
    """Reload file-owned values while preserving genuine process overrides."""

    def __init__(self, path=ENV_PATH):
        self.path = Path(path)
        self.inherited = set(os.environ)
        self.loaded = {}
        self.lock = threading.Lock()

    def reload(self, on_change=None):
        with self.lock:
            try:
                values = {k: v for k, v in read_env(self.path).items() if k not in self.inherited}
            except (OSError, UnicodeError):
                return False  # Keep the last working configuration during a partial save.
            if values == self.loaded:
                return False
            for key in self.loaded.keys() - values.keys():
                os.environ.pop(key, None)
            os.environ.update(values)
            self.loaded = values
            if on_change:
                on_change()
            return True
