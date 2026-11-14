"""Quick answers to popular questions.

Every number is computed here from the experimental tables at build time and every
answer carries its sources, so these cards work instantly and without a language model.
"""

from __future__ import annotations

from collections import Counter

from . import curated
from .normalize import nums


def _g(v: float) -> str:
    return f"{v:g}"


def plural(n: int, one: str, few: str, many: str) -> str:
    """Russian plural: 1 запись, 2 записи, 5 записей."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} {one}"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return f"{n} {few}"
    return f"{n} {many}"


def _rec(n: int) -> str:
    return plural(n, "запись", "записи", "записей")


def _tst(n: int) -> str:
    return plural(n, "тест", "теста", "тестов")


def _src(n, title, file, loc, snippet, url, study=None, table=None, row=None, kind="row"):
    return {"n": n, "kind": kind, "study": study, "title": title, "file": file, "loc": loc,
            "snippet": snippet, "url": url, "table": table, "row": row}


def _row_text(t: dict, r: dict, cols: list[str]) -> str:
    return "; ".join(f"{c}: {r['cells'][t['columns'].index(c)]}" for c in cols if c in t["columns"])


def build_faq(studies: list[dict], tables: list[dict], points: list[dict], coverage: list[dict]) -> list[dict]:
    by_id = {s["id"]: s for s in studies}
    tab = {t["id"]: t for t in tables}
    challenge = "Flame in Freefall challenge statement"
    out = []

    def challenge_src(n, i):
        return _src(n, "NASA Space Apps: Flame in Freefall", challenge, f"paragraph {i}",
                    curated.CHALLENGE_FACTS[i - 1]["en"], curated.CHALLENGE_URL, kind="challenge")

    def card_src(n, sid, field, snippet):
        s = by_id[sid]
        return _src(n, f"{s['short']} ({sid})", f"{sid}/investigation.json", f"field {field}", snippet, s["psi_url"], study=sid, kind="card")

    # 1 ---------------------------------------------------------------- flame shape
    out.append({
        "id": "shape",
        "q": curated.T("Чем пламя в невесомости отличается от земного?", "How is a flame in microgravity different from one on Earth?"),
        "a": curated.T(
            "На Земле горячие газы поднимаются вверх и вытягивают пламя в каплю. В невесомости подъёмной силы нет: пламя свечи становится голубой сферой, а кислород поступает к нему только за счёт диффузии [1]. Поэтому на горение сильно влияет даже слабый поток воздуха от вентиляции, и его скорость меняют во многих экспериментах, например в BASS-II до 40 см/с [2].",
            "On Earth hot gases rise and stretch a flame into a teardrop. In microgravity there is no buoyancy: a candle flame becomes a blue sphere that gets oxygen only by diffusion [1]. Even the slow air flow from ventilation therefore matters, and its speed is varied in many experiments, for example up to 40 cm/s in BASS-II [2]."),
        "sources": [challenge_src(1, 1),
                    card_src(2, "PSI-25", "approach", "Fuel samples were mounted inside a small wind tunnel which could impose airflow speeds up to 40 cm/s. Main variables are airflow speed and oxygen concentration.")],
    })

    # 2 ---------------------------------------------------------------- most relevant
    top = [s for s in studies if s["safety"] == 3]
    names_ru = "; ".join(f"{s['short']} — {s['summary']['ru'].rstrip('.')} [{i}]" for i, s in enumerate(top, 1))
    names_en = "; ".join(f"{s['short']} — {s['summary']['en'].rstrip('.')} [{i}]" for i, s in enumerate(top, 1))
    out.append({
        "id": "relevant",
        "q": curated.T("Какие исследования важнее всего для безопасности экипажа?", "Which investigations matter most for crew fire safety?"),
        "a": curated.T(
            f"Напрямую о пожарной безопасности обитаемых отсеков — {len(top)} из {len(studies)} исследований: {names_ru}. Остальные дают основы горения и модели.",
            f"{len(top)} of the {len(studies)} investigations are directly about fire safety of crewed habitats: {names_en}. The rest provide combustion fundamentals and models."),
        "sources": [_src(i, f"{s['short']} ({s['id']})", f"{s['id']}/investigation.json", "fields objective, researchImpacts",
                         s["objective"][:260], s["psi_url"], study=s["id"], kind="card") for i, s in enumerate(top, 1)],
    })

    # 3 ---------------------------------------------------------------- highest oxygen
    def top_group(basis):
        pts = [p for p in points if p["b"] == basis]
        peak = max(p["o2"] for p in pts)
        per: dict[str, dict] = {}
        for p in pts:
            if p["o2"] >= peak - 0.05:
                g = per.setdefault(p["s"], {"rows": set(), "first": p})
                g["rows"].add((p["t"], p["r"]))
        return peak, sorted(per.items(), key=lambda kv: -len(kv[1]["rows"]))

    def row_src(n, p):
        t = tab[p["t"]]
        r = next(r for r in t["rows"] if r["n"] == p["r"])
        s = by_id[p["s"]]
        cols = [c for c in dict.fromkeys([t["columns"][0], "Test", "Fuel", "Fuel Bottle", t["meta"].get("o2_col"), t["meta"].get("p_col")]) if c and c != "Notes"]
        return _src(n, f"{s['short']} ({s['id']}), {t['label']}", t["file"], f"row {r['n']}, column {t['meta'].get('o2_col')}",
                    _row_text(t, r, cols), s["psi_url"], s["id"], t["id"], r["n"])

    peak_ox, ox_groups = top_group("oxidizer")
    peak_am, am_groups = top_group("ambient")
    srcs, ox_ru, ox_en, am_ru, am_en = [], [], [], [], []
    for sid, g in ox_groups:
        srcs.append(row_src(len(srcs) + 1, g["first"]))
        ox_ru.append(f"{by_id[sid]['short']} ({_rec(len(g['rows']))}) [{len(srcs)}]")
        ox_en.append(f"{by_id[sid]['short']} ({len(g['rows'])} records) [{len(srcs)}]")
    for sid, g in am_groups:
        srcs.append(row_src(len(srcs) + 1, g["first"]))
        am_ru.append(f"{by_id[sid]['short']} ({_rec(len(g['rows']))}) [{len(srcs)}]")
        am_en.append(f"{by_id[sid]['short']} ({len(g['rows'])} records) [{len(srcs)}]")
    srcs.append(challenge_src(len(srcs) + 1, 4))
    srcs.append(challenge_src(len(srcs) + 1, 3))
    out.append({
        "id": "max-o2",
        "q": curated.T("В каких тестах был самый высокий кислород?", "Which tests had the highest oxygen concentration?"),
        "a": curated.T(
            f"Самая высокая доля кислорода — {_g(peak_ox)} %: {', '.join(ox_ru)}. Это состав потока из горелки в «обратных» пламёнах, а не воздуха в камере [{len(srcs) - 1}]. Самая высокая доля кислорода в атмосфере камеры — {_g(peak_am)} %: {', '.join(am_ru)}. Для сравнения: на лунной базе ожидается 30 % и больше [{len(srcs)}].",
            f"The highest oxygen fraction is {_g(peak_ox)} %: {', '.join(ox_en)}. That is the burner flow of inverse flames, not the chamber atmosphere [{len(srcs) - 1}]. The highest oxygen fraction in a chamber atmosphere is {_g(peak_am)} %: {', '.join(am_en)}. For comparison, a Moon base is expected to use 30 % or more [{len(srcs)}]."),
        "sources": srcs,
    })

    # 4 ---------------------------------------------------------------- Moon base
    cov = {c["id"]: c for c in coverage}
    moon = cov["moon"]
    env = next(e for e in curated.ENVIRONMENTS if e["id"] == "moon")
    st_list = ", ".join(f"{by_id[s]['short']} ({n})" for s, n in moon["studies"]) or "—"
    srcs = [challenge_src(1, 3)]
    for s, _n in moon["studies"][:3]:
        t = next(t for t in tables if t["study"] == s and any(
            p["t"] == t["id"] and abs(p["o2"] - env["o2"]) <= 3 and p["p"] is not None and abs(p["p"] - env["p"]) <= 15 for p in points))
        p = next(p for p in points if p["t"] == t["id"] and abs(p["o2"] - env["o2"]) <= 3 and p["p"] is not None and abs(p["p"] - env["p"]) <= 15)
        r = next(r for r in t["rows"] if r["n"] == p["r"])
        srcs.append(_src(len(srcs) + 1, f"{by_id[s]['short']} ({s}), {t['label']}", t["file"], f"row {r['n']}",
                         _row_text(t, r, [c for c in (t["columns"][2], t["columns"][3], t["meta"].get("o2_col"), t["meta"].get("p_col")) if c]),
                         by_id[s]["psi_url"], s, t["id"], r["n"]))
    srcs.append(card_src(len(srcs) + 1, "PSI-20", "objective",
                         "NASA-considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen; 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen."))
    srcs.append(challenge_src(len(srcs) + 1, 5))
    refs = "".join(f"[{i}]" for i in range(2, len(srcs) - 1)) or ""
    out.append({
        "id": "moon",
        "q": curated.T("Есть ли данные для атмосферы лунной базы?", "Is there data for a Moon-base atmosphere?"),
        "a": curated.T(
            f"Частично. На лунной базе ожидается 30 % кислорода или больше при давлении 10,2 psi (70 кПа) или меньше [1]. В таблицах PSI {_rec(moon['rows'])} в пределах 3 процентных пунктов по кислороду и 15 кПа по давлению от точки 34 % и 57 кПа: {st_list} {refs}. ACME BRE целенаправленно проверял атмосферы 10,2 psia / 26,5 % и 8,2 psia / 34 %, но давление каждого теста в его сводной таблице не указано [{len(srcs) - 1}]. Все эти данные получены в невесомости: измерений при лунной гравитации в PSI нет [{len(srcs)}].",
            f"Partly. A Moon base is expected to use 30 % oxygen or more at 10.2 psi (70 kPa) or less [1]. The PSI tables hold {moon['rows']} records within 3 percentage points of oxygen and 15 kPa of pressure of the 34 % / 57 kPa point: {st_list} {refs}. ACME BRE deliberately examined the 10.2 psia / 26.5 % and 8.2 psia / 34 % atmospheres, but its summary table does not list the pressure of each test [{len(srcs) - 1}]. All of this is microgravity data: PSI has no measurements at lunar gravity [{len(srcs)}]."),
        "sources": srcs,
    })

    # 5 ---------------------------------------------------------------- partial gravity
    ef = by_id["PSI-22"]
    out.append({
        "id": "gravity",
        "q": curated.T("Есть ли данные при лунной или марсианской гравитации?", "Is there data at lunar or Martian gravity?"),
        "a": curated.T(
            f"Нет. В PSI сейчас нет данных о горении при частичной гравитации; их ждут от экспериментов LUCI и FM2 [1]. Ближайшая замена — ACME E-FIELD Flames ({ef['stats']['tests']} зажжённых пламён по сводной таблице): электрическое поле действует на ионы пламени и имитирует частичную гравитацию [1][2]. Оценить промежуточный случай можно, сравнивая результаты в невесомости и при земной гравитации [1].",
            f"No. PSI currently holds no partial-gravity combustion data; it is expected from the LUCI and FM2 experiments [1]. The closest substitute is ACME E-FIELD Flames ({ef['stats']['tests']} flames in its summary table): an electric field acts on flame ions and mimics partial gravity [1][2]. Intermediate gravity can be bounded by comparing microgravity and normal-gravity results [1]."),
        "sources": [challenge_src(1, 5), card_src(2, "PSI-22", "approach", ef["approach"][:300])],
    })

    # 6 ---------------------------------------------------------------- suppressants
    flex = next(t for t in tables if t["study"] == "PSI-69")
    ci = {c: i for i, c in enumerate(flex["columns"])}
    co2_col = "CO initial ambient composition; mole fraction"
    he_col = "He initial ambient composition; mole fraction"
    groups = {"co2": [], "he": [], "none": []}
    for r in flex["rows"]:
        co2 = (nums(r["cells"][ci[co2_col]]) or [0])[0]
        he = (nums(r["cells"][ci[he_col]]) or [0])[0]
        key = "co2" if co2 > 0 and he == 0 else "he" if he > 0 and co2 == 0 else "none" if co2 == 0 and he == 0 else None
        if key:
            groups[key].append(r)

    def ends(rows):
        c = Counter(r["cells"][ci["Test end"]] for r in rows)
        return c

    def describe(rows, lang):
        c = ends(rows)
        if lang == "ru":
            return f"{_tst(len(rows))}, из них погасание — {c.get('Extinction', 0)}, полное выгорание — {c.get('Completion', 0)}, срыв капли — {c.get('Disruption', 0)}"
        return f"{len(rows)} tests: extinction {c.get('Extinction', 0)}, burned to completion {c.get('Completion', 0)}, droplet disruption {c.get('Disruption', 0)}"

    fs = by_id["PSI-69"]
    ex_co2, ex_he = groups["co2"][0], groups["he"][0]
    cols = ["FLEX Identifier", "Fuel", "O initial ambient composition; mole fraction", co2_col, he_col, "Test end"]
    out.append({
        "id": "suppressant",
        "q": curated.T("Что известно о тушении CO₂ и гелием?", "What is known about suppression with CO₂ and helium?"),
        "a": curated.T(
            f"Тушение изучал FLEX: атмосферу камеры разбавляли углекислым газом или гелием и смотрели, погаснет ли капля [1]. В таблице FLEX {_tst(len(flex['rows']))}. С добавкой CO₂: {describe(groups['co2'], 'ru')} [2]. С добавкой гелия: {describe(groups['he'], 'ru')} [3]. Без добавок (только кислород и азот): {describe(groups['none'], 'ru')}. Эти числа — подсчёт по столбцу «Test end». Они не говорят, какой газ эффективнее: условия в группах разные. Вывод об эффективности нужно брать из публикаций FLEX.",
            f"Suppression was studied in FLEX: the chamber atmosphere was diluted with carbon dioxide or helium to see whether a droplet goes out [1]. The FLEX table has {len(flex['rows'])} tests. With CO₂ added: {describe(groups['co2'], 'en')} [2]. With helium added: {describe(groups['he'], 'en')} [3]. With neither (oxygen and nitrogen only): {describe(groups['none'], 'en')}. These numbers are a count over the “Test end” column. They do not say which gas works better, because conditions differ between the groups; that conclusion belongs to the FLEX publications."),
        "sources": [challenge_src(1, 7),
                    _src(2, f"FLEX (PSI-69), {flex['label']}", flex["file"], f"row {ex_co2['n']} (first of {len(groups['co2'])}), columns {co2_col}; Test end",
                         _row_text(flex, ex_co2, cols), fs["psi_url"], "PSI-69", flex["id"], ex_co2["n"]),
                    _src(3, f"FLEX (PSI-69), {flex['label']}", flex["file"], f"row {ex_he['n']} (first of {len(groups['he'])}), columns {he_col}; Test end",
                         _row_text(flex, ex_he, cols), fs["psi_url"], "PSI-69", flex["id"], ex_he["n"])],
    })

    # 7 ---------------------------------------------------------------- materials
    solids = Counter()
    where: dict[str, set] = {}
    first: dict[str, tuple] = {}
    gas_like = {"Methane", "Ethylene", "Ethane", "Propane", "Propylene", "Butane", "Hydrogen", "Methanol", "Ethanol",
                "Propanol", "Glycerol", "n-Heptane", "Octane", "Decane", "n-Dodecane", "Arizona road dust"}
    for t in tables:
        if by_id[t["study"]]["state"] != "solid":
            continue
        for r in t["rows"]:
            for f in r["norm"].get("fuel") or []:
                if f in gas_like:
                    continue
                solids[f] += 1
                where.setdefault(f, set()).add(by_id[t["study"]]["short"])
                first.setdefault(f, (t, r))
    lst_ru = "; ".join(f"{m} — {_rec(c)} ({', '.join(sorted(where[m]))}) [{i}]" for i, (m, c) in enumerate(solids.most_common(8), 1))
    lst_en = "; ".join(f"{m}: {c} records ({', '.join(sorted(where[m]))}) [{i}]" for i, (m, c) in enumerate(solids.most_common(8), 1))
    msrc = []
    for i, (m, _c) in enumerate(solids.most_common(8), 1):
        t, r = first[m]
        s = by_id[t["study"]]
        mat_col = next(c for c in t["columns"] if "aterial" in c or "Sample Type" in c)
        msrc.append(_src(i, f"{s['short']} ({s['id']}), {t['label']}", t["file"], f"row {r['n']}, column {mat_col}",
                         _row_text(t, r, list(dict.fromkeys([t["columns"][0], t["columns"][1], mat_col]))), s["psi_url"], s["id"], t["id"], r["n"]))
    out.append({
        "id": "materials",
        "q": curated.T("Какие твёрдые материалы испытывали?", "Which solid materials were tested?"),
        "a": curated.T(
            f"По сводным таблицам твёрдых образцов: {lst_ru}. Материал распознан по тексту ячейки; строки, где материал назван неявно (например, «2 cm sphere»), в подсчёт не вошли.",
            f"From the summary tables of solid samples: {lst_en}. The material is recognised from the cell text; rows that name it only implicitly (such as “2 cm sphere”) are not counted."),
        "sources": msrc,
    })

    # 8 ---------------------------------------------------------------- smoke
    same, samer, daft = by_id["PSI-102"], by_id["PSI-101"], by_id["PSI-47"]
    out.append({
        "id": "smoke",
        "q": curated.T("Как изучали обнаружение дыма в невесомости?", "How was smoke detection studied in microgravity?"),
        "a": curated.T(
            f"SAME и SAME-R нагревали материалы корабля без пламени и измеряли размер частиц дыма: от него зависит, сработает ли датчик [1][2]. В таблице SAME-R {_tst(samer['stats']['records'])} с материалами {', '.join(f for f, _ in samer['stats']['fuels'])} при скорости потока {_g(samer['stats']['flow'][0])}–{_g(samer['stats']['flow'][1])} см/с [2]. До этого DAFT проверил, что счётчик частиц P-Trak работает в невесомости, на аэрозоле из дорожной пыли [3].",
            f"SAME and SAME-R overheated spacecraft materials without flame and measured smoke-particle size, which decides whether a detector triggers [1][2]. The SAME-R table lists {samer['stats']['records']} tests with {', '.join(f for f, _ in samer['stats']['fuels'])} at flow speeds of {_g(samer['stats']['flow'][0])}–{_g(samer['stats']['flow'][1])} cm/s [2]. Before that, DAFT confirmed on a road-dust aerosol that the P-Trak particle counter works in microgravity [3]."),
        "sources": [card_src(1, "PSI-102", "objective", same["objective"][:280]),
                    _src(2, f"SAME-R (PSI-101), {next(t['label'] for t in tables if t['study'] == 'PSI-101')}",
                         next(t["file"] for t in tables if t["study"] == "PSI-101"), "columns Sample Type; Inlet velocity (cm/s)",
                         samer["objective"][:220], samer["psi_url"], "PSI-101", next(t["id"] for t in tables if t["study"] == "PSI-101"), 1),
                    card_src(3, "PSI-47", "objective", daft["objective"][:280])],
    })

    # 9 ---------------------------------------------------------------- where is the data
    total_files = sum(s["files"]["total"] for s in studies)
    out.append({
        "id": "where",
        "q": curated.T("Где лежат исходные данные?", "Where is the source data?"),
        "a": curated.T(
            f"Все данные взяты из открытого архива NASA Physical Sciences Informatics (PSI), раздел Combustion Science: {len(studies)} исследования [1]. На странице каждого исследования есть кнопка «Открыть в NASA PSI» и DOI. В проект загружены таблицы, числовые ряды и документы, всего файлов: {total_files}; фото и видео (терабайты кадров) не загружались. Для каждого ответа сайт показывает файл, строку и столбец, откуда взято значение.",
            f"All data comes from NASA's open Physical Sciences Informatics (PSI) archive, Combustion Science area: {len(studies)} investigations [1]. Every investigation page has an “Open in NASA PSI” button and a DOI. The project loaded tables, numeric series and documents, {total_files} files; photos and video (terabytes of frames) were not loaded. For every answer the site shows the file, row and column a value came from."),
        "sources": [_src(1, "NASA PSI: Combustion Science", "psi.nasa.gov", "search q=combustion",
                         "Physical Sciences Informatics (PSI) source of the data upon which the NASA Space App is to be based.", curated.PSI_SEARCH, kind="challenge")],
    })
    return out
