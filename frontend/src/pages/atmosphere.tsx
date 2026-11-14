import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api";
import { AtmosphereMap, MapLegend } from "../components/atmosphere-map";
import { ErrorBox, Figure, FlagList, Loading, PageHead, Readout, ScoreMeter } from "../components/ui";
import { fmtNum } from "../i18n";
import { href, useAsync, useRoute, useStore } from "../store";

const P_MIN = 10;
const P_MAX = 500;
const toSlider = (p: number) => Math.round((1000 * Math.log(p / P_MIN)) / Math.log(P_MAX / P_MIN));
const fromSlider = (s: number) => P_MIN * (P_MAX / P_MIN) ** (s / 1000);

interface Inputs {
  o2: number;
  p: number;
  g: number;
  flow: number;
}

function readInputs(params: URLSearchParams): Inputs {
  const num = (key: string, fallback: number, lo: number, hi: number) => {
    const v = Number(params.get(key));
    return params.has(key) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  };
  return { o2: num("o2", 34, 5, 100), p: num("p", 56.5, P_MIN, P_MAX), g: num("g", 0.166, 0, 1), flow: num("flow", 20, 0, 100) };
}

export function AtmospherePage() {
  const { t, lang, meta, studyById, showTable } = useStore();
  const route = useRoute();
  const [inputs, setInputs] = useState<Inputs>(() => readInputs(route.params));
  const [debounced, setDebounced] = useState(inputs);
  const points = useAsync(() => api.points(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(inputs);
      const round = (v: number) => Math.round(v * 1000) / 1000;
      window.history.replaceState(null, "", href("atmosphere", { o2: round(inputs.o2), p: round(inputs.p), g: round(inputs.g), flow: round(inputs.flow) }));
    }, 160);
    return () => clearTimeout(timer);
  }, [inputs]);

  const sim = useAsync(() => api.simulate(debounced.o2, debounced.p, debounced.g, debounced.flow), [debounced]);
  const set = (patch: Partial<Inputs>) => setInputs((v) => ({ ...v, ...patch }));
  const current = sim.data;

  if (!meta) return <Loading />;

  return (
    <>
      <PageHead title={t("atm.title")} lead={t("atm.lead")} />
      <div className="wrap page-body">
        <div className="split left" style={{ gridTemplateColumns: "300px minmax(0, 1fr)" }}>
          <aside className="sticky stack" style={{ "--gap": "16px" } as CSSProperties}>
            <div className="panel panel-pad">
              <div className="label" style={{ marginBottom: 10 }}>{t("atm.presets")}</div>
              <div className="seg compact">
                {meta.environments.map((env) => (
                  <button key={env.id} title={env.note[lang]}
                    aria-pressed={Math.abs(env.o2 - inputs.o2) < 0.05 && Math.abs(env.p - inputs.p) < 0.2 && Math.abs((env.g ?? 0) - inputs.g) < 0.002}
                    onClick={() => set({ o2: env.o2, p: env.p, g: env.g ?? 0 })}>
                    {env.name[lang]}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel panel-pad">
              <Slider label={t("atm.o2")} value={`${fmtNum(lang, inputs.o2, 1)} %`}>
                <input type="range" min={5} max={100} step={0.5} value={inputs.o2} onChange={(e) => set({ o2: Number(e.target.value) })} />
              </Slider>
              <Slider label={t("atm.p")} value={`${fmtNum(lang, inputs.p, 1)} ${t("common.kpa")} · ${fmtNum(lang, inputs.p / 6.89476, 1)} psi`}>
                <input type="range" min={0} max={1000} value={toSlider(inputs.p)} onChange={(e) => set({ p: Math.round(fromSlider(Number(e.target.value)) * 10) / 10 })} />
              </Slider>
              <Slider label={t("atm.g")} value={`${fmtNum(lang, inputs.g, 3)} g`}>
                <input type="range" min={0} max={1} step={0.001} value={inputs.g} list="g-marks" onChange={(e) => set({ g: Number(e.target.value) })} />
                <datalist id="g-marks"><option value="0" /><option value="0.166" /><option value="0.38" /><option value="1" /></datalist>
              </Slider>
              <Slider label={t("atm.flow")} value={`${fmtNum(lang, inputs.flow, 0)} cm/s`}>
                <input type="range" min={0} max={100} step={1} value={inputs.flow} onChange={(e) => set({ flow: Number(e.target.value) })} />
              </Slider>
            </div>
            <div className="panel panel-pad mono small muted">
              pO₂ = x<sub>O₂</sub> · P = {fmtNum(lang, inputs.o2 / 100, 3)} · {fmtNum(lang, inputs.p, 1)} = <b style={{ color: "var(--ink)" }}>{fmtNum(lang, (inputs.o2 * inputs.p) / 100, 2)} {t("common.kpa")}</b>
            </div>
          </aside>

          <div className="stack" style={{ "--gap": "24px" } as CSSProperties}>
            {sim.error && <ErrorBox message={sim.error} />}
            <div className="readouts panel" style={{ borderRadius: 6 }}>
              <Readout label={t("atm.ppo2")} value={current ? fmtNum(lang, current.physics.pp_o2_kpa, 1) : "…"} unit={t("common.kpa")}
                note={current && t("atm.ppo2Note", { x: `×${fmtNum(lang, current.physics.earth_pp_ratio, 2)}` })} />
              <Readout label={t("atm.equiv")} value={current ? fmtNum(lang, current.physics.normoxic_o2_pct, 1) : "…"} unit="%" note={t("atm.equivNote")} />
              <Readout label={t("atm.buoyant")} value={current ? fmtNum(lang, current.physics.buoyant_vel_cms, 0) : "…"} unit="cm/s" note={t("atm.buoyantNote")} />
              <Readout label={t("atm.matching")} value={current ? fmtNum(lang, current.physics.matching_records) : "…"} note={t("atm.matchingNote")} />
            </div>

            <section className="panel panel-pad">
              {points.data ? (
                <Figure n={1} title={t("map.caption")} source="/api/points · /api/simulate">
                  <AtmosphereMap points={points.data} environments={meta.environments} marker={{ o2: inputs.o2, p: inputs.p }}
                    onPick={(pt) => showTable({ id: pt.t, row: pt.r })} />
                  <div style={{ marginTop: 12 }}><MapLegend /></div>
                </Figure>
              ) : <Loading />}
            </section>

            <div className="grid-2" style={{ alignItems: "start" }}>
              <section className="panel">
                <div className="panel-head"><h3>{t("atm.flags")}</h3></div>
                <div className="panel-pad" style={{ paddingTop: 4 }}>{current ? <FlagList flags={current.flags} /> : <Loading />}</div>
              </section>
              <section className="panel">
                <div className="panel-head"><h3>{t("atm.ranking")}</h3></div>
                <div style={{ padding: "4px 18px 10px" }}>
                  {current?.studies.slice(0, 7).map((s) => (
                    <a key={s.id} href={href(`studies/${s.id}`)} className="row" style={{ padding: "9px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" }}>
                      <span className="mono small muted" style={{ width: 62 }}>{s.id}</span>
                      <span style={{ flex: 1 }}>{s.short}</span>
                      <span style={{ width: 90 }}><ScoreMeter proximity={s.proximity} /></span>
                      <b className="mono small" style={{ width: 34, textAlign: "right" }}>{fmtNum(lang, s.proximity.score, 1)}</b>
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head"><h3>{t("atm.nearest")}</h3><span className="muted small">{t("atm.nearestLead")}</span></div>
              <table className="data">
                <thead>
                  <tr><th>PSI</th><th>{t("nav.studies")}</th><th>{t("study.fuels")}</th><th className="n">O₂</th><th className="n">p</th><th className="n">{t("atm.dist")}</th><th /></tr>
                </thead>
                <tbody>
                  {current?.nearest.map((pt) => (
                    <tr key={`${pt.t}-${pt.r}`} className="clickable" onClick={() => showTable({ id: pt.t, row: pt.r })}>
                      <td className="mono">{pt.s}</td>
                      <td>{studyById.get(pt.s)?.short}</td>
                      <td>{pt.f ?? "—"}</td>
                      <td className="n">{fmtNum(lang, pt.o2)} %</td>
                      <td className="n">{pt.p == null ? "—" : `${fmtNum(lang, pt.p)} ${t("common.kpa")}`}</td>
                      <td className="n muted">{pt.dist != null ? fmtNum(lang, pt.dist, 2) : ""}</td>
                      <td className="n muted">{t("map.pointRow", { r: pt.r })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <div className="panel-head"><h3>{t("atm.coverage")}</h3></div>
              <table className="data">
                <tbody>
                  {meta.coverage.map((c) => {
                    const env = meta.environments.find((e) => e.id === c.id)!;
                    return (
                      <tr key={c.id} className="clickable" onClick={() => { set({ o2: env.o2, p: env.p, g: env.g ?? 0 }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                        <td><b style={{ fontWeight: 500 }}>{env.name[lang]}</b></td>
                        <td className="mono small">{fmtNum(lang, env.o2)} % · {fmtNum(lang, env.p)} {t("common.kpa")}</td>
                        <td><span className={`status ${c.status}`}>{t(`cov.${c.status}`)}</span></td>
                        <td className="n">{c.rows} {t("common.tests")}</td>
                        <td className="small muted">{c.studies.map(([sid, n]) => `${studyById.get(sid)?.short ?? sid} (${n})`).join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function Slider({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="slider">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {children}
    </label>
  );
}
