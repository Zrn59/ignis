import type { CSSProperties } from "react";
import { Icon, Loading, PageHead, Readout } from "../components/ui";
import { fmtBytes, fmtDate, fmtNum } from "../i18n";
import { href, useStore } from "../store";

const TEAM = "sulateam";

const RESOURCES: [string, string][] = [
  ["NASA PSI Data Repository: Combustion Science", "https://psi.nasa.gov/physci/repo/search?q=combustion"],
  ["NASA Combustion Science", "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"],
  ["A Researcher’s Guide to ISS Combustion Science", "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/"],
  ["NASA ScienceCasts: The Power of Studying Combustion on the ISS", "https://www.youtube.com/watch?v=W1oXykoz9zg"],
  ["Apollo 1", "https://sma.nasa.gov/sma-disciplines/accllp/apollo-1"],
  ["Apollo 13", "https://sma.nasa.gov/sma-disciplines/accllp/apollo-13"],
  ["25 Years Ago: Fire Aboard Space Station Mir", "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/"],
];

export function EarthPage() {
  const { t, lang, meta, studyById } = useStore();
  if (!meta) return <Loading />;
  return (
    <>
      <PageHead title={t("earth.title")} lead={t("earth.lead")} />
      <div className="wrap page-body">
        <div className="grid-2">
          {meta.earth.map((item) => (
            <article key={item.id} className="panel card">
              <div className="row" style={{ gap: 12 }}>
                <span className="icon"><Icon name={item.icon} /></span>
                <h3 style={{ fontSize: 18, flex: 1 }}>{item.title[lang]}</h3>
              </div>
              <p style={{ color: "var(--ink-2)" }}>{item.text[lang]}</p>
              <div>
                <div className="label">{t("earth.where")}</div>
                <p className="small" style={{ marginTop: 4 }}>{item.where[lang]}</p>
              </div>
              <div className="row" style={{ marginTop: "auto", paddingTop: 8 }}>
                {item.studies.map((id) => (
                  <a key={id} className="tag" href={href(`studies/${id}`)}>{id} · {studyById.get(id)?.short}</a>
                ))}
                <span className="spacer" />
                <a className="link small" href={item.url} target="_blank" rel="noreferrer">{item.source}</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

export function AboutPage() {
  const { t, lang, meta } = useStore();
  if (!meta) return <Loading />;
  const tt = meta.totals;
  const steps = [
    ["about.step1", "about.step1t"],
    ["about.step2", "about.step2t"],
    ["about.step3", "about.step3t"],
    ["about.step4", "about.step4t"],
  ] as const;

  return (
    <>
      <PageHead title={t("about.title")} lead={t("about.lead")} />
      <div className="wrap page-body stack" style={{ "--gap": "48px" } as CSSProperties}>
        <section>
          <h2 style={{ marginBottom: 18 }}>{t("about.how")}</h2>
          <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {steps.map(([title, text], i) => (
              <div key={title} className="panel card">
                <div className="label">{String(i + 1).padStart(2, "0")}</div>
                <h3>{t(title)}</h3>
                <p className="small" style={{ color: "var(--ink-2)" }}>{t(text)}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ marginBottom: 18 }}>{t("about.data")}</h2>
          <div className="readouts panel" style={{ borderRadius: 6 }}>
            <Readout label={t("home.stat.studies")} value={fmtNum(lang, tt.studies)} note={`${tt.flight} ${t("common.flight").toLowerCase()} · ${tt.ground} ${t("common.ground").toLowerCase()}`} />
            <Readout label={t("nav.tables")} value={fmtNum(lang, tt.tables)} note={`${fmtNum(lang, tt.records)} ${t("tables.rows")}`} />
            <Readout label={t("home.stat.tests")} value={fmtNum(lang, tt.tests)} />
            <Readout label={t("study.files")} value={fmtNum(lang, tt.files)} note={fmtBytes(lang, tt.bytes)} />
            <Readout label={t("home.stat.passages")} value={fmtNum(lang, tt.passages)} note={`${tt.documents} PDF`} />
            <Readout label={t("study.publications")} value={fmtNum(lang, tt.publications)} />
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>{t("about.built", { date: fmtDate(lang, tt.built) })}</p>
        </section>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <section>
            <h2 style={{ marginBottom: 14 }}>{t("about.limits")}</h2>
            <ul className="prose" style={{ paddingLeft: 18, margin: 0 }}>
              <li>{t("about.limit1")}</li>
              <li style={{ marginTop: 8 }}>{t("about.limit2")}</li>
              <li style={{ marginTop: 8 }}>{t("about.limit3", { n: fmtNum(lang, tt.missing_files) })}</li>
              <li style={{ marginTop: 8 }}>{t("about.limit4")}</li>
            </ul>
          </section>
          <section>
            <h2 style={{ marginBottom: 14 }}>{t("about.api")}</h2>
            <p className="prose">{t("about.apiText")}</p>
            <div className="label" style={{ marginTop: 18 }}>{t("about.model")}</div>
            <p className="mono small" style={{ marginTop: 6 }}>
              {meta.synthesis.enabled ? meta.synthesis.models.join(", ") : t("about.noModel")}
            </p>
          </section>
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <section>
            <h2 style={{ marginBottom: 14 }}>{t("footer.challenge")}</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {RESOURCES.map(([title, url]) => (
                <li key={url} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                  <a className="link" href={url} target="_blank" rel="noreferrer">{title}</a>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 style={{ marginBottom: 14 }}>{t("about.team")}</h2>
            <p className="mono" style={{ fontSize: 20 }}>{TEAM}</p>
            <p className="small muted" style={{ marginTop: 8 }}>NASA Space Apps Challenge 2026 · Flame in Freefall</p>
          </section>
        </div>
      </div>
    </>
  );
}
