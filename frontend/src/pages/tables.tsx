import { api } from "../api";
import { ErrorBox, Icon, Loading, PageHead } from "../components/ui";
import { fmtNum } from "../i18n";
import { go, href, useAsync, useStore } from "../store";

export function TablesPage() {
  const { t, lang, showTable, studyById } = useStore();
  const { data, error } = useAsync(() => api.tables(), []);

  return (
    <>
      <PageHead title={t("tables.title")} lead={t("tables.lead")} />
      <div className="wrap page-body">
        {error && <ErrorBox message={error} />}
        {!data ? <Loading /> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>PSI</th>
                  <th>{t("nav.studies")}</th>
                  <th>{t("nav.tables")}</th>
                  <th className="n">{t("tables.rows")}</th>
                  <th className="n">{t("tables.cols")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((tb) => (
                  <tr key={tb.id}>
                    <td className="mono">{tb.study}</td>
                    <td>
                      <a className="link" href={href(`studies/${tb.study}`)}>{tb.short}</a>
                      <div className="small muted">{lang === "ru" ? studyById.get(tb.study)?.title_ru : studyById.get(tb.study)?.title}</div>
                    </td>
                    <td>
                      <b style={{ fontWeight: 500 }}>{tb.label}</b>
                      <div className="mono small muted" style={{ wordBreak: "break-all" }}>{tb.file.split("/").pop()}</div>
                    </td>
                    <td className="n">{fmtNum(lang, tb.rows)}</td>
                    <td className="n">{tb.columns}</td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <a className="btn small ghost" href={api.tableCsv(tb.id)} title={t("common.csv")}><Icon name="download" /></a>
                        <button className="btn small ghost" onClick={() => go("ask", { table: tb.id })} title={t("tables.ask")}><Icon name="chat" /></button>
                        <button className="btn small primary" onClick={() => showTable({ id: tb.id })}>{t("common.open")}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
