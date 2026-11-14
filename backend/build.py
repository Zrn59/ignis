"""Build data/ignis.db from the raw PSI download in pre_nasa.

    python -m backend.build            # full build (PDF text is cached between runs)
    python -m backend.build --no-pdf   # skip PDF text, a few seconds

The site only needs the resulting SQLite file; the 12 GB raw archive stays where it is.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import curated
from .config import CACHE_DIR, DATA_ROOT, DB_PATH, READING_ROOT, RESOURCES_ROOT
from .normalize import ATM_KPA, nums, rule_for
from .scoring import score_envelope

PSI_PAGE = "https://psi.nasa.gov/physci/repo/data/investigations/{id}"
DOC_FOLDERS = ("Science Documents", "Reports", "Presentations", "Engineering Documents",
               "Reference Data", "Analyzed Data")
RUN_ID = re.compile(r"(?<![A-Za-z0-9])(\d{5}[A-Z]\d{1,2}|\d{3}[A-Z]\d{3}|[A-Z]\d{3}[A-Z]\d{2}|\d{2}CAL\d{2})(?![0-9])")
MAX_PDF_PAGES = 40
CHUNK = 900


def study_sort_key(sid: str) -> int:
    return int(sid.split("-")[1])


def read_csv(path: Path) -> list[list[str]]:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    return list(csv.reader(io.StringIO(text, newline="")))


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\x00", " ")).strip()


def chunks(text: str, size: int = CHUNK) -> list[str]:
    """Split on sentence ends so a passage never stops mid-sentence."""
    text = clean(text)
    if len(text) <= size:
        return [text] if text else []
    parts, cur = [], ""
    for sentence in re.split(r"(?<=[.!?;])\s+", text):
        if len(cur) + len(sentence) + 1 > size and cur:
            parts.append(cur)
            cur = sentence
        else:
            cur = f"{cur} {sentence}".strip()
        while len(cur) > size * 1.5:
            parts.append(cur[:size])
            cur = cur[size:]
    if cur:
        parts.append(cur)
    return parts


def parse_psi_date(text: str) -> str | None:
    m = re.match(r"(\d{2})-(\d{2})-(\d{4})", text or "")
    return f"{m.group(3)}-{m.group(1)}-{m.group(2)}" if m else None


# ---------------------------------------------------------------------------
# studies and tables
# ---------------------------------------------------------------------------

def load_study(sid: str) -> dict:
    card = json.loads((DATA_ROOT / sid / "investigation.json").read_text(encoding="utf-8"))
    cur = curated.STUDIES[sid]
    pubs = []
    for p in card.get("publications") or []:
        title = clean(p.get("title"))
        if title:
            pubs.append({"title": title, "authors": clean(p.get("authorList")), "doi": clean(p.get("doi")),
                         "status": clean((p.get("status") or {}).get("annotationValue"))})
    people = []
    for c in card.get("contacts") or []:
        name = clean(f"{c.get('firstName', '')} {c.get('lastName', '')}")
        if name:
            people.append({"name": name, "affiliation": clean(c.get("affiliation")),
                           "role": ", ".join(clean(r.get("annotationValue")) for r in c.get("roles") or [])})
    flight = card.get("projectType") == "Microgravity Investigation"
    return {
        "id": sid, "short": cur["short"], "acronym": clean(card.get("investigationAcronym")) or cur["short"],
        "title": clean(card.get("title")), "title_ru": cur["title_ru"],
        "flight": flight, "project_type": clean(card.get("projectType")),
        "area": clean(card.get("subResearchArea")), "hardware": clean(card.get("experimentHardware")),
        "program": clean(card.get("flightProgram")), "center": clean(card.get("managingNasaCenter")),
        "start": parse_psi_date(card.get("investigationStartDate")), "end": parse_psi_date(card.get("investigationEndDate")),
        "doi": clean(card.get("doi")), "license": clean(card.get("licenseName")),
        "psi_url": PSI_PAGE.format(id=sid), "doi_url": f"https://doi.org/{clean(card.get('doi'))}" if card.get("doi") else None,
        "objective": (card.get("objective") or "").strip(), "approach": (card.get("approach") or "").strip(),
        "hypothesis": (card.get("hypothesis") or "").strip(), "impacts": (card.get("researchImpacts") or "").strip(),
        "publications": pubs, "people": people,
        "group": cur["group"], "state": cur["state"], "pillars": cur["pillars"], "safety": cur["safety"],
        "summary": cur["summary"], "fuel_text": cur["fuel"], "sensors": cur["sensors"], "varied": cur["varied"],
        "safety_link": cur["safety_link"],
    }


def column_profile(header: str, values: list[tuple[int, str]]) -> dict:
    """Min/max with row numbers for numeric columns, top values otherwise."""
    filled = [(n, v) for n, v in values if v.strip()]
    prof = {"name": header, "filled": len(filled)}
    numeric = []
    for n, v in filled:
        found = nums(v)
        stripped = re.sub(r"[~≈\s]", "", v)
        if len(found) == 1 and re.fullmatch(r"-?\d*\.?\d+(?:[eE][-+]?\d+)?", stripped):
            numeric.append((found[0], n))
    if filled and len(numeric) >= 0.6 * len(filled) and len(numeric) >= 3:
        lo, hi = min(numeric), max(numeric)
        prof.update(type="number", min=lo[0], min_row=lo[1], max=hi[0], max_row=hi[1],
                    mean=round(sum(v for v, _ in numeric) / len(numeric), 4), n=len(numeric))
    else:
        counts = Counter(clean(v) for _, v in filled)
        prof.update(type="text", distinct=len(counts),
                    top=[[k[:80], c] for k, c in counts.most_common(8)])
    return prof


def load_tables(sid: str) -> list[dict]:
    out = []
    folder = DATA_ROOT / sid / "Experimental table"
    if not folder.is_dir():
        return out
    for path in sorted(folder.glob("*.csv")):
        grid = read_csv(path)
        if not grid:
            continue
        headers = [clean(h) for h in grid[0]]
        fn, meta = rule_for(path.name)
        rows = []
        prev = None
        for i, raw in enumerate(grid[1:], start=1):
            cells = [clean(c) for c in raw] + [""] * (len(headers) - len(raw))
            cells = cells[:len(headers)]
            if not any(cells):
                continue
            record = dict(zip(headers, cells))
            norm = fn(record) if fn else {}
            # E-FIELD lists extra fuel concentrations on continuation rows under a test day
            if meta.get("row_kind") == "day" and not norm.get("run") and not norm.get("date") and prev:
                norm = dict(prev, count=0, continuation=True)
            else:
                prev = norm
            rows.append({"n": i, "cells": cells, "norm": norm})
        label = path.stem.split("_Experimental table_")[-1]
        tid = f"{sid}:{re.sub(r'[^A-Za-z0-9]+', '-', label).strip('-').lower()}"
        profile = [column_profile(h, [(r["n"], r["cells"][j]) for r in rows]) for j, h in enumerate(headers)]
        out.append({"id": tid, "study": sid, "label": label, "file": f"{sid}/Experimental table/{path.name}",
                    "columns": headers, "meta": meta, "profile": profile, "rows": rows})
    return out


def rng(values: list[float]) -> list[float] | None:
    return [round(min(values), 2), round(max(values), 2)] if values else None


def study_stats(study: dict, tables: list[dict]) -> None:
    amb, oxi, pres, flow, dates = [], [], [], [], []
    fuels: Counter = Counter()
    tests = records = 0
    days: dict[str, dict] = {}
    p_assumed = None
    for t in tables:
        meta = t["meta"]
        for r in t["rows"]:
            n = r["norm"]
            if not n or n.get("continuation") or n.get("skip"):
                continue
            records += 1
            tests += n.get("count") or 0
            if n.get("o2"):
                (oxi if meta.get("o2_basis") == "oxidizer" else amb).extend(n["o2"])
            if n.get("p"):
                pres.extend(n["p"])
            elif n.get("o2") and meta.get("p_assumed"):
                p_assumed = meta["p_assumed"]
            if n.get("flow"):
                flow.extend(n["flow"])
            for f in n.get("fuel") or []:
                fuels[f] += 1
            if n.get("date"):
                dates.append(n["date"])
                day = days.setdefault(n["date"], {"date": n["date"], "tests": 0, "rows": 0, "fuels": Counter(), "table": t["id"], "first_row": r["n"]})
                day["tests"] += n.get("count") or 0
                day["rows"] += 1
                for f in n.get("fuel") or []:
                    day["fuels"][f] += 1
    timeline = []
    for d in sorted(days.values(), key=lambda x: x["date"]):
        timeline.append({"date": d["date"], "tests": d["tests"], "rows": d["rows"], "table": d["table"],
                         "first_row": d["first_row"], "fuels": [f for f, _ in d["fuels"].most_common(4)]})
    study["stats"] = {
        "tables": len(tables), "records": records, "tests": tests,
        "o2_ambient": rng(amb), "o2_oxidizer": rng(oxi), "p": rng(pres), "p_assumed": p_assumed, "flow": rng(flow),
        "fuels": [[f, c] for f, c in fuels.most_common()],
        "first_test": min(dates) if dates else None, "last_test": max(dates) if dates else None,
        "test_days": len(days),
    }
    study["timeline"] = timeline


def proximity(study: dict, env: dict) -> dict:
    """Transparent 0..10 score of how close a study's tested conditions are to an environment."""
    res = score_envelope(study, env["o2"], env["p"], env.get("g"))
    return {"score": res["score"], "parts": res["parts"]}


def coverage_points(tables: list[dict]) -> list[dict]:
    pts = []
    for t in tables:
        meta = t["meta"]
        basis = meta.get("o2_basis")
        for r in t["rows"]:
            n = r["norm"]
            if not n or n.get("continuation") or not n.get("o2"):
                continue
            o2s = n.get("o2_list") or [round(sum(n["o2"]) / 2, 2)]
            if n.get("p_list"):
                ps, src = n["p_list"], "table"
            elif n.get("p"):
                ps = [round(sum(n["p"]) / 2, 2)]
                src = "note" if meta.get("p_note") and not meta.get("p_assumed") else "table"
            elif meta.get("p_assumed"):
                ps, src = [round(meta["p_assumed"], 2)], "assumed"
            else:
                ps, src = [None], "none"
            for o in o2s:
                for p in ps:
                    pts.append({"s": t["study"], "t": t["id"], "r": r["n"], "o2": o, "p": p, "b": basis, "ps": src,
                                "m": bool(n.get("matrix")), "f": (n.get("fuel") or [""])[0], "run": n.get("run")})
    return pts


def env_coverage(points: list[dict]) -> list[dict]:
    out = []
    for env in curated.ENVIRONMENTS:
        near = [p for p in points if p["b"] == "ambient" and p["p"] is not None and not p["m"]
                and abs(p["o2"] - env["o2"]) <= 3 and abs(p["p"] - env["p"]) <= 15]
        rows = {(p["t"], p["r"]) for p in near}
        by_study = Counter(p["s"] for p in {(p["s"], p["t"], p["r"]): p for p in near}.values())
        matrix = sorted({p["s"] for p in points if p["m"] and p["b"] == "ambient" and p["p"] is not None
                         and abs(p["o2"] - env["o2"]) <= 3 and abs(p["p"] - env["p"]) <= 15})
        g = env.get("g")
        gravity_ok = g in (0, 0.0)
        if len(rows) >= 20 and gravity_ok:
            status = "data"
        elif rows or matrix:
            status = "partial"
        else:
            status = "none"
        out.append({"id": env["id"], "rows": len(rows), "studies": [[s, c] for s, c in by_study.most_common()],
                    "matrix": matrix, "status": status, "gravity_ok": gravity_ok})
    return out


# ---------------------------------------------------------------------------
# files
# ---------------------------------------------------------------------------

def scan_files(sid: str) -> list[tuple]:
    out = []
    base = DATA_ROOT / sid
    for root, _dirs, names in os.walk(base):
        folder = Path(root).relative_to(base).as_posix()
        for name in names:
            if folder == "." and name == "investigation.json":
                continue
            p = Path(root) / name
            short = name.split(f"{sid}_{folder}_")[-1] if folder != "." else name
            m = RUN_ID.search(short)
            out.append((sid, folder, name, p.stat().st_size, p.suffix.lower().lstrip("."), m.group(1) if m else None))
    return out


def missing_files() -> dict[str, int]:
    out: Counter = Counter()
    seen = set()
    manifest = DATA_ROOT / "manifest.jsonl"
    if manifest.exists():
        for line in manifest.open(encoding="utf-8"):
            d = json.loads(line)
            path = d.get("path", "")
            if d.get("status") == "failed" and path not in seen and not Path(path).exists():
                seen.add(path)
                out[d["accession"]] += 1
    return dict(out)


# ---------------------------------------------------------------------------
# PDF text
# ---------------------------------------------------------------------------

def pdf_pages(path: Path) -> list[str]:
    key = hashlib.sha1(f"{path}|{path.stat().st_size}|{MAX_PDF_PAGES}".encode()).hexdigest()
    cache = CACHE_DIR / f"{key}.txt"
    if cache.exists():
        return cache.read_text(encoding="utf-8").split("\f")
    try:
        with path.open("rb") as fh:
            if fh.read(5) != b"%PDF-":
                text = ""
            else:
                res = subprocess.run(["pdftotext", "-l", str(MAX_PDF_PAGES), "-enc", "UTF-8", str(path), "-"],
                                     capture_output=True, timeout=120)
                text = res.stdout.decode("utf-8", "replace")
    except (subprocess.SubprocessError, OSError):
        text = ""
    cache.write_text(text, encoding="utf-8")
    return text.split("\f")


def doc_title(sid: str, folder: str, name: str) -> str:
    title = name.split(f"{sid}_{folder}_")[-1]
    return re.sub(r"\.pdf$", "", title, flags=re.I).replace("_", " ")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def fmt(v: float) -> str:
    return f"{v:g}"


def main(argv: list[str]) -> int:
    t0 = time.time()
    with_pdf = "--no-pdf" not in argv
    if not DATA_ROOT.is_dir():
        print(f"raw data not found: {DATA_ROOT}\nset IGNIS_DATA_ROOT to the pre_nasa folder", file=sys.stderr)
        return 1
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    ids = sorted((p.name for p in DATA_ROOT.iterdir() if (p / "investigation.json").exists()), key=study_sort_key)

    studies, tables, passages = [], [], []
    missing = missing_files()

    def add(kind, study, title, file, loc, text, lang="en", table=None, row=None, url=None):
        text = clean(text)
        if text:
            passages.append((kind, study, title, file, loc, text, lang, table, row, url))

    for sid in ids:
        study = load_study(sid)
        ts = load_tables(sid)
        study_stats(study, ts)
        study["tables"] = [{"id": t["id"], "label": t["label"], "file": t["file"], "rows": len(t["rows"]),
                            "columns": len(t["columns"])} for t in ts]
        study["missing_files"] = missing.get(sid, 0)
        study["proximity"] = {e["id"]: proximity(study, e) for e in curated.ENVIRONMENTS}
        studies.append(study)
        tables.extend(ts)

    points = coverage_points(tables)
    coverage = env_coverage(points)

    # ---- files
    files = []
    for sid in ids:
        files.extend(scan_files(sid))
    by_study_files: dict[str, Counter] = defaultdict(Counter)
    for sid, folder, _n, size, _e, _r in files:
        by_study_files[sid][folder] += 1
        by_study_files[sid]["__bytes"] += size
    for study in studies:
        c = by_study_files[study["id"]]
        study["files"] = {"total": sum(v for k, v in c.items() if k != "__bytes"), "bytes": c["__bytes"],
                          "folders": [[k, v] for k, v in sorted(c.items()) if k != "__bytes"]}

    # ---- passages: study cards
    for s in studies:
        sid, url = s["id"], s["psi_url"]
        card = f"{sid}/investigation.json"
        name = f"{s['short']} ({sid})"
        for field, label in (("objective", "Objective"), ("approach", "Approach"), ("hypothesis", "Hypothesis"),
                             ("impacts", "Research impacts")):
            for part in chunks(s[field]):
                add("card", sid, f"{name}: {label}", card, f"field {field if field != 'impacts' else 'researchImpacts'}", part, url=url)
        st = s["stats"]
        facts_en = [f"{name}: {s['title']}. {s['summary']['en']}", f"Fuel: {s['fuel_text']['en']}",
                    f"Measurements: {s['sensors']['en']}.", f"Varied between tests: {s['varied']['en']}",
                    f"Fire-safety link: {s['safety_link']['en']}",
                    f"Hardware: {s['hardware'] or 'n/a'}. Platform: {s['program'] or s['project_type']}. Investigation dates: {s['start'] or '?'} to {s['end'] or '?'}."]
        facts_ru = [f"{name}: {s['title_ru']}. {s['summary']['ru']}", f"Топливо: {s['fuel_text']['ru']}",
                    f"Измерения: {s['sensors']['ru']}.", f"Что менялось между тестами: {s['varied']['ru']}",
                    f"Связь с пожарной безопасностью: {s['safety_link']['ru']}"]
        if st["records"]:
            en = [f"The PSI experimental table holds {st['records']} records"]
            ru = [f"В таблице PSI {st['records']} записей"]
            if st["o2_ambient"]:
                en.append(f"ambient oxygen {fmt(st['o2_ambient'][0])}–{fmt(st['o2_ambient'][1])} %")
                ru.append(f"кислород в камере {fmt(st['o2_ambient'][0])}–{fmt(st['o2_ambient'][1])} %")
            if st["o2_oxidizer"]:
                en.append(f"oxygen in the burner flow (inverse flames) {fmt(st['o2_oxidizer'][0])}–{fmt(st['o2_oxidizer'][1])} %")
                ru.append(f"кислород в потоке из горелки (обратные пламёна) {fmt(st['o2_oxidizer'][0])}–{fmt(st['o2_oxidizer'][1])} %")
            if st["p"]:
                en.append(f"pressure {fmt(st['p'][0])}–{fmt(st['p'][1])} kPa")
                ru.append(f"давление {fmt(st['p'][0])}–{fmt(st['p'][1])} кПа")
            if st["flow"]:
                en.append(f"flow speed {fmt(st['flow'][0])}–{fmt(st['flow'][1])} cm/s")
                ru.append(f"скорость потока {fmt(st['flow'][0])}–{fmt(st['flow'][1])} см/с")
            if st["first_test"]:
                en.append(f"test dates {st['first_test']} to {st['last_test']}")
                ru.append(f"даты тестов с {st['first_test']} по {st['last_test']}")
            if st["fuels"]:
                top = ", ".join(f"{f} ({c})" for f, c in st["fuels"][:8])
                en.append(f"fuels and materials by number of records: {top}")
                ru.append(f"топлива и материалы по числу записей: {top}")
            facts_en.append("; ".join(en) + ".")
            facts_ru.append("; ".join(ru) + ".")
        add("summary", sid, f"{name}: summary", card, "IGNIS summary of the PSI record and table", " ".join(facts_en), url=url)
        add("summary", sid, f"{name}: сводка", card, "сводка IGNIS по карточке и таблице PSI", " ".join(facts_ru), lang="ru", url=url)
        for i, p in enumerate(s["publications"], 1):
            doi = f" DOI {p['doi']}" if p["doi"] else ""
            add("publication", sid, f"{name}: publication {i}", card, f"publications[{i}]",
                f"{p['title']}. {p['authors']}.{doi}", url=f"https://doi.org/{p['doi']}" if p["doi"] else url)
        if s["people"]:
            add("card", sid, f"{name}: team", card, "field contacts",
                "Investigators: " + "; ".join(f"{p['name']} — {p['role']}, {p['affiliation']}" for p in s["people"]), url=url)

    # ---- passages: table rows and table profiles
    by_id = {s["id"]: s for s in studies}
    for t in tables:
        s = by_id[t["study"]]
        name = f"{s['short']} ({s['id']})"
        for r in t["rows"]:
            pairs = [f"{h}: {c[:240]}" for h, c in zip(t["columns"], r["cells"]) if c and h.lower() not in ("notes", "comments")]
            add("row", s["id"], f"{name}, table {t['label']}, row {r['n']}", t["file"], f"row {r['n']}",
                "; ".join(pairs), table=t["id"], row=r["n"], url=s["psi_url"])
        lines = [f"Table {t['label']} of {name}: {len(t['rows'])} rows, {len(t['columns'])} columns."]
        for col in t["profile"]:
            if col["type"] == "number":
                lines.append(f"{col['name']}: min {fmt(col['min'])} (row {col['min_row']}), max {fmt(col['max'])} (row {col['max_row']}), mean {fmt(col['mean'])}, {col['n']} values.")
            elif col["filled"] and col["name"].lower() not in ("notes", "comments"):
                top = ", ".join(f"{k} ×{c}" for k, c in col["top"][:6])
                lines.append(f"{col['name']}: {col['distinct']} distinct values; most frequent: {top}.")
        for part in chunks(" ".join(lines), 1400):
            add("table", s["id"], f"{name}, table {t['label']}: column statistics", t["file"], "column statistics computed by IGNIS",
                part, table=t["id"], url=s["psi_url"])
        for h, c in zip(t["columns"], t["rows"][0]["cells"] if t["rows"] else []):
            if h.lower() in ("notes", "comments") and c:
                notes = " ".join(r["cells"][t["columns"].index(h)] for r in t["rows"])
                for part in chunks(notes, 1200):
                    add("table", s["id"], f"{name}, table {t['label']}: notes", t["file"], f"column {h}", part, table=t["id"], url=s["psi_url"])

    # ---- passages: challenge statement, environments, Earth applications
    for i, fact in enumerate(curated.CHALLENGE_FACTS, 1):
        add("challenge", None, "NASA Space Apps challenge statement", "Flame in Freefall challenge statement", f"paragraph {i}", fact["en"], url=curated.CHALLENGE_URL)
        add("challenge", None, "Условие задачи NASA Space Apps", "Flame in Freefall challenge statement", f"абзац {i}", fact["ru"], lang="ru", url=curated.CHALLENGE_URL)
    cov = {c["id"]: c for c in coverage}
    for e in curated.ENVIRONMENTS:
        c = cov[e["id"]]
        st_en = ", ".join(f"{by_id[s]['short']} ({n})" for s, n in c["studies"][:6]) or "none"
        add("environment", None, f"Environment: {e['name']['en']}", "IGNIS coverage map", "computed from all experimental tables",
            f"Target environment {e['name']['en']}: {e['note']['en']} Source: {e['source']['en']} "
            f"Microgravity table records within 3 percentage points of oxygen and 15 kPa of pressure: {c['rows']} (by study: {st_en}). "
            + ("" if c["gravity_ok"] else "No PSI data set was taken at this gravity level; all flight data are microgravity."))
        add("environment", None, f"Среда: {e['name']['ru']}", "IGNIS coverage map", "рассчитано по всем таблицам",
            f"Целевая среда «{e['name']['ru']}»: {e['note']['ru']} Источник: {e['source']['ru']} "
            f"Записей в таблицах в пределах 3 процентных пунктов по кислороду и 15 кПа по давлению: {c['rows']} (по исследованиям: {st_en}). "
            + ("" if c["gravity_ok"] else "Данных PSI при такой гравитации нет: все полётные данные получены в невесомости."), lang="ru")
    for a in curated.EARTH:
        rel = ", ".join(f"{by_id[s]['short']} ({s})" for s in a["studies"])
        add("earth", None, f"Earth application: {a['title']['en']}", a["source"], "IGNIS Earth applications",
            f"{a['title']['en']}. {a['text']['en']} Where: {a['where']['en']}" + (f" Related PSI studies: {rel}." if rel else ""), url=a["url"])
        add("earth", None, f"Применение на Земле: {a['title']['ru']}", a["source"], "раздел «На Земле»",
            f"{a['title']['ru']}. {a['text']['ru']} Где: {a['where']['ru']}" + (f" Связанные исследования PSI: {rel}." if rel else ""), lang="ru", url=a["url"])

    # ---- passages: reading list
    for fname, (title, url) in curated.ARTICLES.items():
        path = READING_ROOT / "articles" / fname
        if path.exists():
            body = re.sub(r"^#.*$|^Источник:.*$|^Full article:.*$", "", path.read_text(encoding="utf-8"), flags=re.M)
            seen = set()
            for i, part in enumerate(chunks(body), 1):
                if part not in seen:
                    seen.add(part)
                    add("article", None, title, f"reading/articles/{fname}", f"part {i}", part, url=url)
    for fname, (title, sids) in curated.FACTSHEETS.items():
        path = READING_ROOT / "factsheets" / "text" / fname
        if path.exists():
            for i, part in enumerate(chunks(path.read_text(encoding="utf-8", errors="replace")), 1):
                add("factsheet", sids[0], title, f"reading/factsheets/{fname.replace('.txt', '.pdf')}", f"part {i}", part, url=curated.FACTSHEET_URL)

    # ---- passages: PDF documents
    n_pdf = 0
    if with_pdf:
        jobs = []
        for sid, folder, name, size, ext, _run in files:
            if ext == "pdf" and folder in DOC_FOLDERS and size > 0:
                jobs.append((sid, folder, name, DATA_ROOT / sid / folder / name))
        guide = RESOURCES_ROOT / "researchers-guide-combustion-in-reduced-gravity-2015.pdf"
        if guide.exists():
            jobs.append((None, "resources", guide.name, guide))
        seen_docs = set()
        with ThreadPoolExecutor(max_workers=8) as pool:
            for (sid, folder, name, path), pages in zip(jobs, pool.map(lambda j: pdf_pages(j[3]), jobs)):
                digest = hashlib.sha1("".join(pages)[:4000].encode()).hexdigest()
                if digest in seen_docs:      # PSI holds several identical copies of some documents
                    continue
                seen_docs.add(digest)
                if sid:
                    s = by_id[sid]
                    title, file, url = f"{s['short']} ({sid}): {doc_title(sid, folder, name)}", f"{sid}/{folder}/{name}", s["psi_url"]
                else:
                    title, file, url = "A Researcher's Guide to: Combustion Science (NASA)", f"resources/{name}", curated.GUIDE_URL
                got = False
                for pno, page in enumerate(pages, 1):
                    for part in chunks(page):
                        if len(part) > 120 and sum(ch.isalpha() for ch in part) > 0.5 * len(part):
                            add("document", sid, title[:160], file, f"page {pno}", part, url=url)
                            got = True
                n_pdf += got

    # ---- quick answers & flight workbench
    from .faq import build_faq
    from .telemetry import build_workbench
    faq = build_faq(studies, tables, points, coverage)
    workbench = build_workbench()

    totals = {
        "studies": len(studies), "flight": sum(s["flight"] for s in studies), "ground": sum(not s["flight"] for s in studies),
        "tables": len(tables), "records": sum(s["stats"]["records"] for s in studies), "tests": sum(s["stats"]["tests"] for s in studies),
        "files": len(files), "bytes": sum(f[3] for f in files), "missing_files": sum(missing.values()),
        "documents": n_pdf, "passages": len(passages), "environments": len(curated.ENVIRONMENTS),
        "publications": sum(len(s["publications"]) for s in studies),
        "traces": len(workbench["traces"]),
        "built": time.strftime("%Y-%m-%d"),
    }

    # ---- write
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DB_PATH.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    db = sqlite3.connect(tmp)
    db.executescript("""
        CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE studies(id TEXT PRIMARY KEY, json TEXT);
        CREATE TABLE tables(id TEXT PRIMARY KEY, study TEXT, json TEXT);
        CREATE TABLE files(study TEXT, folder TEXT, name TEXT, size INTEGER, ext TEXT, run TEXT);
        CREATE INDEX files_study ON files(study, folder);
        CREATE INDEX files_run ON files(study, run);
        CREATE TABLE passages(id INTEGER PRIMARY KEY, kind TEXT, study TEXT, title TEXT, file TEXT, loc TEXT,
                              text TEXT, lang TEXT, tbl TEXT, row INTEGER, url TEXT);
        CREATE VIRTUAL TABLE passages_fts USING fts5(title, text, content='passages', content_rowid='id',
                                                     tokenize='porter unicode61 remove_diacritics 2');
    """)
    db.executemany("INSERT INTO studies VALUES(?,?)", [(s["id"], json.dumps(s, ensure_ascii=False)) for s in studies])
    db.executemany("INSERT INTO tables VALUES(?,?,?)", [(t["id"], t["study"], json.dumps(t, ensure_ascii=False)) for t in tables])
    db.executemany("INSERT INTO files VALUES(?,?,?,?,?,?)", files)
    db.executemany("INSERT INTO passages(kind,study,title,file,loc,text,lang,tbl,row,url) VALUES(?,?,?,?,?,?,?,?,?,?)", passages)
    db.execute("INSERT INTO passages_fts(rowid,title,text) SELECT id,title,text FROM passages")
    for key, value in (("totals", totals), ("points", points), ("coverage", coverage), ("faq", faq),
                       ("workbench", workbench), ("environments", curated.ENVIRONMENTS), ("earth", curated.EARTH),
                       ("groups", curated.GROUPS), ("pillars", curated.PILLARS), ("states", curated.STATES)):
        db.execute("INSERT INTO kv VALUES(?,?)", (key, json.dumps(value, ensure_ascii=False)))
    db.commit()
    db.execute("INSERT INTO passages_fts(passages_fts) VALUES('optimize')")
    db.commit()
    db.execute("VACUUM")
    db.close()
    tmp.replace(DB_PATH)
    kinds = Counter(p[0] for p in passages)
    print(f"built {DB_PATH} in {time.time() - t0:.1f}s, {DB_PATH.stat().st_size / 1e6:.1f} MB")
    print(json.dumps(totals, ensure_ascii=False))
    print("passages:", dict(kinds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
