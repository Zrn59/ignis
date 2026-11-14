import { useEffect, useMemo, useState } from "react";
import { api, type Pillar, type State, type Study } from "../api";
import { StudyRow } from "../components/study-row";
import { EnvPicker, ErrorBox, Icon, Loading, PageHead } from "../components/ui";
import { fmtNum } from "../i18n";
import { go, useAsync, useRoute, useStore } from "../store";

type Filters = { state: Set<State>; pillar: Set<Pillar>; platform: Set<"flight" | "ground">; group: Set<string> };

const empty = (): Filters => ({ state: new Set(), pillar: new Set(), platform: new Set(), group: new Set() });

function matches(study: Study, f: Filters) {
  if (f.state.size && !f.state.has(study.state)) return false;
  if (f.pillar.size && !study.pillars.some((p) => f.pillar.has(p))) return false;
  if (f.platform.size && !f.platform.has(study.flight ? "flight" : "ground")) return false;
  if (f.group.size && !f.group.has(study.group)) return false;
  return true;
}

export function StudiesPage() {
  const { t, lang, envId, studies, studyById, meta, showTable } = useStore();
  const route = useRoute();
  const urlQuery = route.params.get("q") ?? "";
  const [draft, setDraft] = useState(urlQuery);
  const [filters, setFilters] = useState<Filters>(empty);

  useEffect(() => setDraft(urlQuery), [urlQuery]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== urlQuery) go("studies", { q: draft.trim() || null });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, urlQuery]);

  const rank = useAsync(() => api.rank(urlQuery, envId, lang), [urlQuery, envId, lang]);

  const toggle = <K extends keyof Filters>(key: K, value: Filters[K] extends Set<infer V> ? V : never) =>
    setFilters((f) => {
      const next = new Set(f[key] as Set<unknown>);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...f, [key]: next };
    });

  const visible = useMemo(
    () => (rank.data?.ranking ?? []).filter((r) => {
      const s = studyById.get(r.id);
      return s && matches(s, filters);
    }),
    [rank.data, studyById, filters],
  );

  const count = (pred: (s: Study) => boolean) => studies.filter(pred).length;
  const active = filters.state.size + filters.pillar.size + filters.platform.size + filters.group.size;

  return (
    <>
      <PageHead title={t("studies.title")} lead={t("studies.lead")} />
      <div className="wrap page-body">
        <div className="split left">
          <aside className="sticky">
            <div className="filter-group">
              <span className="label">{t("env.label")}</span>
              <EnvPicker compact />
            </div>
            <div className="filter-group">
              <span className="label">{t("studies.state")}</span>
              {(["solid", "liquid", "gas", "aerosol"] as State[]).map((s) => (
                <label key={s} className="check">
                  <input type="checkbox" checked={filters.state.has(s)} onChange={() => toggle("state", s)} />
                  {meta?.states[s][lang]}<span className="count">{count((x) => x.state === s)}</span>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span className="label">{t("studies.pillar")}</span>
              {(["prevention", "detection", "suppression", "fundamentals"] as Pillar[]).map((p) => (
                <label key={p} className="check">
                  <input type="checkbox" checked={filters.pillar.has(p)} onChange={() => toggle("pillar", p)} />
                  {meta?.pillars[p][lang]}<span className="count">{count((x) => x.pillars.includes(p))}</span>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span className="label">{t("studies.platform")}</span>
              {(["flight", "ground"] as const).map((p) => (
                <label key={p} className="check">
                  <input type="checkbox" checked={filters.platform.has(p)} onChange={() => toggle("platform", p)} />
                  {t(p === "flight" ? "common.flight" : "common.ground")}
                  <span className="count">{count((x) => x.flight === (p === "flight"))}</span>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <span className="label">{t("studies.group")}</span>
              {Object.keys(meta?.groups ?? {}).map((g) => (
                <label key={g} className="check" title={meta?.groups[g][lang]}>
                  <input type="checkbox" checked={filters.group.has(g)} onChange={() => toggle("group", g)} />
                  {g}<span className="count">{count((x) => x.group === g)}</span>
                </label>
              ))}
            </div>
            {active > 0 && <button className="btn small ghost" style={{ marginTop: 16 }} onClick={() => setFilters(empty())}>{t("studies.reset")}</button>}
          </aside>

          <div>
            <div className="ask" style={{ marginBottom: 8 }}>
              <Icon name="search" />
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("studies.query")} aria-label={t("studies.query")} />
              <span className="mono small muted nowrap" style={{ paddingRight: 8 }}>
                {t("studies.count", { n: visible.length, total: studies.length })}
              </span>
            </div>
            {rank.data && rank.data.terms.length > 0 && (
              <div className="row small muted" style={{ marginBottom: 8 }}>
                {rank.data.terms.map((term) => <span key={term} className="tag">{term}</span>)}
              </div>
            )}
            {rank.data && rank.data.nearest.length > 0 && (
              <div className="panel" style={{ margin: "12px 0 8px" }}>
                <div className="panel-head"><h3>{t("atm.nearest")}</h3></div>
                <table className="data">
                  <tbody>
                    {rank.data.nearest.map((pt) => (
                      <tr key={`${pt.t}-${pt.r}`} className="clickable" onClick={() => showTable({ id: pt.t, row: pt.r })}>
                        <td className="mono">{pt.s}</td>
                        <td>{studyById.get(pt.s)?.short}</td>
                        <td>{pt.f}</td>
                        <td className="n">{fmtNum(lang, pt.o2)} %</td>
                        <td className="n">{pt.p == null ? "—" : `${fmtNum(lang, pt.p)} ${t("common.kpa")}`}</td>
                        <td className="n muted">{t("map.pointRow", { r: pt.r })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rank.error && <ErrorBox message={rank.error} />}
            {rank.loading && !rank.data && <Loading />}
            <div className="rank-list" style={{ opacity: rank.loading ? 0.55 : 1 }}>
              {visible.map((r, i) => {
                const study = studyById.get(r.id)!;
                return <StudyRow key={r.id} position={i + 1} study={study} ranked={r} />;
              })}
            </div>
            {rank.data && visible.length === 0 && <div className="empty">{t("studies.empty")}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
