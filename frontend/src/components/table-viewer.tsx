import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { fmtNum } from "../i18n";
import { go, useAsync, useStore } from "../store";
import { ErrorBox, Icon, Loading } from "./ui";

const PAGE = 1000;

export function TableViewer() {
  const { openTable, showTable, t, lang } = useStore();
  const id = openTable?.id ?? null;
  const highlight = openTable?.row ?? null;
  const { data, error, loading } = useAsync(() => (id ? api.table(id) : Promise.resolve(null)), [id]);
  const [filter, setFilter] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    setFilter("");
    setShowProfile(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && showTable(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [id, showTable]);

  useEffect(() => {
    rowRef.current?.scrollIntoView({ block: "center" });
  }, [data, highlight]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(q)) || String(r.n) === q);
  }, [data, filter]);

  if (!id) return null;
  const numeric = new Set(data?.profile.filter((c) => c.type === "number").map((c) => c.name));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && showTable(null)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={data?.label ?? id}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="label">{data ? `${data.study} · ${data.short}` : id}</div>
            <h3 style={{ fontSize: 20, marginTop: 4 }}>{data?.label ?? "…"}</h3>
            {data && <div className="mono small muted" style={{ marginTop: 4, wordBreak: "break-all" }}>{data.file}</div>}
          </div>
          <button className="btn ghost small" onClick={() => showTable(null)} aria-label={t("common.close")}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          {loading && <Loading />}
          {error && <ErrorBox message={error} />}
          {data && (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <input className="input" style={{ maxWidth: 320, height: 34 }} placeholder={t("tables.filter")} value={filter}
                  onChange={(e) => setFilter(e.target.value)} />
                <span className="mono small muted">{t("tables.shown", { n: Math.min(rows.length, PAGE), total: data.rows.length })}</span>
                <span className="spacer" />
                <button className="btn small" onClick={() => setShowProfile((v) => !v)}>{t("tables.profile")}</button>
                <a className="btn small" href={api.tableCsv(data.id)}><Icon name="download" />{t("common.csv")}</a>
                <button className="btn small primary" onClick={() => { showTable(null); go("ask", { table: data.id }); }}>
                  {t("tables.ask")}
                </button>
              </div>
              {showProfile && (
                <div className="table-wrap" style={{ marginBottom: 14, maxHeight: 260 }}>
                  <table className="data">
                    <thead><tr><th>#</th><th>{t("tables.profile")}</th><th className="n">{t("tables.filled")}</th><th>min … max / top</th></tr></thead>
                    <tbody>
                      {data.profile.map((c, i) => (
                        <tr key={c.name}>
                          <td className="n">{i + 1}</td>
                          <td>{c.name}</td>
                          <td className="n">{c.filled}/{data.rows.length}</td>
                          <td className="mono small">
                            {c.type === "number"
                              ? `${fmtNum(lang, c.min)} … ${fmtNum(lang, c.max)}`
                              : (c.top ?? []).slice(0, 3).map(([v, n]) => `${v} (${n})`).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="table-wrap" style={{ maxHeight: "62vh" }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th className="n">PSI #</th>
                      {data.columns.map((c) => <th key={c} className={numeric.has(c) ? "n" : undefined}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, PAGE).map((r) => (
                      <tr key={r.n} ref={r.n === highlight ? rowRef : undefined} className={r.n === highlight ? "hl" : undefined}>
                        <td className="n">{r.n}</td>
                        {r.cells.map((c, i) => (
                          <td key={i} className={numeric.has(data.columns[i]) ? "n" : undefined} title={c.length > 40 ? c : undefined}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
