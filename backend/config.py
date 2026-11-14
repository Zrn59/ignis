"""Paths and settings. Everything can be overridden from the environment or .env."""

from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_env_file() -> None:
    path = PROJECT_ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()

# raw PSI download (only needed to rebuild the database)
RAW_ROOT = Path(os.environ.get("IGNIS_DATA_ROOT", PROJECT_ROOT.parent / "pre_nasa"))
DATA_ROOT = RAW_ROOT / "data"
READING_ROOT = RAW_ROOT / "reading"
RESOURCES_ROOT = RAW_ROOT / "resources"

DB_PATH = Path(os.environ.get("IGNIS_DB", PROJECT_ROOT / "data" / "ignis.db"))
CACHE_DIR = PROJECT_ROOT / "data" / "cache" / "pdftext"
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
# tried in order; the first model that answers wins
OPENROUTER_MODELS = [m.strip() for m in os.environ.get(
    "OPENROUTER_MODELS",
    "nvidia/nemotron-3.5-super-vl:free,baidu/ernie-5.5-flash-preview:free,"
    "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free",
).split(",") if m.strip()]
