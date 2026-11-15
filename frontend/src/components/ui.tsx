import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Flag, Proximity, ScorePart, State, Study } from "../api";
import { fmtNum } from "../i18n";
import type { Photo } from "../media";
import { useStore } from "../store";

const paths: Record<string, string> = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
  play: "M7 5l12 7-12 7z",
  pause: "M7 5h4v14H7zM13 5h4v14h-4z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  alert: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
  info: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 11v6M12 7.5v.01",
  droplet: "M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z",
  radar: "M12 12l6-6M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12h.01",
  tank: "M9 3h6M10 3v3M14 3v3M7 9a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z",
  hatch: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM12 3v5M12 16v5M3 12h5M16 12h5",
  menu: "M4 7h16M4 12h16M4 17h16",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.5-5 .3 1.6 1.1 2.6 2.5 3-1-3.2-.5-5.6 0-8z",
  chat: "M4 5h16v11H9l-5 4z",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  swap: "M8 7l-4 5 4 5M16 7l4 5-4 5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  redo: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
};

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}

/** A spherical microgravity flame around a droplet: the project mark. */
export function Logo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="ignis-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd28a" />
          <stop offset=".35" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#fc3d21" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".9" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="#3b82ff" strokeWidth="3" />
      <circle cx="24" cy="24" r="9" fill="url(#ignis-core)" />
      <circle cx="24" cy="24" r="2.6" fill="#fff" />
    </svg>
  );
}

/** NASA-style call to action: label followed by a red circle with an arrow. */
export function Go({ href, onClick, children, small = false, ghost = false, external = false }: {
  href?: string; onClick?: () => void; children: ReactNode; small?: boolean; ghost?: boolean; external?: boolean;
}) {
  const cls = `go${small ? " small" : ""}${ghost ? " ghost" : ""}`;
  const inner = <>{children}<span className="dot"><Icon name={external ? "external" : "arrow"} /></span></>;
  if (href) return <a className={cls} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{inner}</a>;
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

/** Fades a block in once it scrolls into view. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function Loading() {
  return <div className="loading" role="status"><span className="spinner" /></div>;
}

export function ErrorBox({ message }: { message: string }) {
  const { t } = useStore();
  return (
    <div className="note" role="alert">
      <b>{t("common.error")}.</b> <span className="mono small">{message}</span>
    </div>
  );
}

export function StateTag({ state }: { state: State }) {
  const { meta, lang } = useStore();
  return <span className={`tag dot ${state}`}>{meta?.states[state]?.[lang] ?? state}</span>;
}

export function PlatformTag({ study }: { study: Pick<Study, "flight" | "program"> }) {
  const { t } = useStore();
  return study.flight
    ? <span className="tag flight" title={study.program}>{t("common.flight")}</span>
    : <span className="tag">{t("common.ground")}</span>;
}

/** Proximity score as four bars, one per component, so the total is never a black box. */
export function ScoreMeter({ proximity, detailed = false }: { proximity: Proximity; detailed?: boolean }) {
  const { t, lang } = useStore();
  if (!detailed) {
    return (
      <div className="meter" title={proximity.parts.map((p) => `${t(`part.${p.key}`)} ${fmtNum(lang, p.points, 1)}/${p.max}`).join(" · ")}>
        {proximity.parts.map((part) => (
          <i key={part.key} className={part.key} style={{ flex: part.max }}>
            <b style={{ width: `${(part.points / part.max) * 100}%` }} />
          </i>
        ))}
      </div>
    );
  }
  return (
    <div className="stack" style={{ "--gap": "12px" } as CSSProperties}>
      {proximity.parts.map((part) => (
        <div key={part.key}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">{t(`part.${part.key}`)}</span>
            <span className="mono small">{fmtNum(lang, part.points, 1)} / {part.max}</span>
          </div>
          <div className="meter" style={{ marginTop: 6 }}>
            <i className={part.key} style={{ flex: 1 }}><b style={{ width: `${(part.points / part.max) * 100}%` }} /></i>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>{describePart(part, lang, t)}</div>
        </div>
      ))}
    </div>
  );
}

/** One line above a ranked list that says what the number and the coloured bars mean. */
export function ScoreLegend() {
  const { t, env, lang } = useStore();
  if (!env) return null;
  return (
    <div className="score-legend">
      <b>{t("score.title", { env: env.name[lang] })}</b>
      {(["o2", "p", "safety", "g"] as const).map((key) => (
        <span key={key}><i className={key} />{t(`part.${key}`)}</span>
      ))}
      <span className="muted">{t("score.hint")}</span>
    </div>
  );
}

function describePart(part: ScorePart, lang: "ru" | "en", t: ReturnType<typeof useStore>["t"]): string {
  const range = (r: [number, number] | null | undefined, unit: string) =>
    r ? (r[0] === r[1] ? `${fmtNum(lang, r[0])} ${unit}` : `${fmtNum(lang, r[0])}–${fmtNum(lang, r[1])} ${unit}`) : "—";
  if (part.key === "o2") {
    if (part.range) return `${range(part.range, "%")}${part.dist ? ` · Δ ${fmtNum(lang, part.dist)} %` : ""}`;
    if (part.oxidizer) return `${t("study.o2ox")}: ${range(part.oxidizer, "%")}`;
    return t("common.notStated");
  }
  if (part.key === "p") {
    if (!part.range) return t("common.notStated");
    return `${range(part.range, t("common.kpa"))}${part.assumed ? ` (${t("common.assumed")})` : ""}${part.dist ? ` · Δ ${fmtNum(lang, part.dist)}` : ""}`;
  }
  if (part.key === "g") return part.why ? t(`why.${part.why}`) : "";
  return "";
}

export function EnvPicker({ compact = false, grid = false }: { compact?: boolean; grid?: boolean }) {
  const { meta, envId, setEnvId, lang } = useStore();
  if (!meta) return null;
  return (
    <div className={`seg${compact ? " compact" : ""}${grid ? " grid" : ""}`} role="group">
      {meta.environments.map((env) => (
        <button key={env.id} aria-pressed={env.id === envId} onClick={() => setEnvId(env.id)} title={env.note[lang]}>
          <b>{env.name[lang]}</b>
          {!compact && <small>{fmtNum(lang, env.o2)} % · {fmtNum(lang, env.p)} {lang === "ru" ? "кПа" : "kPa"}</small>}
        </button>
      ))}
    </div>
  );
}

const FLAG_LEVEL: Record<Flag, "risk" | "warn" | "info"> = {
  elevated_o2: "risk",
  hyperoxic_pp: "risk",
  no_solid_tests: "warn",
  partial_g_gap: "warn",
  hypoxic_pp: "warn",
  quiescent_sustained: "info",
};

export function FlagList({ flags }: { flags: Flag[] }) {
  const { t } = useStore();
  if (!flags.length) return <div className="flag info"><Icon name="check" /><span>{t("flag.none")}</span></div>;
  return (
    <div>
      {flags.map((flag) => (
        <div key={flag} className={`flag ${FLAG_LEVEL[flag]}`}>
          <Icon name={FLAG_LEVEL[flag] === "info" ? "info" : "alert"} />
          <span>{t(`flag.${flag}`)}</span>
        </div>
      ))}
    </div>
  );
}

export function Figure({ n, title, source, children }: { n: number | string; title: ReactNode; source?: ReactNode; children: ReactNode }) {
  const { t } = useStore();
  return (
    <figure className="figure">
      {children}
      <figcaption>
        <b>{t("common.fig")} {n}</b>
        <span>{title}</span>
        {source && <span className="src">{t("common.source")}: {source}</span>}
      </figcaption>
    </figure>
  );
}

export function Readout({ label, value, unit, note }: { label: ReactNode; value: ReactNode; unit?: string; note?: ReactNode }) {
  return (
    <div className="readout">
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <small>{unit}</small>}</div>
      {note && <div className="sub">{note}</div>}
    </div>
  );
}

export function SectionHead({ overline, title, lead, aside }: { overline?: ReactNode; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <div className="stack">
        {overline && <div className="eyebrow">{overline}</div>}
        <h2>{title}</h2>
        {lead && <p>{lead}</p>}
      </div>
      {aside}
    </div>
  );
}

export function PageHead({ crumbs, eyebrow, title, lead, aside, photo }: {
  crumbs?: ReactNode; eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; aside?: ReactNode; photo?: Photo | null;
}) {
  const { lang } = useStore();
  return (
    <header className="page-head">
      {photo && (
        <figure className="page-head-photo" style={{ margin: 0 }}>
          <img src={photo.src} alt={photo.caption[lang]} />
          <figcaption>{photo.caption[lang]} · {photo.credit}</figcaption>
        </figure>
      )}
      <div className="wrap">
        <div className="row" style={{ alignItems: "flex-end", gap: 32 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            {crumbs && <div className="crumbs">{crumbs}</div>}
            {eyebrow && !crumbs && <div className="eyebrow" style={{ color: "#bdbdbd" }}>{eyebrow}</div>}
            <h1>{title}</h1>
            {lead && <p className="lead">{lead}</p>}
          </div>
          {aside}
        </div>
      </div>
    </header>
  );
}
