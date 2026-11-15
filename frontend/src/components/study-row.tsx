import type { Ranked, Study } from "../api";
import { fmtNum, fmtRange, fmtYears } from "../i18n";
import { studyPhoto } from "../media";
import { href, useStore } from "../store";
import { Icon, PlatformTag, ScoreMeter, StateTag } from "./ui";

export function StudyRow({ position, study, ranked }: { position: number; study: Study; ranked?: Ranked }) {
  const { lang, t, meta, compare, toggleCompare, envId } = useStore();
  const s = study.stats;
  const proximity = ranked?.proximity ?? study.proximity[envId] ?? null;
  const inCompare = compare.includes(study.id);
  const o2 = s.o2_ambient ? fmtRange(lang, s.o2_ambient, "%") : s.o2_oxidizer ? `${fmtRange(lang, s.o2_oxidizer, "%")} (${t("study.o2ox")})` : null;
  const p = s.p ? fmtRange(lang, s.p, t("common.kpa")) : null;

  const photo = studyPhoto(study.id);

  return (
    <article className="rank-item">
      <div className="pos">{String(position).padStart(2, "0")}</div>
      <a className={`thumb${photo ? "" : " empty"}`} href={href(`studies/${study.id}`)} tabIndex={-1} aria-hidden="true">
        {photo ? <img src={photo.src} alt="" loading="lazy" /> : <span>{study.short}</span>}
      </a>
      <div>
        <h3>
          <a href={href(`studies/${study.id}`)}>{study.short}</a>
          <span className="id">{study.id}</span>
        </h3>
        <div className="muted small" style={{ marginTop: 2 }}>{lang === "ru" ? study.title_ru : study.title}</div>
        <p>{study.summary[lang]}</p>
        <div className="facts">
          {o2 && <span>O₂ <b>{o2}</b></span>}
          {p && <span>p <b>{p}</b></span>}
          {s.flow && <span>{t("study.flow")} <b>{fmtRange(lang, s.flow, "cm/s")}</b></span>}
          {s.tests > 0 && <span>{t("study.tests")} <b>{fmtNum(lang, s.tests)}</b></span>}
          {(study.start || study.end) && <span><b>{fmtYears(study.start, study.end)}</b></span>}
        </div>
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          <StateTag state={study.state} />
          <PlatformTag study={study} />
          {study.pillars.map((pl) => <span key={pl} className="tag">{meta?.pillars[pl]?.[lang] ?? pl}</span>)}
          {ranked?.relevance != null && <span className="tag zero-g">{t("studies.topicMatch")} {ranked.relevance}%</span>}
        </div>
      </div>
      <div className="side">
        {proximity && (
          <>
            <div className="score" title={t("studies.score")}>{fmtNum(lang, proximity.score, 1)}<small>/10</small></div>
            <ScoreMeter proximity={proximity} />
          </>
        )}
        <button className={`btn small${inCompare ? " primary" : ""}`} onClick={() => toggleCompare(study.id)}>
          <Icon name={inCompare ? "check" : "plus"} />{inCompare ? t("studies.inCompare") : t("studies.compare")}
        </button>
      </div>
    </article>
  );
}
