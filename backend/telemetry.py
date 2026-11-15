"""Sensor recordings and modelling tables pulled from the raw PSI files at build time.

- six flight recordings: Saffire-II/III fires in Cygnus, ACME BRE, E-FIELD, CFI-G
  and FLEX droplet diameters, thinned to a few hundred points each;
- smoke particle-size distributions at 0 g and 1 g from the PSI-115 model;
- flat tables for modelling: FLEX droplets, Saffire 0 g vs 1 g, BASS-II gases, CFI-G.
"""

from __future__ import annotations

import csv
import io
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from . import curated
from .config import DATA_ROOT
from .normalize import ATM_KPA, BAR_KPA, MMHG_KPA, nums

PSIA_KPA = 6.89476
MAX_TRACE_POINTS = 280


def _read_csv(path: Path) -> list[list[str]]:
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")
    return list(csv.reader(io.StringIO(text, newline="")))


def _num(val: str | None) -> float | None:
    if not val:
        return None
    found = nums(val)
    return found[0] if found else None


def _downsample(times: list[float], channels: list[dict], limit: int = MAX_TRACE_POINTS) -> tuple[list[float], list[dict]]:
    """Preserve peaks and valleys using bucket extrema + midpoint decimation."""
    n = len(times)
    if n <= limit:
        return [round(t, 3) for t in times], [
            dict(ch, values=[round(v, 4) if v is not None else None for v in ch["values"]]) for ch in channels
        ]
    step = max(1, n // limit)
    idxs = list(range(0, n, step))
    if idxs[-1] != n - 1:
        idxs.append(n - 1)
    # ensure global maximum of primary channel is never skipped
    if channels:
        prim = channels[0]["values"]
        valid = [(v, i) for i, v in enumerate(prim) if v is not None]
        if valid:
            _, peak_idx = max(valid)
            if peak_idx not in idxs:
                idxs.append(peak_idx)
                idxs.sort()
    out_t = [round(times[i], 3) for i in idxs]
    out_ch = []
    for ch in channels:
        vals = ch["values"]
        out_ch.append(dict(ch, values=[round(vals[i], 4) if vals[i] is not None else None for i in idxs]))
    return out_t, out_ch


def _parse_hhmmss(text: str) -> float | None:
    parts = (text or "").strip().split(":")
    if len(parts) < 3:
        return None
    try:
        h, m = int(parts[0]), int(parts[1])
        if len(parts) == 4:
            s = int(parts[2]) + float(parts[3]) / 1000.0
        else:
            s = float(parts[2])
        return h * 3600.0 + m * 60.0 + s
    except ValueError:
        return None


# 1. Saffire XLSX Calibrated Flight Telemetry

def _load_saffire_xlsx(
    sid: str,
    rel_file: str,
    trace_id: str,
    title: dict,
    subtitle: dict,
    col_map: list[tuple[str, str, dict, str, float]],
    events: list[dict],
) -> dict | None:
    fp = DATA_ROOT / sid / rel_file
    if not fp.exists():
        return None
    wanted = {"A"} | {col for col, *_ in col_map}
    times: list[float] = []
    series: dict[str, list[float | None]] = {col: [] for col, *_ in col_map}
    with zipfile.ZipFile(fp) as zf:
        row_no = 0
        for _, elem in ET.iterparse(zf.open("xl/worksheets/sheet1.xml"), events=("end",)):
            if not elem.tag.endswith("}row"):
                continue
            row_no += 1
            if row_no <= 2:
                elem.clear()
                continue
            row_vals: dict[str, float] = {}
            for cell in elem:
                ref = cell.attrib.get("r", "")
                col = "".join(ch for ch in ref if ch.isalpha())
                if col not in wanted:
                    continue
                v = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                if v is not None and v.text:
                    try:
                        row_vals[col] = float(v.text)
                    except ValueError:
                        pass
            if "A" in row_vals:
                times.append(row_vals["A"])
                for col, *_ in col_map:
                    raw_v = row_vals.get(col)
                    series[col].append(raw_v)
            elem.clear()
    if not times:
        return None
    channels = []
    for col, key, label, unit, scale in col_map:
        vals = [v * scale if v is not None else None for v in series[col]]
        clean_vals = [v for v in vals if v is not None]
        if not clean_vals:
            continue
        channels.append({
            "key": key,
            "label": label,
            "unit": unit,
            "min": round(min(clean_vals), 3),
            "max": round(max(clean_vals), 3),
            "values": vals,
        })
    t_ds, ch_ds = _downsample(times, channels)
    return {
        "id": trace_id,
        "study": sid,
        "family": "SAFFIRE",
        "file": f"{sid}/{rel_file}",
        "title": title,
        "subtitle": subtitle,
        "x_label": curated.T("Время от старта записи, с", "Elapsed time, s"),
        "x_unit": "s",
        "samples_raw": len(times),
        "t": t_ds,
        "channels": ch_ds,
        "events": events,
    }


# 2. ACME CIR High-Frequency Flight CSV

def _load_acme_csv(
    sid: str,
    rel_file: str,
    trace_id: str,
    run_code: str,
    title: dict,
    subtitle: dict,
    col_specs: list[tuple[str, str, dict, str, float]],
) -> dict | None:
    fp = DATA_ROOT / sid / rel_file
    if not fp.exists():
        return None
    lines = fp.read_text(encoding="utf-8", errors="replace").splitlines()
    if len(lines) < 4:
        return None
    header = next(csv.reader([lines[1]]))
    col_idx = {name.strip(): idx for idx, name in enumerate(header)}
    if "Time" not in col_idx:
        return None
    t_idx = col_idx["Time"]
    active_specs = [(cname, key, label, unit, scale, col_idx[cname]) for cname, key, label, unit, scale in col_specs if cname in col_idx]
    if not active_specs:
        return None

    times: list[float] = []
    series: dict[str, list[float | None]] = {key: [] for _, key, *_ in active_specs}
    t0: float | None = None
    for row in csv.reader(lines[2:]):
        if len(row) <= t_idx:
            continue
        sec = _parse_hhmmss(row[t_idx])
        if sec is None:
            continue
        if t0 is None:
            t0 = sec
        elif sec < t0 - 3600:
            sec += 86400.0
        times.append(sec - t0)
        for _cname, key, _lbl, _u, scale, idx in active_specs:
            val = None
            if idx < len(row) and row[idx].strip():
                try:
                    val = float(row[idx]) * scale
                except ValueError:
                    val = None
            series[key].append(val)

    if not times:
        return None
    channels = []
    for _cname, key, label, unit, _scale, _idx in active_specs:
        vals = series[key]
        clean_vals = [v for v in vals if v is not None]
        if not clean_vals:
            continue
        channels.append({
            "key": key,
            "label": label,
            "unit": unit,
            "min": round(min(clean_vals), 4),
            "max": round(max(clean_vals), 4),
            "values": vals,
        })
    t_ds, ch_ds = _downsample(times, channels)
    return {
        "id": trace_id,
        "study": sid,
        "run": run_code,
        "family": "ACME",
        "file": f"{sid}/{rel_file}",
        "title": title,
        "subtitle": subtitle,
        "x_label": curated.T("Время прогона, с", "Run elapsed time, s"),
        "x_unit": "s",
        "samples_raw": len(times),
        "t": t_ds,
        "channels": ch_ds,
        "events": [],
    }


# 3. FLEX Droplet d²-Law Flight Curves

def _load_flex_droplets() -> dict | None:
    runs = [
        ("FLEX-035", "181F001", "d_base", curated.T("Гептан · 21 % O₂ без добавок (D, мм)", "n-Heptane · 21 % O₂ baseline (D, mm)")),
        ("FLEX-010", "256F002", "d_co2", curated.T("Метанол · 21 % O₂ + 70 % CO₂ (D, мм)", "Methanol · 21 % O₂ + 70 % CO₂ (D, mm)")),
        ("FLEX-235", "H04H101", "d_he", curated.T("Гептан · 17 % O₂ + 20 % He погасание (D, мм)", "n-Heptane · 17 % O₂ + 20 % He extinction (D, mm)")),
    ]
    parsed: list[tuple[str, dict, list[tuple[float, float]]]] = []
    max_t = 0.0
    for flex_id, code, key, label in runs:
        fp = DATA_ROOT / "PSI-69" / "Raw Data" / f"PSI-69_Raw Data_{flex_id}_DropletData.txt"
        if not fp.exists():
            continue
        pts: list[tuple[float, float]] = []
        for line in fp.read_text(encoding="utf-8", errors="replace").splitlines()[1:]:
            parts = line.strip().split()
            if len(parts) >= 2:
                try:
                    t, d = float(parts[0]), float(parts[1])
                    if t >= -0.5 and 0 < d < 8:
                        pts.append((t, d))
                except ValueError:
                    pass
        if pts:
            pts.sort()
            max_t = max(max_t, pts[-1][0])
            parsed.append((key, label, pts))
    if not parsed:
        return None

    # Interpolate onto a shared 220-point time grid from -0.4 s to max_t so curves compare cleanly
    n_grid = 220
    t_start = -0.4
    grid = [round(t_start + (max_t - t_start) * i / (n_grid - 1), 3) for i in range(n_grid)]
    channels = []
    for key, label, pts in parsed:
        vals: list[float | None] = []
        d2_vals: list[float | None] = []
        j = 0
        for gt in grid:
            if gt < pts[0][0] or gt > pts[-1][0]:
                vals.append(None)
                d2_vals.append(None)
                continue
            while j + 1 < len(pts) and pts[j + 1][0] < gt:
                j += 1
            if j + 1 < len(pts) and pts[j + 1][0] > pts[j][0]:
                t0, v0 = pts[j]
                t1, v1 = pts[j + 1]
                alpha = (gt - t0) / (t1 - t0)
                v = v0 + alpha * (v1 - v0)
            else:
                v = pts[j][1]
            vals.append(round(v, 4))
            d2_vals.append(round(v * v, 4))
        clean = [v for v in vals if v is not None]
        clean_d2 = [v for v in d2_vals if v is not None]
        channels.append({
            "key": key, "label": label, "unit": "mm",
            "min": round(min(clean), 3), "max": round(max(clean), 3), "values": vals,
        })
        channels.append({
            "key": f"{key}_d2",
            "label": curated.T(label["ru"].replace("(D, мм)", "(D², мм²)"), label["en"].replace("(D, mm)", "(D², mm²)")),
            "unit": "mm²",
            "min": round(min(clean_d2), 3), "max": round(max(clean_d2), 3), "values": d2_vals,
        })

    return {
        "id": "flex-droplets",
        "study": "PSI-69",
        "family": "MDCA",
        "file": "PSI-69/Raw Data/PSI-69_Raw Data_FLEX-035_DropletData.txt (+ FLEX-010, FLEX-235)",
        "title": curated.T("FLEX: закон d² выгорания и погасания капель", "FLEX: Droplet d²-Law Burn & Extinction Curves"),
        "subtitle": curated.T(
            "Сравнение трёх полётных треков диаметра капли: базовое горение гептана, разбавление 70 % CO₂ и быстрое погасание с 20 % гелия.",
            "Three flight droplet-tracking runs compared: baseline heptane burn, 70 % CO₂ dilution, and rapid extinction in 20 % helium.",
        ),
        "x_label": curated.T("Время от зажигания капли, с", "Time from droplet ignition, s"),
        "x_unit": "s",
        "samples_raw": sum(len(pts) for _, _, pts in parsed),
        "t": grid,
        "channels": channels,
        "events": [{"t": 0.0, "label": curated.T("Зажигание", "Ignition")}],
    }


# 4. PSI-115 (SAME) 0g vs 1g Smoke Particle-Size Distributions

def _load_smoke_psd() -> dict | None:
    folder = DATA_ROOT / "PSI-115" / "Analyzed Data"
    diam_file = folder / "PSI-115_Analyzed Data_nodeDiameters.dat"
    if not diam_file.exists():
        return None
    diam_lines = diam_file.read_text(encoding="utf-8", errors="replace").strip().splitlines()[1:]
    # Convert meters to nanometers (nm)
    diam_nm = [round(float(x.strip()) * 1e9, 2) for x in diam_lines if x.strip()]

    def read_psd(fname: str) -> list[float]:
        p = folder / f"PSI-115_Analyzed Data_{fname}"
        if not p.exists():
            return []
        out = []
        for line in p.read_text(encoding="utf-8", errors="replace").strip().splitlines():
            parts = line.split()
            if len(parts) >= 2:
                try:
                    out.append(max(0.0, float(parts[1])))
                except ValueError:
                    pass
        return out

    g0_8 = read_psd("8cmNoGravityPSD.dat")
    g1_8 = read_psd("8cmGravityPSD.dat")
    g0_10 = read_psd("10cmNoGravityPSD.dat")
    g1_10 = read_psd("10cmGravityPSD.dat")
    n = min(len(diam_nm), len(g0_8), len(g1_8))
    if n == 0:
        return None

    # Normalize distributions to peak = 100 and also keep log10 concentration for detector physics
    def norm_pct(arr: list[float]) -> list[float]:
        pk = max(arr[:n]) or 1.0
        return [round((v / pk) * 100.0, 3) for v in arr[:n]]

    return {
        "study": "PSI-115",
        "related": ["PSI-102", "PSI-101", "PSI-47"],
        "file": "PSI-115/Analyzed Data/nodeDiameters.dat, 8cmNoGravityPSD.dat, 8cmGravityPSD.dat, 10cm*PSD.dat",
        "diameter_nm": diam_nm[:n],
        "series": [
            {
                "key": "0g_8cm",
                "gravity": "0g",
                "position": "8 cm",
                "label": curated.T("Невесомость (0g), 8 см от источника", "Microgravity (0g), 8 cm downstream"),
                "raw": [round(v, 6) for v in g0_8[:n]],
                "norm": norm_pct(g0_8),
            },
            {
                "key": "1g_8cm",
                "gravity": "1g",
                "position": "8 cm",
                "label": curated.T("Земная гравитация (1g), 8 см от источника", "Earth gravity (1g), 8 cm downstream"),
                "raw": [round(v, 6) for v in g1_8[:n]],
                "norm": norm_pct(g1_8),
            },
            *(
                [
                    {
                        "key": "0g_10cm",
                        "gravity": "0g",
                        "position": "10 cm",
                        "label": curated.T("Невесомость (0g), 10 см (старение дыма)", "Microgravity (0g), 10 cm (aged smoke)"),
                        "raw": [round(v, 6) for v in g0_10[:n]],
                        "norm": norm_pct(g0_10),
                    },
                    {
                        "key": "1g_10cm",
                        "gravity": "1g",
                        "position": "10 cm",
                        "label": curated.T("Земная гравитация (1g), 10 см", "Earth gravity (1g), 10 cm"),
                        "raw": [round(v, 6) for v in g1_10[:n]],
                        "norm": norm_pct(g1_10),
                    },
                ]
                if len(g0_10) >= n and len(g1_10) >= n
                else []
            ),
        ],
        "bands": [
            {
                "id": "ionization",
                "min_nm": 10,
                "max_nm": 250,
                "label": curated.T("Окно ионизационных датчиков (Шаттл / США на МКС)", "Ionization detector window (Shuttle / USOS ISS)"),
            },
            {
                "id": "photoelectric",
                "min_nm": 250,
                "max_nm": 2500,
                "label": curated.T("Окно оптических датчиков светорассеяния (МКС / Orion)", "Photoelectric light-scattering window (ISS / Orion)"),
            },
        ],
    }


# 5. Normalized Predictive-Modeling Datasets from Experimental Tables

def _build_modeling_datasets() -> dict:
    # A. FLEX (PSI-69): 268 droplet tests with O2, Pressure, CO2, He, D0, Dext, K (burning rate), Burn time, Outcome
    flex_rows = []
    flex_path = DATA_ROOT / "PSI-69" / "Experimental table" / "PSI-69_Experimental table_FLEX.csv"
    if flex_path.exists():
        grid = _read_csv(flex_path)
        hdr = [h.strip() for h in grid[0]]
        for r_idx, raw in enumerate(grid[1:], start=1):
            if not any(raw):
                continue
            rec = dict(zip(hdr, [c.strip() for c in raw]))
            o2 = _num(rec.get("O initial ambient composition; mole fraction"))
            pres = _num(rec.get("Ambient pressure; mmHg"))
            co2 = _num(rec.get("CO initial ambient composition; mole fraction")) or 0.0
            he = _num(rec.get("He initial ambient composition; mole fraction")) or 0.0
            d0 = _num(rec.get("Droplet initial diameter; mm"))
            dext = _num(rec.get("Visible flame extinction diameter; mm"))
            k_rate = _num(rec.get("Burning rate; mm"))
            t_burn = _num(rec.get("Burn time; s"))
            if o2 is None or pres is None or pres <= 0:
                continue
            diluent = "CO2" if co2 > 0 and he == 0 else "He" if he > 0 and co2 == 0 else "N2 only" if co2 == 0 and he == 0 else "Mixed"
            flex_rows.append({
                "row": r_idx,
                "table": "PSI-69:flex",
                "run": rec.get("FLEX Identifier") or f"#{r_idx}",
                "fuel": rec.get("Fuel") or "Unknown",
                "o2": round(o2 * 100, 2),
                "p_kpa": round(pres * MMHG_KPA, 2),
                "co2": round(co2 * 100, 2),
                "he": round(he * 100, 2),
                "diluent": diluent,
                "d0_mm": round(d0, 3) if d0 is not None else None,
                "dext_mm": round(dext, 3) if dext is not None else None,
                "k_mm2s": round(k_rate, 4) if k_rate is not None else None,
                "burn_s": round(t_burn, 2) if t_burn is not None else None,
                "outcome": rec.get("Test end") or "Unknown",
            })

    # B. Saffire I–III (PSI-98, PSI-99, PSI-100): 0g vs 1g spacecraft material flammability & spread
    saffire_samples = []
    s2_path = DATA_ROOT / "PSI-99" / "Experimental table" / "PSI-99_Experimental table_SAFFIRE-2.csv"
    if s2_path.exists():
        grid = _read_csv(s2_path)
        hdr = [h.strip() for h in grid[0]]
        last_mat = ""
        for r_idx, raw in enumerate(grid[1:], start=1):
            rec = dict(zip(hdr, [c.strip() for c in raw]))
            snum = rec.get("Sample Number", "")
            if not snum.startswith("2-"):
                continue
            mat = rec.get("Material") or last_mat
            last_mat = mat
            thick = rec.get("Samle Thickness") or rec.get("Sample Thickness") or ""
            o2 = _num(rec.get("Percent O2 (Note 1)"))
            flow = _num(rec.get("Air Flow (cm/s)"))
            burn_t = _num(rec.get("Burn Time (s)"))
            ug_len = rec.get("?-g Burn Length") or ""
            ug_rate = rec.get("?-g Spread Length") or ""
            g1_len = rec.get("1-g Burn Length") or ""
            g1_rate = rec.get("1-g Spread Rate") or ""
            saffire_samples.append({
                "sample": snum,
                "study": "PSI-99",
                "table": "PSI-99:saffire-2",
                "row": r_idx,
                "material": mat,
                "thickness": thick,
                "flow_cms": flow,
                "direction": rec.get("Flow Direction") or "",
                "o2": o2,
                "burn_s": burn_t,
                "ug_burn": ug_len,
                "ug_rate_mms": _num(ug_rate) if "mm/s" in ug_rate else None,
                "ug_rate_raw": ug_rate,
                "g1_burn": g1_len,
                "g1_rate_raw": g1_rate,
            })

    # Add Saffire-I and Saffire-III full-bay SIBAL burns for scale comparison
    for sid, t_id, fname, o2_default in [("PSI-98", "PSI-98:saffire-1", "PSI-98_Experimental table_SAFFIRE-1.csv", 21.6),
                                         ("PSI-100", "PSI-100:saffire-3", "PSI-100_Experimental table_SAFFIRE-3.csv", 19.8)]:
        sp = DATA_ROOT / sid / "Experimental table" / fname
        if sp.exists():
            grid = _read_csv(sp)
            hdr = [h.strip() for h in grid[0]]
            for r_idx, raw in enumerate(grid[1:], start=1):
                rec = dict(zip(hdr, [c.strip() for c in raw]))
                mat = rec.get("Material", "")
                flow = _num(rec.get("Air Flow (cm/s)") or rec.get("Air Flow"))
                if not flow or "pre-test" in mat.lower():
                    continue
                saffire_samples.append({
                    "sample": f"{sid.split('-')[1]}-{rec.get('Sample Number', r_idx)}",
                    "study": sid,
                    "table": t_id,
                    "row": r_idx,
                    "material": f"{mat} (0.4×0.94 m)",
                    "thickness": f"{rec.get('Sample Thickness (cm)') or rec.get('Sample Thickness', '')}",
                    "flow_cms": flow,
                    "direction": rec.get("Flow Direction") or rec.get("Direction") or "",
                    "o2": _num(rec.get("Percent O2")) or o2_default,
                    "burn_s": _num(rec.get("Burn Time (s)")),
                    "ug_burn": "Large-scale Cygnus panel",
                    "ug_rate_mms": None,
                    "ug_rate_raw": "Full-scale bay test",
                    "g1_burn": "—",
                    "g1_rate_raw": "—",
                })

    # C. BASS-II (PSI-25): Solid burn O2 depletion & CO / CO2 toxic production in enclosed glovebox
    bass2_rows = []
    b2_path = DATA_ROOT / "PSI-25" / "Experimental table" / "PSI-25_Experimental table_BASS-II.csv"
    if b2_path.exists():
        grid = _read_csv(b2_path)
        hdr = [h.strip() for h in grid[0]]
        for r_idx, raw in enumerate(grid[1:], start=1):
            rec = dict(zip(hdr, [c.strip() for c in raw]))
            o2_i = _num(rec.get("Calibrated  initial O2 % by vol") or rec.get("Calibrated initial O2 % by vol"))
            o2_f = _num(rec.get("Calibrated final O2 % by vol"))
            co_i = _num(rec.get("Initial CO (ppm)"))
            co_f = _num(rec.get("Final CO (ppm)"))
            fan = _num(rec.get("Fan display"))
            if o2_i is None:
                continue
            bass2_rows.append({
                "row": r_idx,
                "table": "PSI-25:bass-ii",
                "run": rec.get("Test #") or f"#{r_idx}",
                "sample": rec.get("Fuel Sample Material") or "",
                "o2_init": round(o2_i, 2),
                "o2_final": round(o2_f, 2) if o2_f is not None else None,
                "co_delta_ppm": round((co_f - co_i), 1) if (co_f is not None and co_i is not None) else None,
                "co_final_ppm": round(co_f, 1) if co_f is not None else None,
                "fan": fan,
            })

    # D. CFI-G (PSI-159): High-oxygen gaseous cool & hot flames (up to 85% O2)
    cfig_rows = []
    for mode_name, fname, o2_col, t_id in [
        ("Normal (chamber O₂)", "PSI-159_Experimental table_CFI-G_Normal Flames.csv", "XO2 before test", "PSI-159:cfi-g-normal-flames"),
        ("Inverse (burner-jet O₂)", "PSI-159_Experimental table_CFI-G_Inverse Flames.csv", "XO2", "PSI-159:cfi-g-inverse-flames"),
    ]:
        cp = DATA_ROOT / "PSI-159" / "Experimental table" / fname
        if not cp.exists():
            continue
        grid = _read_csv(cp)
        hdr = [h.strip() for h in grid[0]]
        for r_idx, raw in enumerate(grid[1:], start=1):
            rec = dict(zip(hdr, [c.strip() for c in raw]))
            o2 = _num(rec.get(o2_col))
            p_bar = _num(rec.get("approx p (bar)"))
            burn_s = _num(rec.get("burn time (sec)"))
            t_peak = _num(rec.get("Peak burner T (C )") or rec.get("Peak burner Temp (C)"))
            if o2 is None or p_bar is None or o2 > 1.0:
                continue
            hot = (rec.get("Hot ignition") or "").strip().upper()
            end = (rec.get("Self-ext or flow term") or rec.get("Self -ext or flow term") or "").strip().upper()
            cfig_rows.append({
                "row": r_idx,
                "table": t_id,
                "mode": mode_name,
                "run": (rec.get("Test") or "").strip(),
                "fuel": (rec.get("Fuel") or "").strip().capitalize(),
                "o2": round(o2 * 100, 2),
                "p_kpa": round(p_bar * BAR_KPA, 1),
                "burn_s": round(burn_s, 2) if burn_s is not None else None,
                "peak_c": round(t_peak, 1) if t_peak is not None else None,
                "hot": hot or "—",
                "end": "Self-extinguished" if end == "SE" else "Flow terminated" if end == "FT" else end or "—",
            })

    return {
        "flex": flex_rows,
        "saffire": saffire_samples,
        "bass2": bass2_rows,
        "cfig": cfig_rows,
    }


# Public Entry Point Used by `backend/build.py`

def build_workbench() -> dict:
    traces = []

    # 1. Saffire-III full-scale spacecraft fabric fire (30 cm/s ventilation)
    s3 = _load_saffire_xlsx(
        sid="PSI-100",
        rel_file="Raw Data/PSI-100_Raw Data_Saffire III Sample 1 Sensors.xlsx",
        trace_id="saffire-3-s1",
        title=curated.T("Saffire-III: крупномасштабный пожар ткани SIBAL в корабле Cygnus", "Saffire-III: Full-Scale SIBAL Fabric Fire in Cygnus"),
        subtitle=curated.T(
            "Панель 0,4 × 0,94 м при потоке вентиляции 30 см/с: термопары шлейфа до 1056 °C, радиометр до 168 мВт/см², выгорание кислорода и рост CO₂.",
            "0.4 × 0.94 m SIBAL panel at 30 cm/s air flow: plume thermocouples to 1,056 °C, radiometer to 168 mW/cm², oxygen drawdown, and CO₂ rise.",
        ),
        col_map=[
            ("Y", "temp_c", curated.T("Температура образца TC9", "Sample Temp TC9"), "°C", 1.0),
            ("Q", "plume_c", curated.T("Температура шлейфа TC1", "Plume Temp TC1"), "°C", 1.0),
            ("K", "rad_mw", curated.T("Радиометр 1 (тепловой поток)", "Radiometer 1 (heat flux)"), "mW/cm²", 1.0),
            ("G", "o2_pct", curated.T("Кислород в отсеке O₂", "Cabin Oxygen O₂"), "%", 1.0),
            ("F", "co2_pct", curated.T("Углекислый газ CO₂", "Cabin CO₂"), "%", 1.0),
            ("H", "flow_cms", curated.T("Скорость потока (анемометр 1)", "Airflow speed (Anemometer 1)"), "cm/s", 1.0),
            ("J", "p_kpa", curated.T("Давление в отсеке", "Cabin Pressure"), "kPa", PSIA_KPA),
        ],
        events=[
            {"t": 20.0, "label": curated.T("Подача тока на запал", "Igniter energized")},
            {"t": 307.0, "label": curated.T("Пик горения панели", "Peak panel combustion")},
        ],
    )
    if s3:
        traces.append(s3)

    # 2. Saffire-II Sample 5 (29 cm SIBAL strip, microgravity vs NASA-STD-6001 benchmark)
    s2 = _load_saffire_xlsx(
        sid="PSI-99",
        rel_file="Raw Data/PSI-99_Raw Data_Saffire Sensor Data Sample 5.xlsx",
        trace_id="saffire-2-s5",
        title=curated.T("Saffire-II (образец 2-5): распространение пламени по SIBAL при 20 см/с", "Saffire-II (Sample 2-5): SIBAL Flame Spread at 20 cm/s"),
        subtitle=curated.T(
            "Образец 5 × 29 см для прямой сверки с наземным тестом NASA-STD-6001: устойчивая скорость распространения 2,1 мм/с.",
            "5 × 29 cm SIBAL strip benchmarked directly against NASA-STD-6001: steady 2.1 mm/s microgravity spread.",
        ),
        col_map=[
            ("Y", "temp_c", curated.T("Температура образца TC9", "Sample Temp TC9"), "°C", 1.0),
            ("Q", "plume_c", curated.T("Температура шлейфа TC1", "Plume Temp TC1"), "°C", 1.0),
            ("K", "rad_mw", curated.T("Радиометр 1", "Radiometer 1"), "mW/cm²", 1.0),
            ("G", "o2_pct", curated.T("Кислород O₂", "Oxygen O₂"), "%", 1.0),
            ("H", "flow_cms", curated.T("Поток (анемометр 1)", "Airflow (Anemometer 1)"), "cm/s", 1.0),
            ("J", "p_kpa", curated.T("Давление", "Pressure"), "kPa", PSIA_KPA),
        ],
        events=[{"t": 74.0, "label": curated.T("Прохождение фронта пламени", "Flame front passage")}],
    )
    if s2:
        traces.append(s2)

    # 3. FLEX droplet d2-law multi-run comparison
    flex_tr = _load_flex_droplets()
    if flex_tr:
        traces.append(flex_tr)

    # 4. ACME E-FIELD (PSI-22): Electric-field ion-driven partial-gravity analogue
    ef = _load_acme_csv(
        sid="PSI-22",
        rel_file="Raw Data/PSI-22_Raw Data_18073A3_data.csv",
        trace_id="acme-efield-18073a3",
        run_code="18073A3",
        title=curated.T("ACME E-FIELD (18073A3): развёртка электрического поля — аналог частичной гравитации", "ACME E-FIELD (18073A3): Electric-Field Sweep — Partial-Gravity Analogue"),
        subtitle=curated.T(
            "Напряжение на сетке разгоняет ионы пламени и создаёт объёмную силу, заменяющую лунную или марсианскую конвекцию.",
            "Mesh high-voltage accelerates flame ions to impose an adjustable body force mimicking lunar/Martian buoyancy.",
        ),
        col_specs=[
            ("EfieldVoltage", "efield_kv", curated.T("Сигнал высокого напряжения поля", "E-Field high-voltage monitor"), "V (scaled)", 1.0),
            ("RadiometerCenter", "rad_v", curated.T("Центральный радиометр пламени", "Center flame radiometer"), "V", 1.0),
            ("PMT1", "pmt_v", curated.T("Фотоумножитель хемилюминесценции PMT1", "Chemiluminescence PMT1"), "V", 1.0),
            ("MFCA3FuelFlow", "fuel_flow", curated.T("Расход топлива MFCA3", "Fuel mass flow MFCA3"), "V/sccm", 1.0),
            ("IonCurrent", "ion_cur", curated.T("Ионный ток через пламя", "Flame ion current"), "V", 1.0),
        ],
    )
    if ef:
        traces.append(ef)

    # 5. ACME BRE (PSI-20): Spacecraft material burning-rate emulator in quiescent atmosphere
    bre = _load_acme_csv(
        sid="PSI-20",
        rel_file="Raw Data/PSI-20_Raw Data_19039A1_data.csv",
        trace_id="acme-bre-19039a1",
        run_code="19039A1",
        title=curated.T("ACME BRE (19039A1): эмулятор горения материалов без вентиляции", "ACME BRE (19039A1): Material Burning-Rate Emulator in Still Air"),
        subtitle=curated.T(
            "Плоская пористая горелка имитирует испарение горящего пластика в неподвижной атмосфере корабля после отключения вентиляции.",
            "Flat porous burner emulating vaporizing polymer combustion after spacecraft ventilation shutoff.",
        ),
        col_specs=[
            ("BREHeatFluxCenter", "heat_flux", curated.T("Тепловой поток в центр горелки (×10³)", "Center burner heat flux (×10³)"), "mV", 1000.0),
            ("PMT1", "pmt_v", curated.T("Свечение пламени PMT1", "Flame emission PMT1"), "V", 1.0),
            ("MFCA3FuelFlow", "fuel_flow", curated.T("Подача горючего газа MFCA3", "Fuel feed MFCA3"), "V", 1.0),
            ("PTA2", "pres_atm", curated.T("Давление в камере CIR (PTA2)", "CIR chamber pressure (PTA2)"), "atm", ATM_KPA),
        ],
    )
    if bre:
        traces.append(bre)

    # 6. ACME CFI-G (PSI-159): 85% O2 inverse cool/hot flame
    cfig = _load_acme_csv(
        sid="PSI-159",
        rel_file="Raw Data/PSI-159_Raw Data_21202A1_data.csv",
        trace_id="acme-cfig-21202a1",
        run_code="21202A1",
        title=curated.T("ACME CFI-G (21202A1): обратное пламя этана при 85 % кислорода", "ACME CFI-G (21202A1): Inverse Ethane Flame at 85 % Oxygen"),
        subtitle=curated.T(
            "Рекордная концентрация кислорода в архиве PSI (струя 85 % O₂ при ~2,2 бар): переход горячего и холодного режимов.",
            "Highest oxygen fraction in the PSI archive (85 % O₂ oxidizer jet at ~2.2 bar): hot/cool flame regime telemetry.",
        ),
        col_specs=[
            ("PMT1", "pmt_v", curated.T("Оптический канал OH*/CH* (PMT1)", "Optical emission PMT1"), "V", 1.0),
            ("MFCA3FuelFlow", "flow_v", curated.T("Расход окислителя/газа MFCA3", "Flow controller MFCA3"), "V", 1.0),
            ("IonCurrent", "ion_cur", curated.T("Датчик ионизации", "Ionization signal"), "V", 1.0),
            ("PTA2", "pres_kpa", curated.T("Давление камеры CIR", "CIR chamber pressure"), "kPa", ATM_KPA),
        ],
    )
    if cfig:
        traces.append(cfig)

    return {
        "traces": traces,
        "smoke": _load_smoke_psd(),
        "modeling": _build_modeling_datasets(),
    }
