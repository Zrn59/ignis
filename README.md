# IGNIS — Flame in Freefall

A fire-safety workbench for crewed habitats, built on NASA PSI microgravity combustion data. Team sulateam, NASA Space Apps Challenge 2026.

We put 24 combustion investigations, 22 test tables, 135 documents and raw flight sensor recordings into one SQLite database. The site shows which experiments come closest to the atmosphere of the ISS, a lunar base, a pressurized rover, Mars or a spacesuit, where there is no data at all, and answers questions from the archive only, with a link to the file, table row or PDF page behind every claim.

The interface is available in English and Russian.

## Team

| | Role | GitHub |
|---|---|---|
| Arsen | Presentation, site design, planning | [arsenkaldybaev2009-svg](https://github.com/arsenkaldybaev2009-svg) |
| Vadim | Backend, data collection and analysis, hosting | [Zrn59](https://github.com/Zrn59) |
| Erhan | Frontend | [kiber9](https://github.com/MOSTRACISTPERSONINTHEWORLD) |
| Alikhan | Presentation, support, tester | [Allikhan166](https://github.com/Allikhan166) |

How we worked, what we used and where AI helped: [docs/REPORT.md](docs/REPORT.md).

## Running it

```bash
./run.sh setup    # Python and Node dependencies
./run.sh serve    # site on http://127.0.0.1:8000, API docs on /docs
```

All the site needs is `data/ignis.db` (16 MB, included) and the built `frontend/dist`. Other commands:

```bash
./run.sh build    # rebuild data/ignis.db from ../pre_nasa (--no-pdf skips PDF text, faster)
./run.sh web      # build the frontend
./run.sh dev      # API on :8000 and Vite with hot reload on :5173
```

## What's on the site

| Section | What it does |
| --- | --- |
| Overview | Flame model for the chosen habitat, pressure-vs-oxygen map of every test, the five most useful investigations, the Saffire-III fire recording, quick answers |
| Investigations | Ranked for the chosen habitat with a transparent four-part score, topic search in English and Russian, filters |
| Atmosphere | Calculator: oxygen, pressure, gravity, flow → pO₂, warnings, nearest tested table rows; parameters live in the URL |
| Telemetry | Six flight recordings with playback, 0 g / 1 g smoke particle distributions, modeling datasets as CSV |
| Compare | Up to four investigations side by side with differences highlighted |
| Tables | Every PSI table as it is: view, filter, CSV, ask about a table |
| Assistant | Answers from the archive with [n] citations and automatic number checks |

`Ctrl K` or `/` opens quick navigation to any investigation, table or section.

## How assistant answers are checked

Question → database search (`backend/search.py`: SQLite FTS5 plus a Russian-English glossary; questions about a measured value also get the statistics of the matching table column and the rows with its extreme values) → the model sees only the retrieved passages and must cite them as `[n]` → the code checks every sentence: the citations exist, and every number is present in the very passage that sentence cites. The result of the check is shown under the answer. If the model cites nothing or is unavailable, the passages themselves are shown. The rest of the site works without a model key.

Search quality: `.venv/bin/python -m backend.eval_search` (21 questions, runs offline).

## Source data

`data/ignis.db` is already in the repository. To rebuild it from the PSI archive (about 13 GB):

```bash
pip install requests
python scripts/download_combustion_data.py --out "$PWD/../pre_nasa/data"   # photos and video are skipped
./run.sh build
```

## Configuration

Read from the environment or `.env` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter key for the assistant |
| `OPENROUTER_MODELS` | comma-separated models; queried two at a time, the first usable answer wins |
| `IGNIS_DATA_ROOT` | path to the raw PSI archive (default `../pre_nasa`), only needed for `build` |
| `IGNIS_DB` | database path (default `data/ignis.db`) |
| `HOST`, `PORT` | server address for `run.sh` |

## Layout

```
backend/
  build.py        builds the database: records, tables, files, PDF text, search index
  normalize.py    per-table rules: oxygen in %, pressure in kPa, flow, dates, fuel
  curated.py      bilingual study descriptions, crew habitats, Earth applications, glossary
  faq.py          quick answers; numbers are computed from the tables at build time
  telemetry.py    flight sensor recordings, smoke distributions, modeling tables
  scoring.py      habitat proximity score and atmosphere calculator
  search.py       search, nearest tested conditions, study ranking
  ai.py           model calls and answer checks
  eval_search.py  offline search regression questions
  app.py          FastAPI: /api/* and the built site
frontend/src/
  api.ts          API types and client
  i18n.ts         every UI string in English and Russian, number and date formatting
  store.tsx       routing, language, chosen habitat, compare list
  components/     flame, atmosphere map, telemetry, table viewer, assistant answers, shared UI
  pages/          one file per section
data/ignis.db     the built database
docs/             project report and the challenge brief
scripts/          PSI archive downloader
```

## License

Code: MIT, see [LICENSE](LICENSE). Data: NASA Physical Sciences Informatics, CC0. Images are NASA material; sources are credited on the site and in the [report](docs/REPORT.md). This is not an official NASA website.
