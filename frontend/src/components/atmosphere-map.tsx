import { useMemo, useState, type MouseEvent } from "react";
import type { Environment, Point, State } from "../api";
import { fmtNum } from "../i18n";
import { useStore } from "../store";
import { linear, logScale, useWidth } from "./chart-utils";

const STATE_COLOR: Record<State, string> = {
  solid: "#0d0f12",
  liquid: "#1f64e0",
  gas: "#e59a2b",
  aerosol: "#9a9fa7",
};

const P_MIN = 20;
const P_MAX = 600;
const P_TICKS = [20, 30, 50, 70, 100, 200, 300, 500];
const O2_TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const EARTH_PPO2 = 21.28;
export const NEAR_O2 = 3;
export const NEAR_P = 15;

interface Props {
  points: Point[];
  environments: Environment[];
  selected?: string | null;
  marker?: { o2: number; p: number } | null;
  study?: string | null;
  height?: number;
  onPick?: (point: Point) => void;
}

export function isNear(pt: Point, o2: number, p: number) {
  return pt.b === "ambient" && pt.p != null && Math.abs(pt.o2 - o2) <= NEAR_O2 && Math.abs(pt.p - p) <= NEAR_P;
}

export function AtmosphereMap({ points, environments, selected, marker, study, height = 460, onPick }: Props) {
  const { studyById, lang, t } = useStore();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ pt: Point; x: number; y: number } | null>(null);

  const m = { top: 14, right: 18, bottom: 44, left: 52 };
  const x = logScale(P_MIN, P_MAX, m.left, width - m.right);
  const y = linear(8, 102, height - m.bottom, m.top);

  const focus = marker ?? environments.find((e) => e.id === selected) ?? null;

  const placed = useMemo(
    () =>
      points
        .filter((pt) => pt.p != null)
        .map((pt) => ({ pt, state: studyById.get(pt.s)?.state ?? "gas" })),
    [points, studyById],
  );

  const isoPath = useMemo(() => {
    const parts: string[] = [];
    for (let p = EARTH_PPO2; p <= P_MAX; p *= 1.04) {
      const o2 = (100 * EARTH_PPO2) / p;
      if (o2 < 8) break;
      parts.push(`${parts.length ? "L" : "M"}${x(p).toFixed(1)},${y(o2).toFixed(1)}`);
    }
    return parts.join("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Moon base, rover and Mars share one atmosphere, so they share one marker.
  const envGroups = useMemo(() => {
    const byPosition = new Map<string, Environment[]>();
    for (const env of environments) {
      const key = `${env.o2}|${env.p}`;
      byPosition.set(key, [...(byPosition.get(key) ?? []), env]);
    }
    return [...byPosition.values()];
  }, [environments]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: Point | null = null;
    let bestD = 64;
    for (const { pt } of placed) {
      if (study && pt.s !== study) continue;
      const dx = x(pt.p!) - mx;
      const dy = y(pt.o2) - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    setHover(best ? { pt: best, x: x(best.p!), y: y(best.o2) } : null);
  };

  const box = focus
    ? {
        x0: x(Math.max(P_MIN, focus.p - NEAR_P)),
        x1: x(focus.p + NEAR_P),
        y0: y(Math.min(102, focus.o2 + NEAR_O2)),
        y1: y(focus.o2 - NEAR_O2),
      }
    : null;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        onClick={() => hover && onPick?.(hover.pt)} style={{ cursor: hover && onPick ? "pointer" : "default" }}
        role="img" aria-label={t("map.caption")}>
        {O2_TICKS.map((v) => (
          <g key={`y${v}`}>
            <line className="grid" x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} />
            <text className="tick" x={m.left - 8} y={y(v) + 3.5} textAnchor="end">{v}</text>
          </g>
        ))}
        {P_TICKS.map((v) => (
          <g key={`x${v}`}>
            <line className="grid" x1={x(v)} x2={x(v)} y1={m.top} y2={height - m.bottom} />
            <text className="tick" x={x(v)} y={height - m.bottom + 16} textAnchor="middle">{v}</text>
          </g>
        ))}
        <line className="axis" x1={m.left} x2={width - m.right} y1={height - m.bottom} y2={height - m.bottom} />
        <text className="axis-title" x={(m.left + width - m.right) / 2} y={height - 6} textAnchor="middle">{t("map.x")}</text>
        <text className="axis-title" transform={`translate(13 ${(m.top + height - m.bottom) / 2}) rotate(-90)`} textAnchor="middle">{t("map.y")}</text>

        <path d={isoPath} fill="none" stroke="#1f64e0" strokeWidth={1.2} strokeDasharray="5 4" opacity={0.7} />
        <text className="tick halo" x={x(260)} y={y((100 * EARTH_PPO2) / 260) - 7} style={{ fill: "#1f64e0" }}>{t("map.iso")}</text>

        {box && <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} fill="rgba(224,70,31,0.07)" stroke="#e0461f" strokeDasharray="3 3" />}

        <g>
          {placed.map(({ pt, state }, i) => {
            const dim = study ? pt.s !== study : false;
            const hollow = pt.b === "oxidizer";
            const color = STATE_COLOR[state as State] ?? "#686e78";
            return (
              <circle key={i} cx={x(pt.p!)} cy={y(pt.o2)} r={dim ? 2 : 2.8}
                fill={hollow ? "none" : color} stroke={hollow ? color : "none"} strokeWidth={1.1}
                opacity={dim ? 0.12 : pt.ps === "assumed" ? 0.35 : 0.62} />
            );
          })}
        </g>

        {envGroups.map((group) => {
          const on = !marker && group.some((env) => env.id === selected);
          const cx = x(group[0].p);
          const cy = y(group[0].o2);
          const s = on ? 9 : 6;
          return (
            <g key={group[0].id} opacity={on || !selected ? 1 : 0.75}>
              <path d={`M${cx - s},${cy}H${cx + s}M${cx},${cy - s}V${cy + s}`} stroke={on ? "#e0461f" : "#0d0f12"} strokeWidth={on ? 2.4 : 1.6} />
              <text className="halo" x={cx + s + 4} y={cy - 5} style={{ font: `${on ? 600 : 500} 11.5px var(--sans)`, fill: on ? "#e0461f" : "#0d0f12" }}>
                {group.map((env) => env.name[lang]).join(" · ")}
              </text>
            </g>
          );
        })}

        {marker && (
          <g>
            <circle cx={x(marker.p)} cy={y(marker.o2)} r={7} fill="none" stroke="#e0461f" strokeWidth={2} />
            <circle cx={x(marker.p)} cy={y(marker.o2)} r={2} fill="#e0461f" />
          </g>
        )}
        {hover && <circle cx={hover.x} cy={hover.y} r={6} fill="none" stroke="#0d0f12" strokeWidth={1.5} />}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="label">{hover.pt.s} · {studyById.get(hover.pt.s)?.short}</div>
          <div style={{ marginTop: 4 }}>
            O₂ <b>{fmtNum(lang, hover.pt.o2)} %</b>{hover.pt.b === "oxidizer" ? ` (${t("study.o2ox")})` : ""} · <b>{fmtNum(lang, hover.pt.p)} {t("common.kpa")}</b>
          </div>
          <div className="mono" style={{ color: "#8f9aa8", fontSize: 11.5, marginTop: 2 }}>
            {[hover.pt.f, hover.pt.run, t("map.pointRow", { r: hover.pt.r })].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

export function MapLegend() {
  const { t, meta, lang } = useStore();
  return (
    <div className="legend">
      {(Object.keys(STATE_COLOR) as State[]).map((s) => (
        <span key={s}><i style={{ background: STATE_COLOR[s] }} />{meta?.states[s]?.[lang] ?? s}</span>
      ))}
      <span><i className="ring" style={{ color: "#686e78" }} />{t("map.oxidizer")}</span>
      <span><i style={{ background: "#0d0f12", opacity: 0.3 }} />{t("map.assumed")}</span>
      <span><svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7h12M7 1v12" stroke="#0d0f12" strokeWidth="1.6" /></svg>{t("map.env")}</span>
      <span><svg width="18" height="8" viewBox="0 0 18 8"><path d="M0 4h18" stroke="#1f64e0" strokeWidth="1.2" strokeDasharray="5 4" /></svg>{t("map.iso")}</span>
    </div>
  );
}
