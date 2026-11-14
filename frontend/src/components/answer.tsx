import { Fragment, type ReactNode } from "react";
import type { Answer, Source } from "../api";
import { fmtNum } from "../i18n";
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

/** Plain text from the backend: paragraphs separated by blank lines, list items start with "- ". */
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

export function Verification({ answer }: { answer: Answer }) {
  const { t, lang } = useStore();
  const { check } = answer;
  return (
    <div className="verify">
      {answer.mode === "llm" && <span className="tag">{t("ask.cited", { n: check.cited.length })}</span>}
      {answer.mode === "llm" && check.unsupported_numbers.length === 0 && (
        <span className="tag ok"><Icon name="check" size={12} />{t("ask.verified")}</span>
      )}
      {check.unsupported_numbers.length > 0 && (
        <span className="tag warn"><Icon name="alert" size={12} />{t("ask.unsupported", { list: check.unsupported_numbers.join(", ") })}</span>
      )}
      {answer.mode === "extractive" && <span className="tag warn">{t("ask.extractive")}</span>}
      {answer.mode === "none" && <span className="tag risk">{t("ask.none")}</span>}
      {answer.model && <span className="tag" title={answer.model}>{answer.model.split("/").pop()?.replace(":free", "")}</span>}
      {answer.took_ms > 0 && <span className="tag">{fmtNum(lang, answer.took_ms / 1000, 1)} s</span>}
    </div>
  );
}

export function SourceList({ sources, active = null }: { sources: Source[]; active?: number | null }) {
  const { t, showTable } = useStore();
  return (
    <div>
      {sources.map((s) => (
        <div key={s.n} id={`src-${s.n}`} className={`source${active === s.n ? " on" : ""}`}>
          <div className="source-head">
            <span className="n">[{s.n}]</span>
            <b>{s.title}</b>
          </div>
          <div className="path">{s.file}{s.loc ? ` · ${s.loc}` : ""}</div>
          {s.why && <div className="why">{s.why}</div>}
          <div className="snip">{s.snippet}</div>
          <div className="acts">
            {s.table && s.row != null && (
              <button className="link" onClick={() => showTable({ id: s.table!, row: s.row! })}>{t("ask.openRow")}</button>
            )}
            {s.url && <a className="link" href={s.url} target="_blank" rel="noreferrer">{t("ask.inPsi")}</a>}
          </div>
        </div>
      ))}
    </div>
  );
}
