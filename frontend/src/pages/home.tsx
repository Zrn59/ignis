import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { api, type Environment, type Faq, type Point, type Simulation } from "../api";
import { AnswerText, SourceList } from "../components/answer";
import { AtmosphereMap, MapLegend, isNear } from "../components/atmosphere-map";
import { FlameCanvas } from "../components/flame";
import { StudyRow } from "../components/study-row";
import { TracePlayer } from "../components/telemetry";
import { EnvPicker, ErrorBox, Figure, FlagList, Icon, Loading, Readout, SectionHead } from "../components/ui";
import { fmtBytes, fmtNum, pick } from "../i18n";
import { go, href, useAsync, useStore } from "../store";

const G_PRESETS = [
  { g: 0, key: "g.0" },
  { g: 0.166, key: "g.moon" },
  { g: 0.38, key: "g.mars" },
  { g: 1, key: "g.earth" },
] as const;

export function HomePage() {
  const { meta, env, envId, lang, t, showTable } = useStore();
  const points = useAsync(() => api.points(), []);
  const rank = useAsync(() => api.rank("", envId, lang), [envId, lang]);
  const sim = useAsync(() => (env ? api.simulate(env.o2, env.p, env.g ?? 0, 20) : Promise.resolve(null)), [env?.id]);
  const workbench = useAsync(() => api.workbench(), []);
  const { studyById } = useStore();

  if (!meta || !env) return <Loading />;
  const totals = meta.totals;
  const saffire = workbench.data?.traces.find((tr) => tr.id === "saffire-3-s1");

  return (
    <>
      <Hero env={env} />

      <div className="wrap">
        <div className="stat-strip" style={{ borderBottom: "1px solid var(--line)" }}>
          <Stat value={fmtNum(lang, totals.studies)} label={t("home.stat.studies")} />
          <Stat value={fmtNum(lang, totals.tests)} label={t("home.stat.tests")} />
          <Stat value={fmtNum(lang, totals.files)} label={t("home.stat.files", { size: fmtBytes(lang, totals.bytes) })} />
          <Stat value={fmtNum(lang, totals.passages)} label={t("home.stat.passages")} />
          <Stat value={fmtNum(lang, totals.traces)} label={t("home.stat.traces")} />
        </div>
      </div>

      <section className="section" style={{ borderTop: 0 }}>
        <div className="wrap">
          <SectionHead title={t("home.mapTitle")} lead={t("home.mapLead")} />
          <div className="split">
            <div className="panel panel-pad">
              {points.error && <ErrorBox message={points.error} />}
              {points.data ? (
                <Figure n={1} title={t("map.caption")} source="22 PSI experimental tables → /api/points">
                  <AtmosphereMap points={points.data} environments={meta.environments} selected={envId}
                    onPick={(pt) => showTable({ id: pt.t, row: pt.r })} />
                  <div style={{ marginTop: 12 }}><MapLegend /></div>
                </Figure>
              ) : <Loading />}
            </div>
            <EnvSummary env={env} points={points.data ?? []} sim={sim.data} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead title={t("home.topTitle", { env: env.name[lang] })} lead={t("home.topLead")}
            aside={<a className="btn" href={href("studies")}>{t("home.allStudies")}</a>} />
          {rank.error && <ErrorBox message={rank.error} />}
          {rank.data ? (
            <div className="rank-list">
              {rank.data.ranking.slice(0, 5).map((r, i) => {
                const study = studyById.get(r.id);
                return study ? <StudyRow key={r.id} position={i + 1} study={study} ranked={r} /> : null;
              })}
            </div>
          ) : <Loading />}
        </div>
      </section>

      <section className="section dark" style={{ borderTop: 0 }}>
        <div className="wrap">
          <SectionHead overline="Saffire-III · PSI-100 · Cygnus" title={t("home.flightTitle")} lead={t("home.flightLead")}
            aside={<a className="btn on-dark" href={href("flight")}>{t("home.flightOpen")}</a>} />
          {saffire ? (
            <Figure n={2} title={pick(lang, saffire.title)} source={saffire.file}>
              <TracePlayer trace={saffire} channels={["plume_c", "rad_mw", "o2_pct", "co2_pct"]} compact />
            </Figure>
          ) : <Loading />}
        </div>
      </section>

      <section className="section" style={{ borderTop: 0 }}>
        <div className="wrap">
          <SectionHead title={t("home.faqTitle")} lead={t("home.faqLead")} />
          <div className="faq">
            {meta.faq.map((item, i) => <FaqItem key={item.id} n={i + 1} item={item} />)}
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function Hero({ env }: { env: Environment }) {
  const { meta, lang, t, envId } = useStore();
  const [question, setQuestion] = useState("");
  const [gOverride, setGOverride] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => setGOverride(null), [envId]);

  const g = gOverride ?? env.g ?? 0;
  const ppo2 = (env.o2 * env.p) / 100;
  const buoyant = 25 * Math.sqrt(g);
  const totals = meta!.totals;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim().length > 1) go("ask", { q: question.trim() });
  };

  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-copy">
          <div className="label">{t("home.overline")}</div>
          <h1>{t("home.title")}</h1>
          <p className="lead">
            {t("home.lead", { studies: totals.studies, tests: fmtNum(lang, totals.tests), files: fmtNum(lang, totals.files) })}
          </p>
          <div className="stack" style={{ "--gap": "10px" } as CSSProperties}>
            <div className="label">{t("env.label")}</div>
            <EnvPicker grid />
            <p className="small muted" style={{ maxWidth: "62ch" }}>
              {env.note[lang]}{env.assumed ? ` · ${t("env.assumed")}` : ""}
            </p>
          </div>
          <form className="ask" onSubmit={submit}>
            <span className="prompt">›</span>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("home.askPlaceholder")} aria-label={t("nav.ask")} />
            <button className="btn primary" type="submit">{t("home.ask")}<Icon name="arrow" /></button>
          </form>
          <p className="small muted" style={{ marginTop: -8 }}>{t("home.askHint")}</p>
        </div>

        <div className="hero-visual">
          <FlameCanvas g={g} o2={env.o2} paused={paused} />
          <div className="hud">
            <div className="hud-row" style={{ alignItems: "flex-start" }}>
              <span className="big">{t("hud.title")}</span>
              <div className="gswitch" role="group" aria-label={t("hud.g")}>
                {G_PRESETS.map((preset) => (
                  <button key={preset.key} aria-pressed={Math.abs(g - preset.g) < 0.01} onClick={() => setGOverride(preset.g)}>
                    {t(preset.key)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="hud-row" style={{ justifyContent: "flex-start", gap: 22, flexWrap: "wrap" }}>
                <span>{t("hud.g")} <b>{fmtNum(lang, g, 3)} g</b></span>
                <span>{t("hud.o2")} <b>{fmtNum(lang, env.o2)} %</b></span>
                <span>{t("hud.p")} <b>{fmtNum(lang, env.p)} {t("common.kpa")}</b></span>
                <span>{t("hud.ppo2")} <b>{fmtNum(lang, ppo2, 1)} {t("common.kpa")}</b></span>
                <span>{t("hud.buoyancy")} <b>{fmtNum(lang, buoyant, 0)} cm/s</b></span>
              </div>
              <div className="hud-row" style={{ marginTop: 8, alignItems: "center" }}>
                <span>{t("hud.caption")}</span>
                <button className="hud-btn" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("hud.play") : t("hud.pause")} title={paused ? t("hud.play") : t("hud.pause")}>
                  <Icon name={paused ? "play" : "pause"} size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EnvSummary({ env, points, sim }: { env: Environment; points: Point[]; sim: Simulation | null }) {
  const { meta, lang, t } = useStore();
  const coverage = meta?.coverage.find((c) => c.id === env.id);
  const nearby = useMemo(() => new Set(points.filter((pt) => isNear(pt, env.o2, env.p)).map((pt) => `${pt.t}:${pt.r}`)).size, [points, env]);
  const ppo2 = (env.o2 * env.p) / 100;

  return (
    <aside className="panel">
      <div className="panel-pad" style={{ paddingBottom: 14 }}>
        <div className="label">{t("env.label")}</div>
        <h3 style={{ fontSize: 22, marginTop: 6 }}>{env.name[lang]}</h3>
        <div className="mono small muted" style={{ marginTop: 4 }}>
          {fmtNum(lang, env.o2)} % O₂ · {fmtNum(lang, env.p)} {t("common.kpa")} · {env.g == null ? "—" : `${fmtNum(lang, env.g, 3)} g`}
        </div>
        {coverage && (
          <div className="row" style={{ marginTop: 10 }}>
            <span className={`status ${coverage.status}`}>{t(`cov.${coverage.status}`)}</span>
            {!coverage.gravity_ok && <span className="tag warn">{t("cov.gravity")}</span>}
          </div>
        )}
      </div>
      <div className="readouts" style={{ borderLeft: 0 }}>
        <Readout label={t("cov.rows")} value={fmtNum(lang, nearby)} note={t("atm.matchingNote")} />
        <Readout label={t("hud.ppo2")} value={fmtNum(lang, ppo2, 1)} unit={t("common.kpa")}
          note={t("atm.ppo2Note", { x: `×${fmtNum(lang, ppo2 / 21.28, 2)}` })} />
      </div>
      <div className="panel-pad" style={{ paddingTop: 6 }}>
        {sim ? <FlagList flags={sim.flags} /> : <Loading />}
        <a className="btn" style={{ marginTop: 14, width: "100%" }}
          href={href("atmosphere", { o2: env.o2, p: env.p, g: env.g ?? 0, flow: 20 })}>
          {t("home.openAtmosphere")}
        </a>
      </div>
    </aside>
  );
}

function FaqItem({ n, item }: { n: number; item: Faq }) {
  const { lang } = useStore();
  const [active, setActive] = useState<number | null>(null);
  return (
    <details>
      <summary>
        <span className="label">{String(n).padStart(2, "0")}</span>
        <span>{item.q[lang]}</span>
      </summary>
      <div className="faq-body grid-2" style={{ alignItems: "start" }}>
        <AnswerText text={item.a[lang]} active={active} onCite={setActive} />
        <div className="panel" style={{ padding: "4px 16px" }}>
          <SourceList sources={item.sources} active={active} />
        </div>
      </div>
    </details>
  );
}
