import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, type Answer } from "../api";
import { AnswerText, SourceList, Verification } from "../components/answer";
import { Icon } from "../components/ui";
import { href, useRoute, useStore } from "../store";

type Mode = "simple" | "tech";

interface Turn {
  id: number;
  question: string;
  mode: Mode;
  answer?: Answer;
  error?: string;
}

// Lives outside the component so the conversation is still there when you come back to the page.
let saved: Turn[] = [];
let nextId = 1;

function Elapsed() {
  const { t } = useStore();
  const [s, setS] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setS((v) => v + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="thinking"><i />{t("ask.thinking", { s })}</div>;
}

function CopyButton({ text }: { text: string }) {
  const { t } = useStore();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard can be blocked; nothing useful to do about it */
    }
  };
  return (
    <button className="btn ghost small" onClick={copy}>
      <Icon name={done ? "check" : "copy"} />{done ? t("ask.copied") : t("ask.copy")}
    </button>
  );
}

export function AskPage() {
  const { t, lang, env, envId, meta, studyById } = useStore();
  const route = useRoute();
  const [turns, setTurns] = useState<Turn[]>(saved);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("simple");
  const [useEnv, setUseEnv] = useState(true);
  const [scope, setScope] = useState<{ study: string | null; table: string | null }>({
    study: route.params.get("study"),
    table: route.params.get("table"),
  });
  const [focus, setFocus] = useState<{ turn: number; n: number | null } | null>(null);
  const busy = turns.some((turn) => !turn.answer && !turn.error);
  const logEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const autoAsked = useRef(false);

  useEffect(() => {
    saved = turns;
  }, [turns]);

  useEffect(() => {
    setScope({ study: route.params.get("study"), table: route.params.get("table") });
  }, [route.params]);

  // the textarea grows with the text, up to a few lines
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const send = async (question: string, asMode: Mode = mode, replace?: number) => {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    const id = nextId++;
    const rest = replace ? turns.filter((turn) => turn.id !== replace) : turns;
    const previous = rest.length ? rest[rest.length - 1].question : null;
    setTurns([...rest, { id, question: text, mode: asMode }]);
    setDraft("");
    setFocus({ turn: id, n: null });
    try {
      const answer = await api.ask({
        question: text, lang, mode: asMode, previous,
        env: useEnv ? envId : null, study: scope.study, table: scope.table,
      });
      setTurns((list) => list.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    } catch (err) {
      setTurns((list) => list.map((turn) => (turn.id === id ? { ...turn, error: (err as Error).message } : turn)));
    }
  };

  useEffect(() => {
    const q = route.params.get("q");
    if (q && !autoAsked.current && meta) {
      autoAsked.current = true;
      window.history.replaceState(null, "", href("ask", { study: scope.study, table: scope.table }));
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  const focused = turns.find((turn) => turn.id === focus?.turn) ?? turns[turns.length - 1];
  const sources = focused?.answer?.sources ?? [];
  const cite = (turnId: number, n: number) => {
    setFocus({ turn: turnId, n });
    window.setTimeout(() => document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
  };
  const scopeLabel = scope.table ?? (scope.study ? `${scope.study} · ${studyById.get(scope.study)?.short ?? ""}` : null);
  const suggestions = [t("ask.q1"), t("ask.q2"), t("ask.q3"), t("ask.q4"), t("ask.q5"), t("ask.q6")];

  return (
    <div className="chat">
      <div className="chat-main">
        <div className="chat-head">
          <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h1 style={{ fontSize: 34 }}>{t("ask.title")}</h1>
              <p className="muted" style={{ marginTop: 8, maxWidth: "68ch" }}>{t("ask.lead")}</p>
            </div>
            {turns.length > 0 && (
              <button className="btn ghost small" onClick={() => { setTurns([]); setFocus(null); }}>
                <Icon name="close" />{t("ask.new")}
              </button>
            )}
          </div>
          <div className="row chat-controls">
            <span className="small muted">{t("ask.style")}:</span>
            <div className="seg compact">
              <button aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>{t("ask.simple")}</button>
              <button aria-pressed={mode === "tech"} onClick={() => setMode("tech")}>{t("ask.tech")}</button>
            </div>
            {env && (
              <label className="check">
                <input type="checkbox" checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} />
                {t("ask.useEnv", { env: env.name[lang] })}
              </label>
            )}
            {scopeLabel && (
              <span className="tag zero-g">
                {t("ask.scope", { x: scopeLabel })}
                <button onClick={() => { setScope({ study: null, table: null }); window.history.replaceState(null, "", href("ask")); }} aria-label="clear">
                  <Icon name="close" size={11} />
                </button>
              </span>
            )}
          </div>
          {meta && !meta.synthesis.enabled && <div className="note" style={{ marginTop: 14 }}>{t("ask.offline")}</div>}
        </div>

        <div className="chat-log" aria-live="polite">
          {turns.length === 0 && (
            <div>
              <div className="label" style={{ marginBottom: 12 }}>{t("ask.start")}</div>
              <div className="suggest">
                {suggestions.map((q) => <button key={q} onClick={() => void send(q)}>{q}</button>)}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <article key={turn.id} className={`turn${focused?.id === turn.id && turns.length > 1 ? " focused" : ""}`}>
              <div className="msg-q">{turn.question}</div>
              <div className="msg-a">
                {!turn.answer && !turn.error && <Elapsed />}
                {turn.error && (
                  <div className="note warn">
                    {t("ask.error", { e: turn.error })}
                    <button className="btn small" style={{ marginLeft: 12 }} onClick={() => void send(turn.question, turn.mode, turn.id)} disabled={busy}>
                      <Icon name="redo" />{t("ask.retry")}
                    </button>
                  </div>
                )}
                {turn.answer && (
                  <>
                    <AnswerText text={turn.answer.answer} active={focus?.turn === turn.id ? focus.n : null} onCite={(n) => cite(turn.id, n)} />
                    <div className="answer-acts">
                      <CopyButton text={turn.answer.answer} />
                      <button className="btn ghost small" disabled={busy}
                        onClick={() => void send(turn.question, turn.mode === "simple" ? "tech" : "simple")}>
                        <Icon name="redo" />{turn.mode === "simple" ? t("ask.asTech") : t("ask.asSimple")}
                      </button>
                      {focused?.id !== turn.id && (
                        <button className="btn ghost small" onClick={() => setFocus({ turn: turn.id, n: null })}>
                          <Icon name="layers" />{t("ask.sources")} · {turn.answer.sources.length}
                        </button>
                      )}
                    </div>
                    <Verification answer={turn.answer} />
                    {turn.answer.ranking.length > 0 && (
                      <div className="related">
                        <span className="small muted">{t("ask.related")}:</span>
                        {turn.answer.ranking.slice(0, 4).map((r) => (
                          <a key={r.id} className="chip" href={href(`studies/${r.id}`)}>
                            {studyById.get(r.id)?.short ?? r.id}<Icon name="chevron" size={12} />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
          <div ref={logEnd} />
        </div>

        <form className="chat-input" onSubmit={submit}>
          <div className="ask">
            <span className="prompt">›</span>
            <textarea ref={input} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              placeholder={t("ask.placeholder")} autoFocus aria-label={t("ask.placeholder")} />
            <button className="btn primary" type="submit" disabled={busy || draft.trim().length < 2}>{t("ask.send")}<Icon name="arrow" /></button>
          </div>
          <div className="chat-hint">{t("ask.hint")}</div>
        </form>
      </div>

      <aside className="chat-side">
        <div className="label" style={{ marginBottom: 4 }}>{t("ask.sources")}{sources.length ? ` · ${sources.length}` : ""}</div>
        {turns.length > 1 && focused && <p className="small muted side-q">«{focused.question}»</p>}
        {sources.length ? <SourceList sources={sources} active={focus?.turn === focused?.id ? focus?.n ?? null : null} />
          : <p className="muted small">{t("ask.noSources")}</p>}
      </aside>
    </div>
  );
}
