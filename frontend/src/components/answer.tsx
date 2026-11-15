import { Fragment, useState, type ReactNode } from "react";
import type { Answer, Source } from "../api";
import { fmtNum, type Key } from "../i18n";
import { useStore } from "../store";
import { Icon } from "./ui";

function withCitations(line: string, active: number | null, onCite?: (n: number) => void): ReactNode[] {
  return line.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const m = part.match(/^\[(\d{1,2})\]$/);
    if (!m) return <Fragment key={i}>{part}</Fragment>;
    const n = Number(m[1]);
    return (
      <button key={i} className={`cite${active === n ? " on" : ""}`} onClick={() => onCite?.(n)} aria-label={`source ${n}`}>
        {n}
      </button>
    );
  });
}

/** The backend sends plain text: paragraphs split by blank lines, list items starting with "- ". */
export function AnswerText({ text, active = null, onCite }: { text: string; active?: number | null; onCite?: (n: number) => void }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{withCitations(item, active, onCite)}</li>)}</ul>);
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      list.push(line.replace(/^[-•*]\s+/, ""));
      continue;
    }
    flush();
    blocks.push(<p key={blocks.length}>{withCitations(line, active, onCite)}</p>);
  }
  flush();
  return <div className="answer">{blocks}</div>;
}

type Level = "ok" | "warn" | "bad" | "info";

function CheckLine({ level, children }: { level: Level; children: ReactNode }) {
  const icon = level === "ok" ? "check" : level === "info" ? "info" : "alert";
  return (
    <li className={`check-line ${level}`}>
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </li>
  );
}

/** What the backend checked, written out as a short list a reader can trust or doubt. */
export function Verification({ answer }: { answer: Answer }) {
  const { t, lang } = useStore();
  const { check } = answer;
  const misplaced = check.misplaced_numbers ?? [];
  const statements = check.statements ?? 0;
  const withCite = check.cited_statements ?? check.cited.length;
  const numbers = check.numbers_checked ?? 0;
  const model = answer.model?.split("/").pop()?.replace(":free", "");

  if (answer.mode === "none") return <div className="note warn" style={{ marginTop: 16 }}>{t("ask.none")}</div>;

  return (
    <div className="check-box">
      {answer.mode === "extractive" ? (
        <p className="small muted" style={{ margin: 0 }}>{t("ask.extractive")}</p>
      ) : (
        <>
          <div className="label">{t("ask.check")}</div>
          <ul>
            {statements > 0 && (
              <CheckLine level={withCite === statements ? "ok" : withCite >= statements * 0.6 ? "info" : "warn"}>
                {t("ask.checkCited", { a: withCite, b: statements })}
              </CheckLine>
            )}
            {check.unsupported_numbers.length === 0 && misplaced.length === 0 && (
              <CheckLine level="ok">{numbers ? t("ask.checkNumbersOk", { n: numbers }) : t("ask.checkNoNumbers")}</CheckLine>
            )}
            {misplaced.length > 0 && <CheckLine level="info">{t("ask.checkMisplaced", { list: misplaced.join(", ") })}</CheckLine>}
            {check.unsupported_numbers.length > 0 && (
              <CheckLine level="bad">{t("ask.checkUnsupported", { list: check.unsupported_numbers.join(", ") })}</CheckLine>
            )}
            {check.invalid.length > 0 && <CheckLine level="info">{t("ask.checkInvalid", { list: check.invalid.join(", ") })}</CheckLine>}
          </ul>
        </>
      )}
      <SearchTrail answer={answer} />
      {model && (
        <div className="by">
          {answer.cached ? t("ask.cachedBy", { m: model }) : t("ask.by", { m: model, s: fmtNum(lang, answer.took_ms / 1000, 1) })}
        </div>
      )}
    </div>
  );
}

/** Shows how the question was read: which words became which search terms. */
function SearchTrail({ answer }: { answer: Answer }) {
  const { t, lang } = useStore();
  const terms = [...answer.terms, ...(answer.keywords ?? [])];
  const c = answer.conditions;
  if (!terms.length && !c?.o2 && !c?.p) return null;
  return (
    <div className="trail">
      <span className="muted">{t("ask.searched")}:</span>
      {terms.slice(0, 8).map((term) => <code key={term}>{term}</code>)}
      {(c?.o2 != null || c?.p != null) && (
        <span className="muted">
          · {t("ask.conditions")}: {c.o2 != null ? `O₂ ${fmtNum(lang, c.o2)} %` : ""}{c.o2 != null && c.p != null ? ", " : ""}
          {c.p != null ? `${fmtNum(lang, c.p)} ${lang === "ru" ? "кПа" : "kPa"}` : ""}
        </span>
      )}
    </div>
  );
}

const KINDS = new Set(["summary", "card", "table", "row", "document", "publication", "factsheet", "article", "challenge", "environment", "earth"]);

function SourceCard({ s, active }: { s: Source; active: boolean }) {
  const { t, showTable } = useStore();
  const [open, setOpen] = useState(false);
  const full = s.text && s.text.length > s.snippet.length + 20 ? s.text : null;
  const kind = KINDS.has(s.kind) ? t(`kind.${s.kind}` as Key) : s.kind;
  return (
    <div id={`src-${s.n}`} className={`source${active ? " on" : ""}`}>
      <div className="source-head">
        <span className="n">{s.n}</span>
        <div style={{ minWidth: 0 }}>
          <div className="source-kind">
            {kind}
            {s.study_short && <> · {s.study_short}</>}
          </div>
          <b>{s.title}</b>
        </div>
      </div>
      <div className="path">{s.file}{s.loc ? ` · ${s.loc}` : ""}</div>
      {s.why && <div className="why">{s.why}</div>}
      <div className="snip">{open && full ? full : s.snippet}</div>
      <div className="acts">
        {full && <button className="link" onClick={() => setOpen(!open)}>{open ? t("ask.less") : t("ask.more")}</button>}
        {s.table && s.row != null && <button className="link" onClick={() => showTable({ id: s.table!, row: s.row! })}>{t("ask.openRow")}</button>}
        {s.table && s.row == null && <button className="link" onClick={() => showTable({ id: s.table! })}>{t("ask.openTable")}</button>}
        {s.url && <a className="link" href={s.url} target="_blank" rel="noreferrer">{t("ask.inPsi")}</a>}
      </div>
    </div>
  );
}

export function SourceList({ sources, active = null }: { sources: Source[]; active?: number | null }) {
  return <div>{sources.map((s) => <SourceCard key={s.n} s={s} active={active === s.n} />)}</div>;
}
