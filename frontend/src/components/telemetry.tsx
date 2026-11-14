import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Channel, Trace, Workbench } from "../api";
import { fmtNum, pick } from "../i18n";
import { useStore } from "../store";
import { linear, logScale, nearestIndex, niceTicks, useWidth } from "./chart-utils";
import { Icon } from "./ui";

const PLAYBACK_SECONDS = 16;

function channelColor(key: string, i: number): string {
  if (/temp|plume/.test(key)) return "#ff6a3d";
  if (/rad|heat/.test(key)) return "#f2a93b";
  if (/^o2|_o2/.test(key)) return "#5d95ff";
  if (/co2/.test(key)) return "#c3cad3";
  if (/flow/.test(key)) return "#41b8a5";
  return ["#5d95ff", "#f2a93b", "#41b8a5", "#ff6a3d", "#c3cad3", "#e3d26f"][i % 6];
}

function fmtValue(lang: "ru" | "en", v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  return fmtNum(lang, v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
}

function linePath(t: number[], values: (number | null)[], x: (v: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  for (let i = 0; i < t.length; i++) {
    const v = values[i];
    if (v == null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

interface PlayerProps {
  trace: Trace;
  channels?: string[];
  compact?: boolean;
}

export function TracePlayer({ trace, channels: only, compact = false }: PlayerProps) {
  const { lang, t } = useStore();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const clipId = useRef(`clip-${Math.random().toString(36).slice(2)}`).current;

  const channels = useMemo(
    () => (only ? trace.channels.filter((c) => only.includes(c.key)) : trace.channels),
    [trace, only],
  );
  const t0 = trace.t[0] ?? 0;
  const t1 = trace.t[trace.t.length - 1] ?? 1;
  const x = linear(t0, t1, 0, width);
  const rowHeight = compact ? 58 : 66;

  useEffect(() => {
    setCursor(null);
    setPlaying(false);
  }, [trace.id]);

  const cursorRef = useRef<number | null>(null);
  cursorRef.current = cursor;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = Math.min(t1, (cursorRef.current ?? t0) + dt * ((t1 - t0) / PLAYBACK_SECONDS));
      cursorRef.current = next;
      setCursor(next);
      if (next >= t1) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, t0, t1]);

  const index = cursor == null ? null : nearestIndex(trace.t, cursor);
  const cursorX = cursor == null ? null : x(cursor);

  const onHover = (e: MouseEvent<HTMLDivElement>) => {
    if (playing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCursor(Math.max(t0, Math.min(t1, x.invert(e.clientX - rect.left))));
  };

  const togglePlay = () => {
    if (!playing && (cursor == null || cursor >= t1)) setCursor(t0);
    setPlaying((p) => !p);
  };

  const ticks = niceTicks(t0, t1, Math.max(3, Math.floor(width / 110)));

  return (
    <div className="chart" ref={ref}>
      <div onMouseMove={onHover} onMouseLeave={() => !playing && setCursor(null)}>
        {channels.map((ch: Channel, i) => {
          const y = linear(ch.min, ch.max, rowHeight - 4, 4);
          const color = channelColor(ch.key, i);
          const d = linePath(trace.t, ch.values, x, y);
          const value = index == null ? null : ch.values[index];
          return (
            <div className="channel" key={ch.key}>
              <div className="channel-head">
                <span>{pick(lang, ch.label)} <span style={{ opacity: 0.6 }}>· {ch.unit}</span></span>
                <b style={{ color }}>{index == null ? `${fmtValue(lang, ch.min)} … ${fmtValue(lang, ch.max)}` : fmtValue(lang, value)}</b>
              </div>
              <svg width={width} height={rowHeight} style={{ display: "block", marginTop: 4 }}>
                <defs>
                  <clipPath id={`${clipId}-${i}`}><rect x={0} y={0} width={cursorX ?? width} height={rowHeight} /></clipPath>
                </defs>
                {trace.events.map((ev) => (
                  <line key={ev.t} x1={x(ev.t)} x2={x(ev.t)} y1={0} y2={rowHeight} stroke="#e0461f" strokeOpacity={0.35} strokeDasharray="2 3" />
                ))}
                <path d={d} fill="none" stroke={color} strokeOpacity={cursorX == null ? 1 : 0.25} strokeWidth={1.4} />
                {cursorX != null && <path d={d} fill="none" stroke={color} strokeWidth={1.6} clipPath={`url(#${clipId}-${i})`} />}
                {cursorX != null && <line x1={cursorX} x2={cursorX} y1={0} y2={rowHeight} stroke="rgba(232,236,241,.5)" />}
                {cursorX != null && value != null && <circle cx={cursorX} cy={y(value)} r={3.2} fill={color} />}
              </svg>
            </div>
          );
        })}
        <svg width={width} height={22} style={{ display: "block" }}>
          {ticks.map((v) => (
            <text key={v} className="tick" x={x(v)} y={14} textAnchor={x(v) < 20 ? "start" : x(v) > width - 20 ? "end" : "middle"}>{fmtNum(lang, v)}</text>
          ))}
        </svg>
      </div>

      <div className="player">
        <button className="play" onClick={togglePlay} aria-label={playing ? t("flight.pause") : t("flight.play")}>
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <input type="range" min={t0} max={t1} step={(t1 - t0) / 1000} value={cursor ?? t0}
          onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }} aria-label={pick(lang, trace.x_label)} />
        <span className="clock">{cursor == null ? "—" : `${fmtNum(lang, cursor, 1)} ${trace.x_unit}`}</span>
      </div>
      {!compact && trace.events.length > 0 && (
        <div className="events">
          <span className="label" style={{ color: "#8f9aa8" }}>{t("flight.events")}</span>
          {trace.events.map((ev) => (
            <button key={ev.t} className={`event-chip${cursor != null && cursor >= ev.t ? " on" : ""}`}
              onClick={() => { setPlaying(false); setCursor(ev.t); }}>
              {fmtNum(lang, ev.t, 0)} {trace.x_unit} · {pick(lang, ev.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SMOKE_COLORS = { "0g": "#1f64e0", "1g": "#e59a2b" } as const;

export function SmokeChart({ smoke }: { smoke: NonNullable<Workbench["smoke"]> }) {
  const { lang, t } = useStore();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 320;
  const m = { top: 30, right: 16, bottom: 44, left: 46 };
  const d = smoke.diameter_nm;
  const x = logScale(d[0], d[d.length - 1], m.left, width - m.right);
  const y = linear(0, 105, height - m.bottom, m.top);
  const decades = [1, 10, 100, 1000, 10000, 100000].filter((v) => v >= d[0] && v <= d[d.length - 1]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nm = x.invert(e.clientX - rect.left);
    const logs = d.map((v) => Math.log10(v));
    setHover(nearestIndex(logs, Math.log10(nm)));
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {smoke.bands.map((b, i) => (
          <g key={b.id}>
            <rect x={x(b.min_nm)} y={m.top} width={x(b.max_nm) - x(b.min_nm)} height={height - m.top - m.bottom}
              fill={i ? "rgba(13,15,18,0.045)" : "rgba(13,15,18,0.08)"} />
            <text className="tick" x={x(b.min_nm) + 6} y={m.top - 10}>{pick(lang, b.label)}</text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line className="grid" x1={m.left} x2={width - m.right} y1={y(v)} y2={y(v)} />
            <text className="tick" x={m.left - 8} y={y(v) + 3.5} textAnchor="end">{v}</text>
          </g>
        ))}
        {decades.map((v) => (
          <text key={v} className="tick" x={x(v)} y={height - m.bottom + 16} textAnchor="middle">{fmtNum(lang, v)}</text>
        ))}
        <line className="axis" x1={m.left} x2={width - m.right} y1={height - m.bottom} y2={height - m.bottom} />
        <text className="axis-title" x={(m.left + width - m.right) / 2} y={height - 6} textAnchor="middle">{t("flight.smokeX")}</text>
        <text className="axis-title" transform={`translate(12 ${(m.top + height - m.bottom) / 2}) rotate(-90)`} textAnchor="middle">{t("flight.smokeY")}</text>
        {smoke.series.map((s) => (
          <path key={s.key} d={linePath(d, s.norm, x, y)} fill="none" stroke={SMOKE_COLORS[s.gravity]}
            strokeWidth={1.8} strokeDasharray={s.position.startsWith("10") ? "5 4" : undefined} />
        ))}
        {hover != null && <line x1={x(d[hover])} x2={x(d[hover])} y1={m.top} y2={height - m.bottom} stroke="#0d0f12" strokeOpacity={0.4} />}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: x(d[hover]), top: height / 2 }}>
          <div className="label">{fmtNum(lang, d[hover])} nm</div>
          {smoke.series.map((s) => (
            <div key={s.key} className="row" style={{ justifyContent: "space-between", gap: 14 }}>
              <span style={{ color: SMOKE_COLORS[s.gravity] }}>{s.gravity} · {s.position}</span>
              <b className="mono">{fmtNum(lang, s.norm[hover], 1)} %</b>
            </div>
          ))}
        </div>
      )}
      <div className="legend" style={{ marginTop: 8 }}>
        {smoke.series.map((s) => (
          <span key={s.key}>
            <svg width="22" height="8"><path d="M0 4h22" stroke={SMOKE_COLORS[s.gravity]} strokeWidth="2" strokeDasharray={s.position.startsWith("10") ? "5 4" : undefined} /></svg>
            {pick(lang, s.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
