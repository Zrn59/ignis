# IGNIS — project report, team sulateam

NASA Space Apps Challenge 2026, “Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data”.

The hackathon rules ask teams to list the data, materials, libraries and AI tools they used. This report does that, and also explains how we worked as a team, who did what, and where AI fit in.

State as of 15 November 2026.

## Team and roles

There are four of us. We split the work by area. Everyone owned their part, but we made the big decisions together: what goes on the home page, how the proximity score works, where to say plainly that there is no data.

| Member | Role | What they did | GitHub |
|---|---|---|---|
| Arsen | Presentation, site design, planning | Planned the project and the schedule, made the Figma mockup and the visual direction, built the presentation. | [arsenkaldybaev2009-svg](https://github.com/arsenkaldybaev2009-svg) |
| Vadim | Backend, data collection and analysis, hosting | Downloaded and checked the PSI archive, decided which tables and sensor recordings to use, built the database, search and the assistant, runs the server. | [Zrn59](https://github.com/Zrn59) |
| Erhan | Frontend | Built the interface: pages, charts, the atmosphere map, telemetry player, mobile layout. | [KiBeR9](https://github.com/KiBeR9) |
| Alikhan | Presentation support, testing | Helped with the presentation, went through the site as an outsider, tried the assistant with real questions and reported what was confusing or wrong. | [Allikhan166](https://github.com/Allikhan166) |

## How we worked

We started by reading the challenge together and writing a short brief (`docs/challenge-brief.txt`): the challenge text, where the data lives and a link to the mockup. Arsen drew a rough design in Figma before anyone wrote code.

After that we worked in short loops:

1. Talk through what is inconvenient or unclear in the current version and what to change. Testing notes from Alikhan were usually the starting point.
2. Split the tasks by role.
3. Make the changes. We wrote code with AI coding assistants (see section 5): we described the task, read what came back, then fixed it by hand or threw it away.
4. Check in the browser on desktop and phone. Ask the assistant our own questions and look at what it cites.
5. Merge into `main` and deploy to our server.

Decisions we argued about the longest:

- **The Moon and Mars.** PSI has no partial-gravity data. We decided not to fake a calculation where there is none. The site always presents the Moon and Mars as bounded between 0 g and 1 g.
- **The assistant must not be trusted on its word.** It answers only from retrieved passages, every sentence carries a citation, and numbers are checked against the source automatically. When the model is down, the site shows the passages instead of an empty box.
- **The proximity score.** We did not want a black box, so the score is split into four parts and each part is visible.
- **Design.** The first version looked like a generic template. We moved on purpose to a style close to nasa.gov: black, white, one red accent, real photos from the archive instead of placeholders. NASA logos are not used.
- **Questions about measured values.** In testing we noticed that such questions were answered from PDFs rather than from the tables. We reworked search so it finds the right table column, and wrote a set of control questions (`backend/eval_search.py`) so it does not break again.

## 1. NASA data

### Physical Sciences Informatics (PSI), Combustion Science

The main source is https://psi.nasa.gov/physci/repo/search?q=combustion, the one named in the challenge.

We downloaded the archive with our own script (`scripts/download_combustion_data.py`). The last check against the live PSI catalog was on 14 November 2026: still 24 investigations, nothing new. What we ended up with:

- 22,311 files, 12.8 GB: test tables, sensor recordings, reports, papers, presentations, investigation records.
- No photos, video or camera-frame archives. The full archive of these investigations is about 13.5 TB, almost all of it imagery.
- 2,623 files are listed in the catalog, but NASA storage returns 404 for them. We do not hide this: every investigation page on the site shows what is missing.
- PSI data is licensed CC0 1.0. The exception is PSI-10, whose license field is empty.

| ID | Investigation | Where | Tests | Tables |
|---|---|---|---:|---:|
| PSI-10 | ACME Flame Design | ISS | 327 | 2 |
| PSI-20 | ACME BRE | ISS | 194 | 1 |
| PSI-21 | ACME CLD Flame | ISS | 344 | 1 |
| PSI-22 | ACME E-FIELD Flames | ISS | 230 | 1 |
| PSI-23 | ACME s-Flame | ISS | 276 | 1 |
| PSI-25 | BASS-II | ISS | 129 | 1 |
| PSI-26 | BASS | ISS | 122 | 1 |
| PSI-39 | CFI | ISS | 87 | 1 |
| PSI-47 | DAFT / DAFT-2 | ISS | 2 | 1 |
| PSI-60 | SPICE data analysis | ground | — | — |
| PSI-62 | BASS flame-spread model | ground | — | — |
| PSI-68 | FLEX-2 | ISS | — | 1 |
| PSI-69 | FLEX | ISS | 274 | 1 |
| PSI-98 | Saffire-I | Cygnus | 2 | 1 |
| PSI-99 | Saffire-II | Cygnus | 9 | 1 |
| PSI-100 | Saffire-III | Cygnus | 2 | 1 |
| PSI-101 | SAME-R | ISS | 109 | 1 |
| PSI-102 | SAME | ISS | 8 | 1 |
| PSI-106 | SLICE | ISS | 12 | 1 |
| PSI-107 | SPICE | ISS | 469 | 1 |
| PSI-115 | SAME smoke model | ground | — | — |
| PSI-117 | FLEX cool-flame CFD | ground | — | — |
| PSI-142 | Cool-flame limits | ground | — | 1 |
| PSI-159 | ACME CFI-G | ISS | 333 | 2 |

In total: 24 investigations (19 flight, 5 ground), 22 tables and 2,929 tests. We also index the text of 135 PDF documents and 352 publications listed in the records.

For the Telemetry section we picked six flight sensor recordings:

- `PSI-100/Raw Data/PSI-100_Raw Data_Saffire III Sample 1 Sensors.xlsx`
- `PSI-99/Raw Data/PSI-99_Raw Data_Saffire Sensor Data Sample 5.xlsx`
- `PSI-69/Raw Data/PSI-69_Raw Data_FLEX-035_DropletData.txt` (plus FLEX-010 and FLEX-235)
- `PSI-22/Raw Data/PSI-22_Raw Data_18073A3_data.csv`
- `PSI-20/Raw Data/PSI-20_Raw Data_19039A1_data.csv`
- `PSI-159/Raw Data/PSI-159_Raw Data_21202A1_data.csv`

The 0 g and 1 g smoke particle distributions come from the PSI-115 grids (`.dat` files in Analyzed Data).

### Materials from the challenge resource list

- **A Researcher’s Guide to International Space Station Combustion Science** (NASA, 2015, NP-2015-10-034-JSC). Its text is searchable by the assistant, and the site’s illustrations come from it.
- **NASA Combustion Science page** (Glenn): searchable text.
- **Experiment fact sheets, July 2025:** ACME, BASS, DAFT, FLEX, Saffire, SAME, SLICE, SPICE. Searchable text and links on the site.
- **Apollo 1 and Apollo 13** (NASA SMA) and **“25 Years Ago: Fire Aboard Space Station Mir”**: the “From Apollo 1 to Artemis II” timeline and searchable text.
- **NASA Spinoff:** Fireman’s Air Tanks, Fire Detector, New Technology for the Fire Attire: the “On Earth” section.
- **The challenge statement:** the Artemis II crew quote and the lunar-base atmosphere parameters.

The ScienceCasts video was not used in the project.

## 2. Images

There are no NASA logos on the site, and the footer says it is not an official NASA resource.

All 14 photos in `frontend/public/img/` are NASA material. Every photo on the site has a caption and a source line.

| File | Source |
|---|---|
| `iss.jpg` | Researcher’s Guide, 2015 |
| `candle-1g.jpg`, `candle-0g.jpg` | Researcher’s Guide: a candle on Earth and in microgravity |
| `compare.jpg`, `flex.jpg`, `flex2.jpg`, `spice.jpg`, `slice.jpg` | Researcher’s Guide, figs. 1–5 |
| `flame-design.jpg`, `s-flame.jpg` | Researcher’s Guide, figs. 6 and 7 |
| `bass-spread.jpg`, `bass-sphere.jpg`, `drop-tower.jpg` | Researcher’s Guide, figs. 9, 11 and 13 |
| `spice-iss.jpg` | a frame of onboard video from the PSI-107 (SPICE) raw data |

We extracted the images from the PDF with `pdfimages` (poppler) and processed them in ImageMagick. The originals were CMYK and came out as negatives, so we converted them to sRGB, cropped and compressed them. The content was not changed.

The flame on the home page is our own Canvas animation, not a photo or a simulation. Its caption says so.

## 3. Software and libraries

**Server (Python 3.12):**

- FastAPI 0.115.6 (MIT) on Starlette 0.41.3 (BSD-3);
- Pydantic 2.14.3 (MIT);
- Uvicorn 0.34.0 (BSD-3);
- httpx 0.28.1 (BSD-3);
- SQLite with FTS5 full-text search, from the standard library.

We read xlsx files ourselves with `zipfile` and `xml.etree`, no third-party packages.

**Database build:**

- `pdftotext` (poppler 26.07) for PDF text;
- the archive downloader needs the `requests` package.

**Website (Node.js 24):**

- React 18.3.1 (MIT);
- TypeScript 5.9.3 (Apache-2.0);
- Vite 5.4.21 (MIT) with @vitejs/plugin-react 4.7.0;
- Inter, DM Mono and IBM Plex Mono fonts via Fontsource (OFL-1.1).

Charts, the pressure-vs-oxygen map, tables and the telemetry player are our own SVG and Canvas code, with no chart libraries.

**Hosting:** our own Linux server, a `systemd` service and a git hook that updates the code on `git push`. The frontend is built locally and the `frontend/dist` folder is copied over.

## 4. AI inside the product: the archive assistant

The assistant runs through OpenRouter on free models. The defaults are `nvidia/nemotron-3.5-super-vl`, `baidu/ernie-5.5-flash-preview`, `nvidia/nemotron-3-ultra-550b-a55b` and `google/gemma-4-31b-it`. They are queried two at a time, and the first usable answer wins. We did not fine-tune them, and they never see the whole archive.

How an answer is made (`backend/search.py`, `backend/ai.py`):

1. **Reading the question.** The corpus is almost all English, so Russian words go through our glossary. Experiment names are recognized even when transliterated, and conditions such as “34 % oxygen, 57 kPa” are pulled out of the question.
2. **Search.** SQLite FTS5 (BM25) over 9,446 passages, then reranking. For questions about a measured value we add the statistics of the matching table column and the rows with its extreme values. If the question gives conditions, we add the nearest tested regimes.
3. **Answer.** The model sees only these numbered passages and must put an `[n]` citation after every claim. If the answer has no citations, it is asked once to rewrite it.
4. **Check.** The code checks the answer sentence by sentence:
   - citations to sources that do not exist are removed;
   - it counts how many statements rely on a source;
   - every number must be found in the very passage its sentence cites.

   The result of the check is shown under the answer.
5. **Without a model.** If the model does not answer, the site shows the retrieved passages. Everything else works without a model.

The quick answers on the home page (`backend/faq.py`) are written by us. Their numbers are computed from the tables when the database is built.

Search is tested with `python -m backend.eval_search`: 21 questions in English and Russian, and 7 of them, about measured values, must also return a table row. All 21 pass now. Before the search rework 17 passed, and table data was found in 4 of the 7 cases. We wrote the questions ourselves while working on search, so this is a regression guard, not an independent benchmark.

## 5. AI during development

We could not have written all of this from scratch within the hackathon, so most of the code was written in editors with AI coding assistants:

- **Cursor** — the first version of the project: database build, API, main pages.
- **Claude Code** (Anthropic, Claude Opus model) — the nasa.gov-style redesign, the search and answer-check rework, the assistant interface, the mobile layout, image processing, and a first draft of this report, which we then edited.

For us AI was a tool for writing and editing code quickly. The decisions were ours:

- the idea and the structure of the site;
- the choice of data;
- the design;
- the decisions listed under “How we worked”;
- checking every change.

When a suggestion did not fit, we rejected or reworked it. Facts on the site were checked against the PSI archive. This is also visible in the git history through the Co-authored-by lines.

## 6. Our assumptions

These assumptions are also shown on the site itself:

- **Habitat atmospheres:**
  - ISS: 21 % at 101.3 kPa.
  - Spacecraft: 26.5 % at 70.3 kPa (10.2 psia).
  - Lunar base and rover: 34 % at 56.5 kPa (8.2 psia), 1/6 g.
  - Spacesuit: 100 % at 29.6 kPa (4.3 psi).

  The values come from the challenge statement and the PSI-20 record.
- **The Mars base.** The challenge does not specify its atmosphere. We used the lunar-base atmosphere at 0.38 g and marked it as an assumption.
- **The proximity score** is made up of oxygen (up to 4 points), pressure (up to 2), fire-safety relevance (up to 3) and gravity (up to 1). It is a way to sort the list, not a risk estimate.
- **Missing pressure.** When a table does not state pressure, the conditions map uses 101 kPa and marks those points separately.

## 7. Running and checking

```bash
./run.sh setup                            # dependencies
./run.sh serve                            # site on http://127.0.0.1:8000, API on /docs
.venv/bin/python -m backend.eval_search   # search check, offline
```

The built database `data/ignis.db` is in the repository. To rebuild it, download the PSI archive (about 13 GB) with `python scripts/download_combustion_data.py --out "$PWD/../pre_nasa/data"` (needs `requests`), then run `./run.sh build`.
