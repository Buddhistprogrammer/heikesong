"""Local demonstration backend for 解忧漫游."""
import hashlib
import os
from pathlib import Path

API_VERSION = "companion-v6-html-3"
WORKSPACE_ID = hashlib.sha256(os.path.normcase(str(Path(__file__).resolve().parent.parent)).encode()).hexdigest()[:20]
