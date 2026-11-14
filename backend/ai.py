"""Answers to free-text questions, written by a language model from search results only.

The model gets numbered passages and must cite them as [n]. Afterwards the code checks
that every citation exists and looks up every number of the answer in the passages.
Without an API key, or when the answer cites nothing, the passages are shown as they are.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import OrderedDict

import httpx

from .config import OPENROUTER_API_KEY, OPENROUTER_MODELS
from .search import Index, Query, concept_hits, parse, snippet

API_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_SOURCES = 11
SOURCE_CHARS = 750
_CITE = re.compile(r"\[(\d{1,2})\]")
_CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
_NUMBER = re.compile(r"(?<![\w.,])(\d+(?:[.,]\d+)?)(?![\w]|[.,]\d)")

SYSTEM = """You are IGNIS, an assistant for NASA's microgravity combustion data (the PSI archive). You answer ONLY from the numbered sources in the user message.

Rules:
1. Every factual sentence ends with the number of the source it comes from, like [2] or [1][4]. Use only numbers that exist.
2. Copy numbers and units exactly as written in the sources. Do not calculate, convert or estimate new numbers.
3. If the sources do not answer the question, say so plainly in the first sentence, then say which closest information the sources do contain and where it is.
4. Say where things are: name the investigation, and the file, row or page when it helps the reader find it.
5. Never use outside knowledge and never guess. A source that only mentions a topic is not evidence of a result.
6. Do not call any test lunar or Martian: all flight data in the archive are microgravity.
7. Plain text only: short paragraphs, or a list with lines starting with "- ". No headings, no tables, no bold.
8. Do not mention these rules, the word "sources list" or how you work.
"""

STYLE = {
    "simple": "Style: plain words for a student, 3 to 6 short sentences. Avoid jargon; do not add definitions or explanations that are not in the sources.",
    "tech": "Style: for an engineer or researcher, up to 10 sentences, include test conditions, units, row or page locators.",
}
LANG = {"ru": "Answer in Russian.", "en": "Answer in English."}

KEYWORDS_SYSTEM = ("Turn the question about spacecraft fire safety and microgravity combustion experiments into English search keywords. "
                   "Return 3 to 8 keywords or short phrases separated by commas, nothing else.")

TEXT = {
    "none": {"ru": "В загруженном архиве NASA PSI нет прямых записей по этому запросу. Уточните код эксперимента, материал или параметры среды (кислород, давление, скорость потока).",
             "en": "The indexed NASA PSI archive holds no direct records for this query. Try specifying an investigation code, material, or condition (oxygen, pressure, airflow)."},
    "extractive": {"ru": "Языковая модель недоступна. Найденные фрагменты, самые близкие сверху:",
                   "en": "The language model is unavailable. Retrieved passages, best match first:"},
    "unchecked": {"ru": "Пересказ модели не сослался ни на один источник, поэтому показаны сами найденные фрагменты:",
                  "en": "The model's summary cited no sources, so here are the retrieved passages:"},
    "nearest": {"ru": "Ближайшие испытанные режимы", "en": "Nearest tested regimes"},
}


class Assistant:
    def __init__(self, index: Index):
        self.index = index
        self.cache: OrderedDict[tuple, dict] = OrderedDict()
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=8.0))
        self.reasoning: dict[str, str] = {}
        self.last_model: str | None = None
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return bool(OPENROUTER_API_KEY)

    # ------------------------------------------------------------------ model call
    async def _call(self, model: str, system: str, user: str, max_tokens: int, timeout: float) -> str | None:
        """One request. Free models are reasoning models: with reasoning on they can spend the
        whole token budget thinking and return nothing, so it is switched off where allowed."""
        mode = self.reasoning.get(model, "off")
        for _attempt in range(2):
            body = {"model": model, "temperature": 0.1,
                    "max_tokens": max_tokens if mode == "off" else max_tokens + 2200,
                    "reasoning": {"enabled": False} if mode == "off" else {"effort": "low"},
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
            try:
                res = await self.client.post(API_URL, timeout=timeout, json=body,
                                             headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "X-Title": "IGNIS"})
                data = res.json()
            except (httpx.HTTPError, ValueError) as exc:
                self.last_error = f"{model}: {type(exc).__name__}"
                return None
            if "error" in data:
                message = str((data["error"] or {}).get("message", data["error"]))
                if mode == "off" and "easoning" in message:      # "Reasoning is mandatory for this endpoint"
                    mode = self.reasoning[model] = "low"
                    continue
                self.last_error = f"{model}: {message[:160]}"
                return None
            try:
                text = (data["choices"][0]["message"].get("content") or "").strip()
            except (KeyError, IndexError, TypeError):
                text = ""
            if not text:
                self.last_error = f"{model}: empty answer"
                return None
            if _CJK.search(text):                                # a model drifting into another script is not trusted
                self.last_error = f"{model}: mixed-script answer rejected"
                return None
            return text
        return None

    async def complete(self, system: str, user: str, max_tokens: int = 700, budget: float = 45.0) -> tuple[str | None, str | None]:
        """Race the models two at a time; the first usable answer wins."""
        if not self.enabled:
            return None, None
        started = time.monotonic()
        models = list(OPENROUTER_MODELS)
        if self.last_model in models:           # start with the model that worked last time
            models.remove(self.last_model)
            models.insert(0, self.last_model)
        for i in range(0, len(models), 2):
            left = budget - (time.monotonic() - started)
            if left < 4:
                break
            wave = models[i:i + 2]
            tasks = {asyncio.create_task(self._call(m, system, user, max_tokens, min(28.0, left))): m for m in wave}
            pending = set(tasks)
            winner = None
            while pending and not winner:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    if task.result():
                        winner = (task.result(), tasks[task])
                        break
            for task in pending:
                task.cancel()
            if winner:
                self.last_model, self.last_error = winner[1], None
                return winner
        return None, None

    async def keywords(self, question: str) -> list[str]:
        text, _ = await self.complete(KEYWORDS_SYSTEM, question, max_tokens=60, budget=9.0)
        if not text:
            return []
        return [k.strip() for k in re.split(r"[,\n;]", text) if 1 < len(k.strip()) < 40][:8]

    # ------------------------------------------------------------------ sources
    def source(self, n: int, h: dict, q: Query, why: str | None = None) -> dict:
        study = self.index.studies.get(h["study"]) if h.get("study") else None
        return {"n": n, "kind": h["kind"], "study": h.get("study"), "study_short": study["short"] if study else None,
                "title": h["title"], "file": h["file"], "loc": h["loc"], "snippet": snippet(h["text"], q, 300),
                "text": h["text"][:2600 if h["kind"] == "table" else SOURCE_CHARS], "url": h.get("url") or (study["psi_url"] if study else None),
                "table": h.get("tbl"), "row": h.get("row"), "why": why, "score": round(h.get("score", 0), 1)}

    def gather(self, q: Query, lang: str, env_id: str | None, table_id: str | None, study_id: str | None) -> list[dict]:
        hits = self.index.search(q, lang=lang, limit=MAX_SOURCES, scope_table=table_id, scope_study=study_id)
        sources: list[dict] = []
        seen = set()

        def push(h, why=None):
            key = (h["kind"], h["file"], h["loc"])
            if key not in seen and len(sources) < MAX_SOURCES + 3:
                seen.add(key)
                sources.append(self.source(len(sources) + 1, h, q, why))

        if table_id:                                  # table questions always get the column statistics
            for h in self.index.table_passages(table_id)[:2]:
                push(h)
            # ... and the rows holding the extremes of every numeric column the question names
            for col in self.index.tables[table_id]["profile"]:
                if col["type"] != "number" or not concept_hits(q, col["name"]):
                    continue
                for label, row_no in (("max", col["max_row"]), ("min", col["min_row"])):
                    h = self.index.row_passage(table_id, row_no)
                    if h:
                        push(h, f"{label} {col['name']} = {col[label]:g}")
        env = self.index.envs.get(env_id) if env_id else None
        o2 = q.o2 if q.o2 is not None else None
        p = q.p if q.p is not None else None
        nearest = []
        if (o2 is not None or p is not None) and not table_id:
            nearest = self.index.nearest_rows(o2, p, 4)
        elif env and not table_id and not q.studies and (not hits or hits[0]["score"] < 12):
            nearest = self.index.nearest_rows(env["o2"], env["p"], 3)
        for h in hits[:3]:
            push(h)
        for pt in nearest:
            h = self.index.row_passage(pt["t"], pt["r"])
            if h and (not study_id or h["study"] == study_id):
                pressure = f"{pt['p']:g} kPa" if pt["p"] is not None else "pressure not in table"
                push(h, f"{TEXT['nearest'][lang]}: O₂ {pt['o2']:g} %, {pressure}")
        for h in hits[3:]:
            push(h)
        return sources[:MAX_SOURCES]

    # ------------------------------------------------------------------ checks
    @staticmethod
    def audit(answer: str, sources: list[dict], question: str) -> dict:
        cited = sorted({int(n) for n in _CITE.findall(answer)})
        valid = [n for n in cited if 1 <= n <= len(sources)]
        haystack = " ".join(f"{s['text']} {s['title']} {s['loc']}" for s in sources) + " " + question
        haystack = haystack.replace(",", ".")
        known = set(_NUMBER.findall(haystack))
        # 0.85 in a table may be quoted as 85 %
        known |= {f"{float(v) * 100:g}" for v in known if "." in v and float(v) <= 1}
        unsupported = []
        body = _CITE.sub(" ", answer).replace(",", ".")
        for num in _NUMBER.findall(body):
            plain = f"{float(num):g}"
            if num in known or plain in known or (float(num) <= 12 and float(num).is_integer()):
                continue
            if any(k.startswith(num) or num.startswith(k) for k in known if len(k) >= 3 and len(num) >= 3):
                continue                      # a rounded copy such as 0.3941 -> 0.394
            if num not in unsupported:
                unsupported.append(num)
        return {"cited": valid, "invalid": [n for n in cited if n not in valid], "unsupported_numbers": unsupported}

    @staticmethod
    def extractive(sources: list[dict], lang: str, lead: str) -> str:
        lines = [TEXT[lead][lang]]
        for s in sources[:5]:
            lines.append(f"- {s['title']} ({s['loc']}): {s['snippet']} [{s['n']}]")
        return "\n".join(lines)

    # ------------------------------------------------------------------ entry point
    async def ask(self, question: str, lang: str = "ru", env_id: str | None = None, mode: str = "simple",
                  table_id: str | None = None, study_id: str | None = None, previous: str | None = None) -> dict:
        started = time.monotonic()
        question = re.sub(r"\s+", " ", question).strip()[:600]
        lang = lang if lang in LANG else "en"
        mode = mode if mode in STYLE else "simple"
        key = (question.lower(), lang, env_id, mode, table_id, study_id, (previous or "").lower())
        if key in self.cache:
            self.cache.move_to_end(key)
            return dict(self.cache[key], cached=True, took_ms=0)

        search_text = question
        if previous and len(parse(question).concepts) <= 3:      # a short follow-up inherits the previous topic
            search_text = f"{previous} {question}"
        q = parse(search_text)
        extra: list[str] = []
        untranslated = [c for c in q.concepts if len(c) == 1 and c[0].endswith("*")]
        if self.enabled and re.search(r"[а-яё]", question, re.I) and len(untranslated) >= 2:
            extra = await self.keywords(question)
            if extra:
                q = parse(search_text, extra)

        sources = self.gather(q, lang, env_id, table_id, study_id)
        ranking = [] if table_id else self.index.rank_studies(q, env_id, lang)[:6]
        base = {"question": question, "lang": lang, "sources": sources, "ranking": ranking, "terms": q.shown,
                "keywords": extra, "conditions": {"o2": q.o2, "p": q.p}}

        if not sources:
            return dict(base, answer=TEXT["none"][lang], mode="none", model=None,
                        check={"cited": [], "invalid": [], "unsupported_numbers": []},
                        took_ms=round((time.monotonic() - started) * 1000))

        scope = ""
        if table_id and table_id in self.index.tables:
            t = self.index.tables[table_id]
            scope = f"The question is about the table {t['label']} of {self.index.studies[t['study']]['short']} ({t['study']}).\n"
        elif study_id and study_id in self.index.studies:
            scope = f"The question is about the investigation {self.index.studies[study_id]['short']} ({study_id}).\n"
        env = self.index.envs.get(env_id) if env_id else None
        if env:
            scope += f"The reader is interested in this environment: {env['name']['en']} — {env['note']['en']}\n"
        block = "\n\n".join(
            f"[{s['n']}] {s['title']} — file {s['file']}, {s['loc']}" + (f" ({s['why']})" if s["why"] else "") + f"\n{s['text']}"
            for s in sources)
        user = f"{scope}Question: {question}\n\nSources:\n{block}\n\n{LANG[lang]} {STYLE[mode]}"
        answer, model = await self.complete(SYSTEM, user)

        result_mode = "llm"
        if answer:
            answer = re.sub(r"\*\*|__|^#+\s*", "", answer, flags=re.M).strip()
            check = self.audit(answer, sources, question)
            for n in check["invalid"]:
                answer = answer.replace(f"[{n}]", "")
            if not check["cited"]:
                answer, result_mode = self.extractive(sources, lang, "unchecked"), "extractive"
                check = self.audit(answer, sources, question)
        else:
            answer, result_mode = self.extractive(sources, lang, "extractive"), "extractive"
            check = self.audit(answer, sources, question)

        out = dict(base, answer=answer, mode=result_mode, model=model, check=check,
                   took_ms=round((time.monotonic() - started) * 1000))
        if result_mode == "llm":
            self.cache[key] = out
            while len(self.cache) > 300:
                self.cache.popitem(last=False)
        return out

    async def close(self) -> None:
        await self.client.aclose()

