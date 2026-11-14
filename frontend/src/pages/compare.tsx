import { useState, type ReactNode } from "react";
import type { Study } from "../api";
import { Icon, PageHead, PlatformTag, ScoreMeter, StateTag } from "../components/ui";
import { fmtNum, fmtRange, fmtYears, type Key } from "../i18n";
import { href, useStore } from "../store";

interface Row {
  key: Key;
  text: (s: Study) => string;
  view?: (s: Study) => ReactNode;
}

export function ComparePage() {
  const { t, lang, studies, studyById, compare, setCompare, toggleCompare, meta, envId, env } = useStore();
  const [diffOnly, setDiffOnly] = useState(false);
  const chosen = compare.map((id) => studyById.get(id)).filter((s): s is Study => Boolean(s));

  const rows: Row[] = [
    { key: "study.program", text: (s) => `${s.flight ? "flight" : "ground"} ${s.program}`, view: (s) => <><PlatformTag study={s} /> <span className="small">{s.program}</span></> },
    { key: "study.hardware", text: (s) => s.hardware },
    { key: "studies.state", text: (s) => s.state, view: (s) => <StateTag state={s.state} /> },
    { key: "study.fuel", text: (s) => s.fuel_text[lang] },
    { key: "study.o2", text: (s) => fmtRange(lang, s.stats.o2_ambient, "%") },
    { key: "study.o2ox", text: (s) => fmtRange(lang, s.stats.o2_oxidizer, "%") },
    { key: "study.p", text: (s) => (s.stats.p ? fmtRange(lang, s.stats.p, t("common.kpa")) : s.stats.p_assumed ? `${fmtNum(lang, s.stats.p_assumed)} ${t("common.kpa")} (${t("common.assumed")})` : "—") },
    { key: "study.flow", text: (s) => fmtRange(lang, s.stats.flow, "cm/s") },
    { key: "study.tests", text: (s) => fmtNum(lang, s.stats.tests) },
    { key: "study.period", text: (s) => fmtYears(s.start, s.end) },
    { key: "study.sensors", text: (s) => s.sensors[lang] },
    { key: "study.varied", text: (s) => s.varied[lang] },
    { key: "study.safety", text: (s) => s.safety_link[lang] },
    { key: "studies.pillar", text: (s) => s.pillars.map((p) => meta?.pillars[p][lang]).join(", ") },
    {
      key: "studies.score",
      text: (s) => String(s.proximity[envId]?.score ?? ""),
      view: (s) => s.proximity[envId] && (
        <div style={{ maxWidth: 180 }}>
          <span className="score">{fmtNum(lang, s.proximity[envId].score, 1)}<small>/10</small></span>
          <div style={{ marginTop: 6 }}><ScoreMeter proximity={s.proximity[envId]} /></div>
        </div>
      ),
    },
    { key: "study.tables", text: (s) => s.tables.map((tb) => `${tb.label} (${tb.rows})`).join(", ") || "—" },
    { key: "study.files", text: (s) => `${fmtNum(lang, s.files.total)}` },
    { key: "study.publications", text: (s) => String(s.publications) },
  ];

  const visibleRows = rows.filter((r) => !diffOnly || new Set(chosen.map(r.text)).size > 1);

  return (
    <>
      <PageHead title={t("compare.title")} lead={t("compare.lead")} />
      <div className="wrap page-body">
        <div className="row" style={{ marginBottom: 18 }}>
          {chosen.map((s) => (
            <span key={s.id} className="tag" style={{ padding: "6px 8px", fontSize: 12 }}>
              {s.id} · {s.short}
              <button onClick={() => toggleCompare(s.id)} aria-label={t("compare.remove")}><Icon name="close" size={12} /></button>
            </span>
          ))}
          {chosen.length < 4 && (
            <select className="input" style={{ width: 260, height: 32 }} value="" onChange={(e) => e.target.value && toggleCompare(e.target.value)}>
              <option value="">{t("compare.add")}</option>
              {studies.filter((s) => !compare.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.id} · {s.short}</option>)}
            </select>
          )}
          <span className="spacer" />
          {chosen.length > 1 && (
            <label className="check"><input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} />{t("compare.diffOnly")}</label>
          )}
        </div>

        {chosen.length === 0 ? (
          <div className="panel empty">
            <p>{t("compare.empty")}</p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setCompare(["PSI-98", "PSI-99", "PSI-100"])}>{t("compare.suggest")}</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data" style={{ fontSize: 13.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 170 }} />
                  {chosen.map((s) => (
                    <th key={s.id} style={{ textTransform: "none", letterSpacing: 0, minWidth: 220 }}>
                      <a href={href(`studies/${s.id}`)} style={{ font: "600 16px var(--sans)", color: "var(--ink)" }}>{s.short}</a>
                      <div className="mono" style={{ fontWeight: 400, marginTop: 2 }}>{s.id}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const differs = new Set(chosen.map(r.text)).size > 1;
                  return (
                    <tr key={r.key}>
                      <td className="label" style={{ verticalAlign: "top" }}>
                        {differs && chosen.length > 1 && <span title="≠" style={{ color: "var(--flame)", marginRight: 6 }}>●</span>}
                        {r.key === "studies.score" && env ? `${t(r.key)} · ${env.name[lang]}` : t(r.key)}
                      </td>
                      {chosen.map((s) => <td key={s.id}>{r.view ? r.view(s) : r.text(s)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
