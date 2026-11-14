"""HTTP API and the built site. Run with ./run.sh serve (or uvicorn backend.app:app)."""

from __future__ import annotations

import csv
import io
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query as Q
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .ai import Assistant
from .config import DB_PATH, FRONTEND_DIST, OPENROUTER_MODELS
from .scoring import evaluate_atmosphere
from .search import Index, parse, snippet

if not DB_PATH.exists():
    raise SystemExit(f"{DB_PATH} not found. Build it first: ./run.sh build")

index = Index()
assistant = Assistant(index)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await assistant.close()


app = FastAPI(
    title="IGNIS API",
    version="1.0.0",
    lifespan=lifespan,
    description=(
        "24 NASA PSI combustion investigations: study records, test tables, tested "
        "conditions, flight sensor recordings, atmosphere calculator and an assistant "
        "that answers from the archive with citations."
    ),
)

STUDY_SUMMARY_FIELDS = (
    "id", "short", "acronym", "title", "title_ru", "flight", "area", "hardware",
    "program", "start", "end", "group", "state", "pillars", "safety", "summary",
    "fuel_text", "sensors", "varied", "safety_link", "stats", "proximity",
    "tables", "psi_url", "doi_url", "doi", "files", "missing_files",
)

MODELING_EXPORTS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "flex": (
        "ignis_psi69_flex_droplet_modeling.csv",
        [
            ("row", "psi_row"),
            ("table", "source_table"),
            ("run", "flex_identifier"),
            ("fuel", "fuel"),
            ("o2", "ambient_o2_pct"),
            ("p_kpa", "ambient_pressure_kpa"),
            ("co2", "ambient_co2_pct"),
            ("he", "ambient_he_pct"),
            ("diluent", "diluent_regime"),
            ("d0_mm", "initial_diameter_mm"),
            ("dext_mm", "extinction_diameter_mm"),
            ("k_mm2s", "burning_rate_k_mm2_s"),
            ("burn_s", "burn_time_s"),
            ("outcome", "test_outcome"),
        ],
    ),
    "saffire": (
        "ignis_saffire_0g_vs_1g_flammability.csv",
        [
            ("study", "study_id"),
            ("table", "source_table"),
            ("row", "psi_row"),
            ("sample", "sample_id"),
            ("material", "material"),
            ("thickness", "thickness"),
            ("o2", "ambient_o2_pct"),
            ("flow_cms", "airflow_cm_s"),
            ("direction", "flow_direction"),
            ("burn_s", "burn_time_s"),
            ("ug_burn", "microgravity_burn_length"),
            ("ug_rate_mms", "microgravity_spread_rate_mm_s"),
            ("ug_rate_raw", "microgravity_spread_raw"),
            ("g1_burn", "earth_1g_burn_length"),
            ("g1_rate_raw", "earth_1g_spread_raw"),
        ],
    ),
    "bass2": (
        "ignis_psi25_bass2_enclosed_burn_gas.csv",
        [
            ("row", "psi_row"),
            ("table", "source_table"),
            ("run", "test_number"),
            ("sample", "sample_material"),
            ("o2_init", "initial_o2_pct"),
            ("o2_final", "final_o2_pct"),
            ("co_delta_ppm", "co_delta_ppm"),
            ("co_final_ppm", "final_co_ppm"),
            ("fan", "fan_display"),
        ],
    ),
    "cfig": (
        "ignis_psi159_cfig_high_o2_regimes.csv",
        [
            ("row", "psi_row"),
            ("table", "source_table"),
            ("mode", "flame_configuration"),
            ("run", "test_code"),
            ("fuel", "fuel"),
            ("o2", "o2_pct"),
            ("p_kpa", "pressure_kpa"),
            ("burn_s", "burn_time_s"),
            ("peak_c", "peak_burner_temp_c"),
            ("hot", "hot_ignition"),
            ("end", "termination_mode"),
        ],
    ),
}


def brief_study(study: dict) -> dict:
    out = {k: study.get(k) for k in STUDY_SUMMARY_FIELDS}
    out["publications"] = len(study["publications"])
    return out


class SynthesisQuery(BaseModel):
    question: str = Field(min_length=2, max_length=600)
    lang: str = "ru"
    env: str | None = None
    mode: str = "simple"
    table: str | None = None
    study: str | None = None
    previous: str | None = Field(default=None, max_length=600)


@app.get("/api/meta")
def get_meta():
    kv = index.kv
    return {
        "totals": kv["totals"],
        "environments": kv["environments"],
        "coverage": kv["coverage"],
        "groups": kv["groups"],
        "pillars": kv["pillars"],
        "states": kv["states"],
        "faq": kv["faq"],
        "earth": kv["earth"],
        "synthesis": {
            "enabled": assistant.enabled,
            "models": OPENROUTER_MODELS if assistant.enabled else [],
        },
    }


@app.get("/api/studies")
def list_studies():
    return [brief_study(index.studies[sid]) for sid in index.order]


@app.get("/api/studies/{study_id}")
def get_study(study_id: str):
    if study_id not in index.studies:
        raise HTTPException(404, "unknown investigation")
    return index.studies[study_id]


@app.get("/api/studies/{study_id}/files")
def get_study_files(
    study_id: str,
    folder: str | None = None,
    q: str | None = None,
    run: str | None = None,
    limit: int = Q(200, le=1000),
    offset: int = 0,
):
    if study_id not in index.studies:
        raise HTTPException(404, "unknown investigation")
    sql, args = "FROM files WHERE study = ?", [study_id]
    if folder:
        sql += " AND folder = ?"
        args.append(folder)
    if run:
        sql += " AND run = ?"
        args.append(run)
    if q:
        sql += " AND name LIKE ?"
        args.append(f"%{q}%")
    db = index.connect()
    try:
        total = db.execute(f"SELECT COUNT(*) {sql}", args).fetchone()[0]
        rows = db.execute(
            f"SELECT folder, name, size, ext, run {sql} ORDER BY folder, name LIMIT ? OFFSET ?",
            args + [limit, offset],
        ).fetchall()
    finally:
        db.close()
    return {"total": total, "files": [dict(r) for r in rows]}


@app.get("/api/tables")
def list_tables():
    out = []
    for sid in index.order:
        for t in index.tables.values():
            if t["study"] == sid:
                out.append({
                    "id": t["id"],
                    "study": sid,
                    "short": index.studies[sid]["short"],
                    "label": t["label"],
                    "file": t["file"],
                    "rows": len(t["rows"]),
                    "columns": len(t["columns"]),
                    "row_kind": t["meta"].get("row_kind"),
                })
    return out


@app.get("/api/tables/{table_id}")
def get_table(table_id: str):
    if table_id not in index.tables:
        raise HTTPException(404, "unknown table")
    t = index.tables[table_id]
    s = index.studies[t["study"]]
    return dict(t, short=s["short"], psi_url=s["psi_url"])


@app.get("/api/tables/{table_id}/csv")
def export_table_csv(table_id: str):
    if table_id not in index.tables:
        raise HTTPException(404, "unknown table")
    t = index.tables[table_id]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["PSI row"] + t["columns"])
    for r in t["rows"]:
        writer.writerow([r["n"]] + r["cells"])
    name = t["file"].rsplit("/", 1)[-1]
    return Response(
        "\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@app.get("/api/points")
def get_points():
    return index.points


@app.get("/api/workbench")
def get_workbench():
    return index.kv.get("workbench", {"traces": [], "smoke": None, "modeling": {}})


@app.get("/api/modeling/{dataset}/csv")
def export_modeling_csv(dataset: str):
    """Modelling table as CSV; every record keeps its PSI table and row."""
    spec = MODELING_EXPORTS.get(dataset)
    if not spec:
        raise HTTPException(404, "unknown modeling dataset")
    filename, cols = spec
    wb = index.kv.get("workbench", {})
    rows = (wb.get("modeling") or {}).get(dataset) or []
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([header for _, header in cols])
    for item in rows:
        writer.writerow([item.get(key, "") if item.get(key) is not None else "" for key, _ in cols])
    return Response(
        "\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/simulate")
def simulate_habitat(
    o2: float = Q(34.0, ge=5.0, le=100.0),
    p: float = Q(56.5, ge=10.0, le=500.0),
    g: float = Q(0.166, ge=0.0, le=1.5),
    flow: float = Q(20.0, ge=0.0, le=100.0),
):
    """pO2, flags and the closest tested conditions for a custom atmosphere."""
    return evaluate_atmosphere(index, o2, p, g, flow)


@app.get("/api/search")
def search_archive(
    q: str = Q(..., min_length=2, max_length=300),
    lang: str = "ru",
    study: str | None = None,
    limit: int = Q(16, ge=1, le=50),
):
    """Full-text search over study records, table rows and PDF pages."""
    parsed = parse(q)
    hits = index.search(parsed, lang=lang if lang in ("ru", "en") else "en", limit=limit, scope_study=study, per_group=4)
    return {
        "query": q,
        "terms": parsed.shown,
        "conditions": {"o2": parsed.o2, "p": parsed.p},
        "hits": [
            {
                "id": h["id"],
                "kind": h["kind"],
                "study": h["study"],
                "study_short": index.studies[h["study"]]["short"] if h.get("study") in index.studies else None,
                "title": h["title"],
                "file": h["file"],
                "loc": h["loc"],
                "snippet": snippet(h["text"], parsed, 260),
                "table": h["tbl"],
                "row": h["row"],
                "url": h["url"],
                "score": round(h.get("score", 0.0), 2),
            }
            for h in hits
        ],
    }


@app.get("/api/rank")
def rank_investigations(q: str = "", env: str | None = None, lang: str = "ru"):
    query = parse(q) if q.strip() else None
    has_cond = bool(query and (query.o2 is not None or query.p is not None))
    return {
        "terms": query.shown if query else [],
        "conditions": {"o2": query.o2, "p": query.p} if query else None,
        "nearest": index.nearest_rows(query.o2, query.p, 6) if has_cond and query else [],
        "ranking": index.rank_studies(query, env, lang),
    }


@app.post("/api/ask")
async def ask_archive(body: SynthesisQuery):
    return await assistant.ask(
        body.question,
        body.lang,
        body.env,
        body.mode,
        body.table,
        body.study,
        body.previous,
    )


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "synthesis": assistant.enabled,
        "model": assistant.last_model,
        "last_error": assistant.last_error,
        "built": index.kv["totals"]["built"],
    }


if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def serve_spa(path: str):
        target = (FRONTEND_DIST / path).resolve()
        if path and target.is_file() and FRONTEND_DIST.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
