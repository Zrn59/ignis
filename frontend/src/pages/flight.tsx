import { api, type Workbench } from "../api";
import { SmokeChart, TracePlayer } from "../components/telemetry";
import { ErrorBox, Figure, Icon, Loading, PageHead, SectionHead } from "../components/ui";
import { PHOTOS } from "../media";
import type { Key } from "../i18n";
import { fmtNum, pick } from "../i18n";
import { go, href, useAsync, useStore } from "../store";

const MODELS: { id: string; title: Key; note: Key; columns: string[] }[] = [
  { id: "flex", title: "model.flex", note: "model.flexNote", columns: ["run", "fuel", "o2", "p_kpa", "d0_mm", "k_mm2s", "outcome"] },
  { id: "saffire", title: "model.saffire", note: "model.saffireNote", columns: ["sample", "material", "thickness", "flow_cms", "ug_burn", "g1_burn", "g1_rate_raw"] },
  { id: "bass2", title: "model.bass2", note: "model.bass2Note", columns: ["run", "sample", "o2_init", "o2_final", "co_delta_ppm"] },
  { id: "cfig", title: "model.cfig", note: "model.cfigNote", columns: ["run", "fuel", "o2", "p_kpa", "peak_c", "end"] },
];

export function FlightPage({ traceId }: { traceId?: string }) {
  const { t, lang } = useStore();
  const { data, error } = useAsync(() => api.workbench(), []);

  if (error) return <div className="wrap page-body"><ErrorBox message={error} /></div>;
  if (!data) return <Loading />;
  const trace = data.traces.find((tr) => tr.id === traceId) ?? data.traces[0];

  return (
    <>
      <div className="dark">
        <PageHead eyebrow="ISS · Cygnus · CIR · MSG" title={t("flight.title")} lead={t("flight.lead")} photo={PHOTOS.spiceIss} />
        <div className="wrap" style={{ paddingTop: 28, paddingBottom: 56 }}>
          <div className="trace-picker">
            {data.traces.map((tr) => (
              <button key={tr.id} aria-pressed={tr.id === trace.id} onClick={() => go(`flight/${tr.id}`)}>
                <span className="label" style={{ color: "inherit" }}>{tr.family} · {tr.study}{tr.run ? ` · ${tr.run}` : ""}</span>
                <b>{pick(lang, tr.title)}</b>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <div className="row" style={{ alignItems: "flex-start", gap: 24 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <h2 style={{ color: "var(--void-ink)" }}>{pick(lang, trace.title)}</h2>
                <p style={{ color: "var(--ink-2)", marginTop: 8, maxWidth: "80ch" }}>{pick(lang, trace.subtitle)}</p>
              </div>
              <a className="btn on-dark" href={href(`studies/${trace.study}`)}>{trace.study} <Icon name="arrow" /></a>
            </div>
            <div style={{ marginTop: 20 }}>
              <Figure n={1} title={`${pick(lang, trace.x_label)} · ${t("flight.samples", { n: fmtNum(lang, trace.t.length), raw: fmtNum(lang, trace.samples_raw) })}`} source={trace.file}>
                <TracePlayer key={trace.id} trace={trace} />
              </Figure>
            </div>
          </div>
        </div>
      </div>

      {data.smoke && <Smoke smoke={data.smoke} />}
      <Models modeling={data.modeling} />
    </>
  );
}

function Smoke({ smoke }: { smoke: NonNullable<Workbench["smoke"]> }) {
  const { t, studyById } = useStore();
  return (
    <section className="section" style={{ borderTop: 0 }}>
      <div className="wrap">
        <SectionHead overline={`${smoke.study} · ${studyById.get(smoke.study)?.short ?? ""}`} title={t("flight.smokeTitle")} lead={t("flight.smokeLead")}
          aside={<div className="row">{smoke.related.map((id) => <a key={id} className="tag" href={href(`studies/${id}`)}>{id} · {studyById.get(id)?.short}</a>)}</div>} />
        <div className="panel panel-pad">
          <Figure n={2} title={t("flight.smokeTitle")} source={smoke.file}>
            <SmokeChart smoke={smoke} />
          </Figure>
        </div>
      </div>
    </section>
  );
}

function Models({ modeling }: { modeling: Workbench["modeling"] }) {
  const { t, lang } = useStore();
  return (
    <section className="section">
      <div className="wrap">
        <SectionHead title={t("flight.modelTitle")} lead={t("flight.modelLead")} />
        <div className="grid-2">
          {MODELS.filter((m) => modeling[m.id]?.length).map((m) => {
            const rows = modeling[m.id];
            return (
              <div key={m.id} className="panel">
                <div className="panel-head" style={{ alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <h3>{t(m.title)}</h3>
                    <div className="small muted">{t(m.note)} · {t("model.rows", { n: fmtNum(lang, rows.length) })}</div>
                  </div>
                  <a className="btn small" href={api.modelingCsv(m.id)}><Icon name="download" />CSV</a>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data">
                    <thead><tr>{m.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          {m.columns.map((c) => (
                            <td key={c} className={typeof r[c] === "number" ? "n" : undefined}>
                              {typeof r[c] === "number" ? fmtNum(lang, r[c] as number) : (r[c] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
