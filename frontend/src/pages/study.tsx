import { useState, type CSSProperties, type MouseEvent } from "react";
import { api, type StudyFull } from "../api";
import { AtmosphereMap, MapLegend } from "../components/atmosphere-map";
import { linear, useWidth } from "../components/chart-utils";
import { EnvPicker, ErrorBox, Figure, Icon, Loading, PageHead, PlatformTag, Readout, ScoreMeter, StateTag } from "../components/ui";
import { fmtBytes, fmtDate, fmtNum, fmtRange, fmtYears } from "../i18n";
import { go, href, useAsync, useStore } from "../store";

export function StudyPage({ id }: { id: string }) {
  const { t, lang, env, envId, meta, compare, toggleCompare, showTable } = useStore();
  const { data: study, error } = useAsync(() => api.study(id), [id]);
  const points = useAsync(() => api.points(), []);

  if (error) return <div className="wrap page-body"><ErrorBox message={error} /></div>;
  if (!study || !meta) return <Loading />;

  const s = study.stats;
  const proximity = study.proximity[envId];
  const ownPoints = (points.data ?? []).filter((p) => p.s === study.id);
  const inCompare = compare.includes(study.id);

  return (
    <>
      <PageHead
        crumbs={<><a href={href("studies")}>{t("nav.studies")}</a><span>/</span><span>{study.id}</span></>}
        title={<>{study.short}{study.acronym !== study.short && <span className="muted" style={{ fontWeight: 400 }}> · {study.acronym}</span>}</>}
        lead={<>{lang === "ru" ? study.title_ru : study.title}. {study.summary[lang]}</>}
        aside={
          <div className="row">
            <button className={`btn${inCompare ? " primary" : ""}`} onClick={() => toggleCompare(study.id)}>
              <Icon name={inCompare ? "check" : "plus"} />{inCompare ? t("studies.inCompare") : t("studies.compare")}
            </button>
            <a className="btn" href={study.psi_url} target="_blank" rel="noreferrer"><Icon name="external" />{t("study.openPsi")}</a>
            <button className="btn flame" onClick={() => go("ask", { study: study.id })}><Icon name="chat" />{t("study.ask")}</button>
          </div>
        }
      />
      <div className="wrap page-body">
        <div className="split">
          <div className="stack" style={{ "--gap": "28px" } as CSSProperties}>
            <div className="row" style={{ gap: 6 }}>
              <StateTag state={study.state} />
              <PlatformTag study={study} />
              {study.pillars.map((p) => <span key={p} className="tag">{meta.pillars[p][lang]}</span>)}
              <span className="tag">{study.group}</span>
            </div>

            <section>
              <div className="label" style={{ marginBottom: 10 }}>{t("study.conditions")}</div>
              <div className="readouts panel" style={{ borderRadius: 6 }}>
                <Readout label={t("study.o2")} value={s.o2_ambient ? fmtRange(lang, s.o2_ambient) : "—"} unit={s.o2_ambient ? "%" : undefined}
                  note={s.o2_oxidizer ? `${t("study.o2ox")}: ${fmtRange(lang, s.o2_oxidizer, "%")}` : undefined} />
                <Readout label={t("study.p")} value={s.p ? fmtRange(lang, s.p) : s.p_assumed ? fmtNum(lang, s.p_assumed) : "—"}
                  unit={s.p || s.p_assumed ? t("common.kpa") : undefined} note={!s.p && s.p_assumed ? t("common.assumed") : undefined} />
                <Readout label={t("study.flow")} value={s.flow ? fmtRange(lang, s.flow) : "—"} unit={s.flow ? "cm/s" : undefined} />
                <Readout label={t("study.tests")} value={fmtNum(lang, s.tests)}
                  note={s.first_test ? `${fmtDate(lang, s.first_test, false)} – ${fmtDate(lang, s.last_test, false)}` : undefined} />
              </div>
            </section>

            <dl className="kv">
              <dt>{t("study.fuel")}</dt>
              <dd>
                {study.fuel_text[lang]}
                {s.fuels.length > 0 && (
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    {s.fuels.map(([fuel, n]) => <span key={fuel} className="tag">{fuel} · {n}</span>)}
                  </div>
                )}
              </dd>
              <dt>{t("study.sensors")}</dt><dd>{study.sensors[lang]}</dd>
              <dt>{t("study.varied")}</dt><dd>{study.varied[lang]}</dd>
              <dt>{t("study.safety")}</dt><dd>{study.safety_link[lang]}</dd>
            </dl>

            {(study.objective || study.approach) && (
              <details className="faq" style={{ borderTop: 0 }}>
                <summary style={{ fontSize: 14 }}>
                  <span className="label">PSI</span>
                  <span>{t("study.record")}</span>
                </summary>
                <dl className="kv" lang="en" style={{ marginBottom: 8 }}>
                  {study.objective && <><dt>{t("study.objective")}</dt><dd>{study.objective}</dd></>}
                  {study.approach && <><dt>{t("study.approach")}</dt><dd>{study.approach}</dd></>}
                  {study.hypothesis && <><dt>{t("study.hypothesis")}</dt><dd>{study.hypothesis}</dd></>}
                  {study.impacts && <><dt>{t("study.impacts")}</dt><dd>{study.impacts}</dd></>}
                </dl>
              </details>
            )}

            {ownPoints.length > 0 && (
              <section className="panel panel-pad">
                <Figure n={1} title={t("study.points")} source={study.tables.map((tb) => tb.file).join(", ")}>
                  <AtmosphereMap points={points.data ?? []} environments={meta.environments} selected={envId} study={study.id}
                    height={360} onPick={(pt) => showTable({ id: pt.t, row: pt.r })} />
                  <div style={{ marginTop: 10 }}><MapLegend /></div>
                </Figure>
              </section>
            )}

            {study.timeline.length > 1 && (
              <section className="panel panel-pad">
                <Figure n={ownPoints.length ? 2 : 1} title={t("study.timeline")} source={study.tables[0]?.file}>
                  <TestDays study={study} />
                </Figure>
              </section>
            )}

            <section>
              <div className="label" style={{ marginBottom: 10 }}>{t("study.tables")}</div>
              {study.tables.length === 0 && <p className="muted">{t("study.noTables")}</p>}
              {study.tables.map((tb) => (
                <div key={tb.id} className="panel row" style={{ padding: "12px 16px", marginBottom: 8 }}>
                  <Icon name="table" />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b>{tb.label}</b>
                    <div className="mono small muted">{tb.rows} {t("tables.rows")} · {tb.columns} {t("tables.cols")}</div>
                  </div>
                  <a className="btn small" href={api.tableCsv(tb.id)}><Icon name="download" />CSV</a>
                  <button className="btn small primary" onClick={() => showTable({ id: tb.id })}>{t("common.open")}</button>
                </div>
              ))}
            </section>

            <Files study={study} />

            {study.publications.length > 0 && (
              <section>
                <div className="label" style={{ marginBottom: 10 }}>{t("study.publications")} · {study.publications.length}</div>
                <ol className="small" style={{ margin: 0, paddingLeft: 20, color: "var(--ink-2)" }}>
                  {study.publications.slice(0, 12).map((p, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      {p.authors && <span className="muted">{p.authors}. </span>}
                      {p.doi ? <a className="link" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <aside className="sticky stack" style={{ "--gap": "16px" } as CSSProperties}>
            {proximity && env && (
              <div className="panel panel-pad">
                <div className="label">{t("study.scoreFor", { env: env.name[lang] })}</div>
                <div className="score" style={{ fontSize: 40, margin: "10px 0 16px" }}>{fmtNum(lang, proximity.score, 1)}<small>/10</small></div>
                <ScoreMeter proximity={proximity} detailed />
                <div style={{ marginTop: 16 }}><EnvPicker compact /></div>
              </div>
            )}
            <div className="panel panel-pad">
              <dl className="kv" style={{ gridTemplateColumns: "110px 1fr", borderTop: 0 }}>
                <dt>{t("study.program")}</dt><dd>{study.program}</dd>
                <dt>{t("study.hardware")}</dt><dd>{study.hardware}</dd>
                <dt>{t("study.center")}</dt><dd>{study.center}</dd>
                <dt>{t("study.period")}</dt><dd>{fmtYears(study.start, study.end)}</dd>
                {study.doi && <><dt>DOI</dt><dd><a className="link mono small" href={study.doi_url ?? "#"} target="_blank" rel="noreferrer">{study.doi}</a></dd></>}
                <dt>{t("study.license")}</dt><dd className="small">{study.license}</dd>
              </dl>
            </div>
            {study.people.length > 0 && (
              <div className="panel panel-pad">
                <div className="label" style={{ marginBottom: 8 }}>{t("study.people")}</div>
                {study.people.map((p) => (
                  <div key={p.name} style={{ padding: "6px 0" }}>
                    <b style={{ fontWeight: 500 }}>{p.name}</b>
                    <div className="small muted">{p.role} · {p.affiliation}</div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function TestDays({ study }: { study: StudyFull }) {
  const { lang, showTable, t } = useStore();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const days = study.timeline;
  const height = 150;
  const time = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const t0 = time(days[0].date);
  const t1 = time(days[days.length - 1].date);
  const x = linear(t0, t1 || t0 + 1, 8, width - 8);
  const maxTests = Math.max(...days.map((d) => d.tests));
  const y = linear(0, maxTests, height - 26, 6);
  const years: number[] = [];
  for (let yr = new Date(t0).getUTCFullYear(); yr <= new Date(t1).getUTCFullYear(); yr++) years.push(yr);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const mx = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    days.forEach((d, i) => {
      if (Math.abs(x(time(d.date)) - mx) < Math.abs(x(time(days[best].date)) - mx)) best = i;
    });
    setHover(best);
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        onClick={() => hover != null && showTable({ id: days[hover].table, row: days[hover].first_row })} style={{ cursor: "pointer" }}>
        {years.map((yr) => {
          const px = x(Date.UTC(yr, 0, 1));
          return px >= 0 && px <= width ? (
            <g key={yr}>
              <line className="grid" x1={px} x2={px} y1={0} y2={height - 26} />
              <text className="tick" x={px + 4} y={height - 10}>{yr}</text>
            </g>
          ) : null;
        })}
        {days.map((d, i) => (
          <rect key={d.date + i} x={x(time(d.date)) - 1.5} y={y(d.tests)} width={3} height={height - 26 - y(d.tests)}
            fill={i === hover ? "#e0461f" : "#0d0f12"} />
        ))}
        <line className="axis" x1={0} x2={width} y1={height - 26} y2={height - 26} />
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: x(time(days[hover].date)), top: 50 }}>
          <div className="label">{fmtDate(lang, days[hover].date)}</div>
          <div>{days[hover].tests} {t("common.tests")} · {days[hover].fuels.join(", ")}</div>
          <div className="mono" style={{ color: "#8f9aa8", fontSize: 11.5 }}>{t("map.pointRow", { r: days[hover].first_row })}</div>
        </div>
      )}
    </div>
  );
}

function Files({ study }: { study: StudyFull }) {
  const { t, lang } = useStore();
  const [folder, setFolder] = useState<string | null>(null);
  const list = useAsync(() => (folder ? api.files(study.id, folder) : Promise.resolve(null)), [study.id, folder]);

  return (
    <section>
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="label">{t("study.files")} · {fmtNum(lang, study.files.total)} · {fmtBytes(lang, study.files.bytes)}</span>
        {study.missing_files > 0 && <span className="tag warn">{t("study.missing", { n: study.missing_files })}</span>}
      </div>
      <div className="tabs" role="tablist">
        {study.files.folders.map(([name, n]) => (
          <button key={name} role="tab" aria-selected={folder === name} onClick={() => setFolder(folder === name ? null : name)}>
            {name} <span className="mono small muted">{n}</span>
          </button>
        ))}
      </div>
      {folder && (
        <div className="table-wrap" style={{ maxHeight: 320, marginTop: 12 }}>
          {list.loading && <Loading />}
          {list.data && (
            <table className="data">
              <tbody>
                {list.data.files.map((f) => (
                  <tr key={f.name}>
                    <td className="mono small" style={{ wordBreak: "break-all" }}>{f.name}</td>
                    <td className="mono small muted">{f.ext}</td>
                    <td className="n">{fmtBytes(lang, f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
