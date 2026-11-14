"""How close a study's tested conditions are to a crew atmosphere, and what that atmosphere implies.

    pO2 = O2 % / 100 · P          (Earth at sea level: 21 % · 101.325 kPa = 21.28 kPa)
    score 0..10 = oxygen 0..4 + pressure 0..2 + fire-safety link 0..3 + gravity 0..1

The score only sorts the list; it is not a risk estimate.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .search import Index

KPA_PER_PSIA = 6.89476
EARTH_ATM_KPA = 101.325
EARTH_PPO2_KPA = 21.28


def score_envelope(
    study: dict,
    o2_target: float,
    p_target: float,
    g_target: float | None,
    flow_target: float | None = None,
) -> dict:
    """Score how closely an investigation's tested conditions match a target habitat."""
    stats = study["stats"]
    parts: list[dict] = []

    o2_range = stats["o2_ambient"]
    if o2_range:
        dist = (
            0.0
            if o2_range[0] <= o2_target <= o2_range[1]
            else min(abs(o2_target - o2_range[0]), abs(o2_target - o2_range[1]))
        )
        pts = round(4.0 * max(0.0, 1.0 - dist / 15.0), 1)
        parts.append({"key": "o2", "points": pts, "max": 4, "range": o2_range, "dist": round(dist, 1)})
    else:
        parts.append({"key": "o2", "points": 0.0, "max": 4, "range": None, "oxidizer": stats["o2_oxidizer"]})

    p_range = stats["p"]
    if p_range:
        dist = (
            0.0
            if p_range[0] <= p_target <= p_range[1]
            else min(abs(p_target - p_range[0]), abs(p_target - p_range[1]))
        )
        pts = round(2.0 * max(0.0, 1.0 - dist / 50.0), 1)
        parts.append({"key": "p", "points": pts, "max": 2, "range": p_range, "dist": round(dist, 1)})
    elif stats["p_assumed"]:
        assumed = stats["p_assumed"]
        dist = abs(p_target - assumed)
        pts = round(2.0 * max(0.0, 1.0 - dist / 50.0), 1)
        parts.append({
            "key": "p",
            "points": pts,
            "max": 2,
            "range": [assumed, assumed],
            "dist": round(dist, 1),
            "assumed": True,
        })
    else:
        parts.append({"key": "p", "points": 0.0, "max": 2, "range": None})

    parts.append({"key": "safety", "points": study["safety"], "max": 3, "pillars": study["pillars"]})

    if not study["flight"]:
        g_pts, g_reason = 0.5, "ground"
    elif g_target is not None and g_target <= 0.02:
        g_pts, g_reason = 1.0, "match"
    elif g_target is None:
        g_pts, g_reason = 0.5, "na"
    elif study["id"] == "PSI-22":
        g_pts, g_reason = 0.5, "efield"
    elif g_target >= 0.95:
        g_pts, g_reason = 0.3, "partial"
    else:
        g_pts, g_reason = 0.0, "partial"
    parts.append({"key": "g", "points": g_pts, "max": 1, "why": g_reason})

    flow_dist = None
    if flow_target is not None and stats["flow"]:
        fl = stats["flow"]
        flow_dist = (
            0.0
            if fl[0] <= flow_target <= fl[1]
            else round(min(abs(flow_target - fl[0]), abs(flow_target - fl[1])), 1)
        )

    total = round(sum(item["points"] for item in parts), 1)
    return {"score": total, "parts": parts, "flow_dist": flow_dist}


def evaluate_atmosphere(
    index: Index,
    o2: float,
    p_kpa: float,
    g: float,
    flow_cms: float,
) -> dict:
    """Evaluate a spacecraft or surface-habitat atmosphere against the PSI archive."""
    pp_o2_kpa = round((o2 * p_kpa) / 100.0, 2)
    pp_o2_psia = round(pp_o2_kpa / KPA_PER_PSIA, 2)
    p_psia = round(p_kpa / KPA_PER_PSIA, 2)
    normoxic_equiv = round((o2 * p_kpa) / EARTH_ATM_KPA, 1)

    near_points = [
        pt
        for pt in index.points
        if pt["b"] == "ambient"
        and pt["p"] is not None
        and not pt["m"]
        and abs(pt["o2"] - o2) <= 3.0
        and abs(pt["p"] - p_kpa) <= 15.0
    ]
    unique_rows = {(pt["t"], pt["r"]) for pt in near_points}
    nearest = index.nearest_rows(o2, p_kpa, 8)

    ranked = []
    for sid in index.order:
        st = index.studies[sid]
        prox = score_envelope(st, o2, p_kpa, g, flow_cms)
        ranked.append({
            "id": sid,
            "short": st["short"],
            "state": st["state"],
            "group": st["group"],
            "safety": st["safety"],
            "proximity": prox,
        })
    ranked.sort(key=lambda r: (-r["proximity"]["score"], -r["safety"]))

    flags: list[str] = []
    if o2 >= 30.0:
        flags.append("elevated_o2")
    if pp_o2_kpa > 28.0:
        flags.append("hyperoxic_pp")
    if pp_o2_kpa < 16.0:
        flags.append("hypoxic_pp")
    if 0.02 < g < 0.9:
        flags.append("partial_g_gap")
    if o2 > 25.0:
        flags.append("no_solid_tests")
    if flow_cms < 3.0 and o2 >= 26.0:
        flags.append("quiescent_sustained")

    buoyant_vel_cms = round(25.0 * (max(0.0, g) ** 0.5), 1)
    effective_vel_cms = round(((flow_cms ** 2) + (buoyant_vel_cms ** 2)) ** 0.5, 1)

    return {
        "input": {"o2": o2, "p": p_kpa, "g": g, "flow": flow_cms},
        "physics": {
            "p_psia": p_psia,
            "pp_o2_kpa": pp_o2_kpa,
            "pp_o2_psia": pp_o2_psia,
            "earth_pp_ratio": round(pp_o2_kpa / EARTH_PPO2_KPA, 2),
            "normoxic_o2_pct": normoxic_equiv,
            "buoyant_vel_cms": buoyant_vel_cms,
            "effective_vel_cms": effective_vel_cms,
            "matching_records": len(unique_rows),
        },
        "flags": flags,
        "nearest": nearest,
        "studies": ranked,
    }
