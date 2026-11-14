"""Search over ignis.db: full-text passages, nearest tested conditions, study ranking.

Russian and English questions go through a small glossary, then SQLite FTS5 (BM25).
Every hit keeps its file and its table row or PDF page.
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
from collections import defaultdict
from dataclasses import dataclass, field

from . import curated
from .config import DB_PATH

WORD = re.compile(r"[a-zа-яё0-9][a-zа-яё0-9₂\-]*", re.I)

STOP = set("""
a an the and or of in on at to for with by from is are was were be been it its this that these those as than then
what which who whom how why when where do does did can could should would will there here about into over under
any some more most much many very also not no yes if but so such via per vs i we you they he she them our your
tell show give find list me please data test tests experiment experiments study studies investigation investigations
и в во на с со к ко по о об от до из у за для при или а но же ли бы не ни что чем как какой какая какое какие каких
каком какую каким где когда почему зачем кто это этот эта эти тот та те так там тут ещё еще уже был была были быть
есть нет да мне нам вам их его её ее они оно она он мы вы ты я то все всё всех про над под без между через также
расскажи покажи найди скажи дай можно нужно ли данные данных данным
""".split())

KIND_WEIGHT = {"summary": 1.3, "challenge": 1.25, "environment": 1.25, "card": 1.15, "table": 1.1, "earth": 1.1,
               "factsheet": 1.0, "article": 1.0, "row": 0.9, "document": 0.85, "publication": 0.7}

BILINGUAL = {"summary", "challenge", "environment", "earth"}

# how a study can be named in a question -> study ids (first id is the primary one)
ALIASES: list[tuple[str, list[str], bool]] = [
    # pattern, ids, case-sensitive
    (r"flex[\s-]?2|flex[\s-]?ii\b|флекс[\s-]?2", ["PSI-68"], False),
    (r"\bflex\b|флекс", ["PSI-69", "PSI-68", "PSI-117", "PSI-142"], False),
    (r"bass[\s-]?(ii|2)\b|басс[\s-]?(ii|2)", ["PSI-25"], False),
    (r"\bbass\b|\bбасс\b", ["PSI-26", "PSI-25", "PSI-62"], False),
    (r"saffire[\s-]?(iii|3)\b", ["PSI-100"], False),
    (r"saffire[\s-]?(ii|2)\b", ["PSI-99"], False),
    (r"saffire[\s-]?(i|1)\b", ["PSI-98"], False),
    (r"saffire|саффир|сапфир|сафир", ["PSI-98", "PSI-99", "PSI-100"], False),
    (r"same[\s-]?r\b", ["PSI-101"], False),
    (r"\bSAME\b", ["PSI-102", "PSI-101", "PSI-115"], True),
    (r"\bdaft|дафт", ["PSI-47"], False),
    (r"\bSLICE\b|\bслайс", ["PSI-106"], True),
    (r"\bSPICE\b|\bспайс", ["PSI-107", "PSI-60"], True),
    (r"cfi[\s-]?g\b", ["PSI-159"], False),
    (r"\bcfi\b", ["PSI-39", "PSI-159"], False),
    (r"\bBRE\b|burning rate emulator", ["PSI-20"], True),
    (r"\bcld\b|coflow laminar", ["PSI-21"], False),
    (r"e[\s-]?field|электрическ\w* пол", ["PSI-22"], False),
    (r"s[\s-]flame", ["PSI-23"], False),
    (r"flame design", ["PSI-10"], False),
    (r"\bacme\b|\bакме\b", ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"], False),
]

_O2 = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:%|процент\w*|percent)\s*(?:кислород\w*|o2|o₂|oxygen)|(?:кислород\w*|o2|o₂|oxygen)\D{0,14}?(\d+(?:[.,]\d+)?)\s*(?:%|процент|percent)", re.I)
_P = re.compile(r"(\d+(?:[.,]\d+)?)\s*(кпа|kpa|psia|psi|атм|atm|бар|bar)", re.I)
P_UNIT = {"кпа": 1.0, "kpa": 1.0, "psi": 6.89476, "psia": 6.89476, "атм": 101.325, "atm": 101.325, "бар": 100.0, "bar": 100.0}


@dataclass
class Query:
    text: str
    concepts: list[list[str]] = field(default_factory=list)   # one list of alternative terms per meaningful word
    studies: list[str] = field(default_factory=list)          # studies named in the question
    o2: float | None = None
    p: float | None = None
    shown: list[str] = field(default_factory=list)            # human-readable matched terms

    @property
    def empty(self) -> bool:
        return not self.concepts and not self.studies


def glossary_lookup(word: str) -> list[str]:
    if word in curated.EXACT:
        return curated.GLOSSARY.get(word, [])
    best = ""
    for key in curated.GLOSSARY:
        if key not in curated.EXACT and word.startswith(key) and len(key) > len(best):
            best = key
    return curated.GLOSSARY.get(best, []) if best else []


def parse(question: str, extra_terms: list[str] | None = None) -> Query:
    q = Query(text=question)
    for pattern, ids, cased in ALIASES:
        if re.search(pattern, question, 0 if cased else re.I):
            for sid in ids:
                if sid not in q.studies:
                    q.studies.append(sid)
    for m in re.finditer(r"psi[\s-]?(\d{1,3})\b", question, re.I):
        sid = f"PSI-{m.group(1)}"
        if sid in curated.STUDIES and sid not in q.studies:
            q.studies.insert(0, sid)
    m = _O2.search(question)
    if m:
        q.o2 = float((m.group(1) or m.group(2)).replace(",", "."))
    m = _P.search(question)
    if m:
        q.p = round(float(m.group(1).replace(",", ".")) * P_UNIT[m.group(2).lower()], 1)
    seen = set()
    for raw in WORD.findall(question.lower().replace("ё", "е")):
        word = raw.strip("-")
        if len(word) < 2 or word in STOP or word in seen or re.fullmatch(r"psi-?\d*", word):
            continue
        seen.add(word)
        if re.search(r"[а-я]", word):
            english = glossary_lookup(word)
            stem = word[:max(4, len(word) - 2)] if len(word) > 4 else word
            q.concepts.append(english + [stem + "*"])
            q.shown.append(f"{raw} → {', '.join(english)}" if english else raw)
        elif word.isdigit():
            if len(word) <= 4:
                q.concepts.append([word])
        else:
            q.concepts.append([word])
            q.shown.append(word)
    for term in extra_terms or []:
        term = term.strip().lower()
        if term and term not in STOP and all(term not in c for c in q.concepts):
            q.concepts.append([term])
    return q


def fts_term(term: str) -> str | None:
    if term.endswith("*"):
        core = re.sub(r"[^a-zа-яё0-9]", "", term[:-1], flags=re.I)
        return f"{core}*" if len(core) >= 3 else None
    core = re.sub(r'["*]', "", term).strip()
    return f'"{core}"' if core else None


def fts_query(q: Query) -> str:
    parts = []
    for concept in q.concepts:
        for term in concept:
            t = fts_term(term)
            if t and t not in parts:
                parts.append(t)
    return " OR ".join(parts)


def concept_hits(q: Query, text: str) -> int:
    low = text.lower()
    n = 0
    for concept in q.concepts:
        for term in concept:
            probe = term.rstrip("*").lower()
            probe = probe if len(probe) <= 5 or term.endswith("*") else probe[:max(5, len(probe) - 2)]
            if probe and probe in low:
                n += 1
                break
    return n


class Index:
    def __init__(self, path=DB_PATH):
        self.path = str(path)
        db = self.connect()
        self.studies = {sid: json.loads(js) for sid, js in db.execute("SELECT id, json FROM studies")}
        self.order = sorted(self.studies, key=lambda s: int(s.split("-")[1]))
        self.tables = {tid: json.loads(js) for tid, js in db.execute("SELECT id, json FROM tables")}
        self.kv = {k: json.loads(v) for k, v in db.execute("SELECT key, value FROM kv")}
        self.points = self.kv["points"]
        self.envs = {e["id"]: e for e in self.kv["environments"]}
        db.close()

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        return db

    # ------------------------------------------------------------------ passages
    def search(self, q: Query, lang: str = "en", limit: int = 10, scope_table: str | None = None,
               scope_study: str | None = None, per_group: int = 3) -> list[dict]:
        match = fts_query(q)
        db = self.connect()
        rows = []
        try:
            if match:
                sql = ("SELECT p.*, bm25(passages_fts, 2.5, 1.0) AS rank FROM passages_fts "
                       "JOIN passages p ON p.id = passages_fts.rowid WHERE passages_fts MATCH ? ")
                args: list = [match]
                if scope_table:
                    sql += "AND p.tbl = ? "
                    args.append(scope_table)
                elif scope_study:
                    sql += "AND p.study = ? "
                    args.append(scope_study)
                sql += "ORDER BY rank LIMIT 400"
                rows = [dict(r) for r in db.execute(sql, args)]
            # a question that only names a study still deserves that study's summary
            for sid in ([scope_study] if scope_study else q.studies[:3]):
                have = {r["id"] for r in rows}
                for r in db.execute("SELECT *, -1.0 AS rank FROM passages WHERE study = ? AND kind IN ('summary','card') "
                                    "AND (kind = 'card' OR lang = ?) LIMIT 6", (sid, lang)):
                    if r["id"] not in have:
                        rows.append(dict(r))
        finally:
            db.close()
        total = max(1, len(q.concepts))
        scored = []
        for r in rows:
            if r["kind"] in BILINGUAL and r["lang"] != lang:   # the same text exists in the reader's language
                continue
            hits = concept_hits(q, f"{r['title']} {r['text']}")
            score = -r["rank"] * KIND_WEIGHT.get(r["kind"], 1.0) * (0.35 + 0.65 * hits / total)
            if r["study"] and r["study"] in q.studies:
                score *= 1.9 if r["study"] == q.studies[0] else 1.5
            r["score"], r["hits"] = score, hits
            scored.append(r)
        scored.sort(key=lambda r: -r["score"])
        out, per, seen_text = [], defaultdict(int), set()
        for r in scored:
            key = (r["study"], r["kind"] if r["kind"] != "row" else r["tbl"])
            fingerprint = r["text"][:160]
            if per[key] >= per_group or fingerprint in seen_text:
                continue
            per[key] += 1
            seen_text.add(fingerprint)
            out.append(r)
            if len(out) >= limit:
                break
        return out

    # ------------------------------------------------------------------ nearest tested conditions
    def nearest_rows(self, o2: float | None, p: float | None, k: int = 6) -> list[dict]:
        if o2 is None and p is None:
            return []
        best: dict[tuple, tuple] = {}
        for pt in self.points:
            if pt["b"] != "ambient" or pt["m"]:
                continue
            if p is not None and pt["p"] is None:
                continue
            d = math.hypot((pt["o2"] - o2) / 5 if o2 is not None else 0, (pt["p"] - p) / 20 if p is not None else 0)
            key = (pt["t"], pt["r"])
            if key not in best or d < best[key][0]:
                best[key] = (d, pt)
        ranked = sorted(best.values(), key=lambda x: x[0])
        out, per_study = [], defaultdict(int)
        for d, pt in ranked:
            if per_study[pt["s"]] >= 2:
                continue
            per_study[pt["s"]] += 1
            out.append({"dist": round(d, 2), **pt})
            if len(out) >= k:
                break
        return out

    def row_passage(self, table_id: str, row_no: int) -> dict | None:
        db = self.connect()
        try:
            r = db.execute("SELECT * FROM passages WHERE kind = 'row' AND tbl = ? AND row = ?", (table_id, row_no)).fetchone()
            return dict(r) if r else None
        finally:
            db.close()

    def table_passages(self, table_id: str) -> list[dict]:
        db = self.connect()
        try:
            return [dict(r) for r in db.execute("SELECT * FROM passages WHERE kind = 'table' AND tbl = ? ORDER BY id", (table_id,))]
        finally:
            db.close()

    # ------------------------------------------------------------------ study ranking
    def rank_studies(self, q: Query | None, env_id: str | None, lang: str = "en") -> list[dict]:
        text_score: dict[str, float] = defaultdict(float)
        evidence: dict[str, list] = defaultdict(list)
        if q and not q.empty:
            hits = self.search(q, lang=lang, limit=120, per_group=4)
            per: dict[str, list] = defaultdict(list)
            for h in hits:
                if h["study"]:
                    per[h["study"]].append(h)
            for sid, hs in per.items():
                top = sorted(hs, key=lambda h: -h["score"])[:3]
                text_score[sid] = sum(h["score"] * w for h, w in zip(top, (1.0, 0.5, 0.25)))
                evidence[sid] = top
            for sid in q.studies:
                text_score[sid] = text_score.get(sid, 0) + 1e-6
        peak = max(text_score.values(), default=0)
        out = []
        for sid in self.order:
            s = self.studies[sid]
            rel = text_score.get(sid, 0) / peak if peak else 0.0
            prox = s["proximity"][env_id]["score"] / 10 if env_id in self.envs else None
            if q and not q.empty and prox is not None:
                score = 0.75 * rel + 0.25 * prox if rel else 0.0
            elif q and not q.empty:
                score = rel
            elif prox is not None:
                score = prox
            else:
                score = s["safety"] / 3
            out.append({
                "id": sid, "score": round(score * 100), "relevance": round(rel * 100) if q and not q.empty else None,
                "proximity": s["proximity"][env_id] if env_id in self.envs else None,
                "evidence": [{"kind": h["kind"], "title": h["title"], "file": h["file"], "loc": h["loc"],
                              "snippet": snippet(h["text"], q), "table": h["tbl"], "row": h["row"]} for h in evidence.get(sid, [])],
            })
        out.sort(key=lambda r: (-r["score"], -self.studies[r["id"]]["safety"], int(r["id"].split("-")[1])))
        return out


def snippet(text: str, q: Query | None, size: int = 260) -> str:
    """A window of the passage around the first matched term."""
    if len(text) <= size:
        return text
    pos = -1
    if q:
        low = text.lower()
        for concept in q.concepts:
            for term in concept:
                probe = term.rstrip("*").lower()
                i = low.find(probe) if probe else -1
                if i >= 0 and (pos < 0 or i < pos):
                    pos = i
    if pos < 0:
        return text[:size].rsplit(" ", 1)[0] + "…"
    start = max(0, pos - size // 3)
    if start:
        start = text.find(" ", start) + 1
    end = min(len(text), start + size)
    cut = text[start:end]
    if end < len(text):
        cut = cut.rsplit(" ", 1)[0] + "…"
    return ("…" if start else "") + cut
