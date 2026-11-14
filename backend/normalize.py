"""Per-table rules that turn raw PSI "Experimental table" rows into comparable values.

The raw cell text is never changed: it is stored and shown as-is. This module only
adds a normalised view (oxygen in %, pressure in kPa, flow in cm/s, a date, a fuel
list) and records where each value came from, so every chart point can be traced
back to a column of a file.
"""

from __future__ import annotations

import re
from datetime import date, timedelta

ATM_KPA = 101.325
MMHG_KPA = 0.133322
BAR_KPA = 100.0

_NUM = re.compile(r"(?<![\w.])-?\d*\.?\d+(?:[eE][-+]?\d+)?")

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# canonical material name -> regex that finds it in a raw cell
MATERIALS: list[tuple[str, str]] = [
    ("PMMA", r"pmma|acrylic"),
    ("SIBAL (cotton-fiberglass)", r"sibal|cotton"),
    ("Nomex", r"nomex"),
    ("Ultem", r"ultem"),
    ("Silicone", r"silicone"),
    ("Kapton", r"kapton"),
    ("Teflon", r"teflon"),
    ("Pyrell", r"pyrell"),
    ("Lampwick", r"lampwick"),
    ("Dibutyl phthalate", r"dibutyl|\bdbp\b"),
    ("Wax", r"wax|candle"),
    ("Arizona road dust", r"arizona|road dust"),
    ("Methane", r"\bch\d+\b|methane"),
    ("Ethylene", r"c2h4|ethylene"),
    ("Ethane", r"c2h6|\bethane"),
    ("Propane", r"c3h8|propane"),
    ("Propylene", r"propylene"),
    ("Butane", r"butane"),
    ("Hydrogen", r"\bh2\b|hydrogen"),
    ("Methanol", r"methanol"),
    ("Ethanol", r"\bethanol"),
    ("Propanol", r"propanol"),
    ("Glycerol", r"glycerol"),
    ("n-Heptane", r"heptane"),
    ("Octane", r"octane"),
    ("Decane", r"\bdecane"),
    ("n-Dodecane", r"c12h26|dodecane"),
]


def nums(text: str) -> list[float]:
    """Every number in a cell, in order. '21.5 - 21.7' -> [21.5, 21.7]."""
    out = []
    for m in _NUM.finditer((text or "").replace(",", ".")):
        try:
            out.append(float(m.group(0)))
        except ValueError:
            pass
    return out


def span(values: list[float]) -> list[float] | None:
    return [round(min(values), 3), round(max(values), 3)] if values else None


def materials(text: str) -> list[str]:
    low = (text or "").lower()
    return [name for name, pat in MATERIALS if re.search(pat, low)]


def iso(y: int, m: int, d: int) -> str | None:
    if not 1995 <= y <= 2025:
        return None
    try:
        return date(y, m, d).isoformat()
    except ValueError:
        return None


def yyddd(text: str) -> str | None:
    """ACME test ids start with YYDDD: '21328A1' -> day 328 of 2021."""
    m = re.match(r"\s*(\d{2})(\d{3})", text or "")
    if not m:
        return None
    year, doy = 2000 + int(m.group(1)), int(m.group(2))
    if not 1 <= doy <= 366:
        return None
    return (date(year, 1, 1) + timedelta(days=doy - 1)).isoformat()


def mdy(text: str) -> str | None:
    m = re.match(r"\s*(\d{1,2})/(\d{1,2})/(\d{2,4})", text or "")
    if not m:
        return None
    y = int(m.group(3))
    return iso(y + 2000 if y < 100 else y, int(m.group(1)), int(m.group(2)))


def month_no(text: str) -> int | None:
    key = re.sub(r"[^a-z]", "", (text or "").lower())[:3]
    if key in MONTHS:
        return MONTHS[key]
    digits = nums(text)
    return int(digits[0]) if digits and 1 <= digits[0] <= 12 else None


def ymd_cols(year: str, month: str, day: str) -> str | None:
    y, m, d = nums(year), month_no(month), nums(day)
    if not (y and m and d):
        return None
    return iso(int(y[0]), m, int(d[0]))


def d_mon_yy(text: str, default_year: int | None = None) -> str | None:
    """'9-Mar-17' or '21-Jul' (year supplied by the caller)."""
    m = re.match(r"\s*(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?", text or "")
    if not m:
        return None
    mon = MONTHS.get(m.group(2).lower())
    if not mon:
        return None
    if m.group(3):
        y = int(m.group(3))
        y = y + 2000 if y < 100 else y
    elif default_year:
        y = default_year
    else:
        return None
    return iso(y, mon, int(m.group(1)))


def frac_to_pct(text: str) -> list[float]:
    """Mole fraction cell -> percent. Text like 'RAMP' gives nothing."""
    return [round(v * 100, 2) for v in nums(text) if 0 <= v <= 1]


# ---------------------------------------------------------------------------
# One function per table. `c` is {header: cell}. Returns the normalised view.
# ---------------------------------------------------------------------------

def _base(**kw) -> dict:
    row = {"run": None, "date": None, "fuel": [], "o2": None, "p": None,
           "flow": None, "outcome": None, "count": 1}
    row.update(kw)
    return row


def flame_design_inverse(c):
    return _base(run=c.get("Test"), date=yyddd(c.get("Test")), fuel=["Ethylene"],
                 o2=span(frac_to_pct(c.get("XO2"))),
                 p=span([v * ATM_KPA for v in nums(c.get("pmean (atm)") or c.get("pinit (atm)"))]))


def flame_design_normal(c):
    return _base(run=c.get("Test"), date=yyddd(c.get("Test")), fuel=materials(c.get("Fuel")),
                 o2=span(frac_to_pct(c.get("XO2 (init)"))),
                 p=span([v * ATM_KPA for v in nums(c.get("pmean (atm)") or c.get("pinit (atm)"))]))


def bre(c):
    raw = c.get("Oxygen Conc (percent)") or ""
    vals = [v / 100 if v > 100 else v for v in nums(raw)]  # '3400%' is a spreadsheet artefact of 34
    flames = nums(c.get("Flames Ignited"))
    return _base(date=ymd_cols(c.get("Year"), c.get("Month"), c.get("Date")),
                 fuel=materials(c.get("Fuel Bottle")), o2=span(vals),
                 o2_list=sorted(set(vals)), count=int(flames[0]) if flames else 0)


def cld(c):
    flames = nums(c.get("Flames ignited"))
    kind = (c.get("Test Type") or "").lower()
    fuel = ["Methane"] if "methane" in kind else ["Ethylene"] if "ethylene" in kind else materials(c.get("Fuel Bottle"))
    return _base(run=c.get("Test Day"), date=yyddd(c.get("Test Day")), fuel=fuel,
                 count=int(flames[0]) if flames else 0)


def efield(c):
    flames = nums(c.get("Flames Ignited"))
    return _base(run=c.get("Test Day") or None, date=ymd_cols(c.get("Year"), c.get("Month"), c.get("Date")),
                 fuel=materials(c.get("Fuel Bottle")), count=int(flames[0]) if flames else 0)


def sflame(c):
    flames = nums(c.get("Flames Ignited*"))
    atm = c.get("Atmosphere*") or ""
    o2 = [float(v) for v in re.findall(r"~?\s*(\d+(?:\.\d+)?)\s*%", atm)]
    return _base(run=c.get("Test Day*"), date=ymd_cols(c.get("Year"), c.get("Month"), c.get("Date")),
                 fuel=materials(c.get("Fuel Bottle")), o2=span(o2), o2_list=sorted(set(o2)),
                 p=[ATM_KPA, ATM_KPA] if o2 else None, count=int(flames[0]) if flames else 0)


def bass2(c):
    o2 = nums(c.get("Calibrated initial O2 % by vol"))[:1]
    return _base(run=c.get("Test #"), date=mdy(c.get("Date")),
                 fuel=materials(c.get("Fuel Sample Material")), o2=span(o2))


def bass(c):
    return _base(run=c.get("Test #"), date=mdy(c.get("Date")), fuel=materials(c.get("Fuel Sample Material")))


def cfi(c):
    return _base(run=c.get("CIR"), date=d_mon_yy(c.get("Test Date")), fuel=materials(c.get("Fuel")),
                 o2=span(frac_to_pct(c.get("Oxygen"))),
                 p=span([v * ATM_KPA for v in nums(c.get("Pressure"))]))


def daft(c):
    day = re.search(r"GMT\s*(\d+)\s*\((\d{4})\)", c.get("Actual Day") or "")
    when = None
    if day:
        when = (date(int(day.group(2)), 1, 1) + timedelta(days=int(day.group(1)) - 1)).isoformat()
    return _base(run=c.get("Session Name"), date=when, fuel=materials(c.get("Sample Material")))


def flex2(c):
    o2 = frac_to_pct(c.get("Oxygen Mole Fraction"))
    p = [v * ATM_KPA for v in nums(c.get("Ambient Pressure (atm)"))]
    return _base(fuel=materials(c.get("Sample (Fuel Type)")), o2=span(o2), o2_list=o2,
                 p=span(p), p_list=[round(v, 2) for v in p],
                 flow=span(nums(c.get("Flow Velocity (cm/s)"))), count=0, matrix=True)


def flex(c):
    return _base(run=c.get("FLEX Identifier"), date=mdy(c.get("Test Date")), fuel=materials(c.get("Fuel")),
                 o2=span(frac_to_pct(c.get("O initial ambient composition; mole fraction"))),
                 p=span([v * MMHG_KPA for v in nums(c.get("Ambient pressure; mmHg")) if v > 0]),
                 outcome=c.get("Test end") or None)


def saffire(c):
    mat = c.get("Material") or ""
    flow = nums(c.get("Air Flow (cm/s)") or c.get("Air Flow"))
    if "pre-test" in mat.lower() or not flow:      # flow-visualisation and footnote rows
        return _base(run=(c.get("Sample Number") or "")[:20], count=0, skip=True)
    o2 = nums(c.get("Percent O2") or c.get("Percent O2 (Note 1)"))
    burn = c.get("Burn Time (s)")
    return _base(run=c.get("Sample Number"), fuel=materials(mat), o2=span(o2), flow=span(flow[:1]),
                 outcome=f"burn time {burn}" if burn else None)


def same_r(c):
    return _base(run=c.get("SAME Test #"), date=d_mon_yy(c.get("Date"), 2010),
                 fuel=materials(c.get("Sample Type")), flow=span(nums(c.get("Inlet velocity (cm/s)"))))


def same(c):
    return _base(run=c.get("Sample #"), fuel=materials(c.get("Sample Material")),
                 flow=span(nums(c.get("Air Flow (cm/s)"))))


def slice_(c):
    m = re.match(r"\s*(\d{4})-([A-Za-z]{3})-(\d{1,2})", c.get("Test Date") or "")
    when = iso(int(m.group(1)), MONTHS.get(m.group(2).lower(), 0), int(m.group(3))) if m else None
    return _base(date=when, fuel=materials(c.get("Fuel Type")))


def spice(c):
    day = c.get("GMT date")
    return _base(run=f"GMT {day} {c.get('GMT ignition') or ''}".strip(), fuel=materials(c.get("Fuel")),
                 flow=span([v for v in nums(c.get("Air Rate (cm/s)")) if v >= 0]))


def pointer(c):
    return _base(run=c.get("Data ID"), count=0)


def cfig_inverse(c):
    out = []
    hot = (c.get("Hot ignition") or "").strip().lower()
    if hot:
        out.append(f"hot ignition: {hot}")
    end = (c.get("Self -ext or flow term") or "").strip()
    if end in ("SE", "FT"):
        out.append("self-extinguished" if end == "SE" else "flow terminated")
    return _base(run=(c.get("Test") or "").replace(" ", ""), date=yyddd(c.get("Test")),
                 fuel=materials(c.get("Fuel")), o2=span(frac_to_pct(c.get("XO2"))),
                 p=span([v * BAR_KPA for v in nums(c.get("approx p (bar)"))]),
                 outcome="; ".join(out) or None)


def cfig_normal(c):
    out = []
    hot = (c.get("Hot ignition") or "").strip().lower()
    if hot:
        out.append(f"hot ignition: {hot}")
    end = (c.get("Self-ext or flow term") or "").strip()
    if end in ("SE", "FT"):
        out.append("self-extinguished" if end == "SE" else "flow terminated")
    return _base(run=(c.get("Test") or "").replace(" ", ""), date=yyddd(c.get("Test")),
                 fuel=materials(c.get("Fuel")), o2=span(frac_to_pct(c.get("XO2 before test"))),
                 p=span([v * BAR_KPA for v in nums(c.get("approx p (bar)"))]),
                 outcome="; ".join(out) or None)


# file name fragment -> (function, table meta)
#   row_kind : what one row is ("run", "day", "sample", "matrix", "pointer")
#   o2_basis : "ambient" (chamber atmosphere) or "oxidizer" (O2 fraction of the burner flow, inverse flame)
#   o2_col / p_col / flow_col : source columns shown to the reader
#   p_note   : where pressure comes from when the table has no pressure column
RULES: list[tuple[str, callable, dict]] = [
    ("Flame Design_Inverse", flame_design_inverse, dict(
        row_kind="run", o2_basis="oxidizer", o2_col="XO2", p_col="pmean (atm)")),
    ("Flame Design_Normal", flame_design_normal, dict(
        row_kind="run", o2_basis="ambient", o2_col="XO2 (init)", p_col="pmean (atm)")),
    ("ACME BRE", bre, dict(row_kind="day", o2_basis="ambient", o2_col="Oxygen Conc (percent)")),
    ("CLD Flame", cld, dict(row_kind="day")),
    ("E-FIELD", efield, dict(row_kind="day")),
    ("s-Flame", sflame, dict(row_kind="day", o2_basis="ambient", o2_col="Atmosphere*", p_col="Notes",
                             p_note="table note: atmosphere is ~1 atm")),
    ("BASS-II", bass2, dict(row_kind="run", o2_basis="ambient", o2_col="Calibrated initial O2 % by vol",
                            p_assumed=ATM_KPA,
                            p_note="not in the table; test ran in the ISS Microgravity Science Glovebox at cabin pressure")),
    ("_BASS.csv", bass, dict(row_kind="run")),
    ("_CFI.csv", cfi, dict(row_kind="run", o2_basis="ambient", o2_col="Oxygen", p_col="Pressure")),
    ("DAFT", daft, dict(row_kind="run")),
    ("Flex2", flex2, dict(row_kind="matrix", o2_basis="ambient", o2_col="Oxygen Mole Fraction",
                          p_col="Ambient Pressure (atm)", flow_col="Flow Velocity (cm/s)")),
    ("_FLEX.csv", flex, dict(row_kind="run", o2_basis="ambient",
                             o2_col="O initial ambient composition; mole fraction",
                             p_col="Ambient pressure; mmHg")),
    ("SAFFIRE-1", saffire, dict(row_kind="sample", o2_basis="ambient", o2_col="Percent O2",
                                flow_col="Air Flow (cm/s)", p_assumed=ATM_KPA,
                                p_note="not in the table; test ran inside a Cygnus cargo vehicle at cabin pressure")),
    ("SAFFIRE-2", saffire, dict(row_kind="sample", o2_basis="ambient", o2_col="Percent O2 (Note 1)",
                                flow_col="Air Flow (cm/s)", p_assumed=ATM_KPA,
                                p_note="not in the table; test ran inside a Cygnus cargo vehicle at cabin pressure")),
    ("SAFFIRE-3", saffire, dict(row_kind="sample", flow_col="Air Flow")),
    ("SAME-R", same_r, dict(row_kind="run", flow_col="Inlet velocity (cm/s)")),
    ("_SAME.csv", same, dict(row_kind="sample", flow_col="Air Flow (cm/s)")),
    ("Slice", slice_, dict(row_kind="day")),
    ("Spice", spice, dict(row_kind="run", flow_col="Air Rate (cm/s)")),
    ("Data Summary Table", pointer, dict(row_kind="pointer")),
    ("CFI-G_Inverse", cfig_inverse, dict(row_kind="run", o2_basis="oxidizer", o2_col="XO2", p_col="approx p (bar)")),
    ("CFI-G_Normal", cfig_normal, dict(row_kind="run", o2_basis="ambient", o2_col="XO2 before test",
                                       p_col="approx p (bar)")),
]


def rule_for(file_name: str):
    for fragment, fn, meta in RULES:
        if fragment in file_name:
            return fn, dict(meta)
    return None, {}
