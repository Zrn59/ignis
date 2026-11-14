#!/usr/bin/env bash
# IGNIS: one entry point.
#   ./run.sh setup   install Python and Node dependencies
#   ./run.sh build   rebuild data/ignis.db from ../pre_nasa (add --no-pdf to skip PDF text)
#   ./run.sh web     build the frontend into frontend/dist
#   ./run.sh serve   start the site on http://127.0.0.1:8000
#   ./run.sh dev     API on :8000 and Vite with hot reload on :5173
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"

py() {
  if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
  .venv/bin/pip install -q -r requirements.txt
}

case "${1:-}" in
  setup) py; (cd frontend && npm install --no-audit --no-fund) ;;
  build) py; shift; exec .venv/bin/python -m backend.build "$@" ;;
  web)   (cd frontend && npm run build) ;;
  serve) py
         [[ -f data/ignis.db ]] || .venv/bin/python -m backend.build
         [[ -d frontend/dist ]] || (cd frontend && npm install --no-audit --no-fund && npm run build)
         exec .venv/bin/uvicorn backend.app:app --host "$HOST" --port "$PORT" ;;
  dev)   py
         .venv/bin/uvicorn backend.app:app --host "$HOST" --port "$PORT" --reload &
         trap 'kill %1' EXIT
         (cd frontend && npm run dev) ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
