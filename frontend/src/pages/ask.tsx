import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { api, type Answer } from "../api";
import { AnswerText, SourceList, Verification } from "../components/answer";
import { Icon } from "../components/ui";
import { href, useRoute, useStore } from "../store";

interface Turn {
  id: number;
  question: string;
  answer?: Answer;
  error?: string;
}

// Kept outside the component so the conversation survives leaving the page.
let saved: Turn[] = [];
let nextId = 1;

export function AskPage() {
  const { t, lang, env, envId, meta, studyById } = useStore();
  const route = useRoute();
  const [turns, setTurns] = useState<Turn[]>(saved);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"simple" | "tech">("simple");
  const [useEnv, setUseEnv] = useState(true);
  const [scope, setScope] = useState<{ study: string | null; table: string | null }>({
    study: route.params.get("study"),
    table: route.params.get("table"),
  });
  const [focus, setFocus] = useState<{ turn: number; n: number | null } | null>(null);
  const busy = turns.some((turn) => !turn.answer && !turn.error);
  const logEnd = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  useEffect(() => {
    saved = turns;
  }, [turns]);

  useEffect(() => {
    setScope({ study: route.params.get("study"), table: route.params.get("table") });
  }, [route.params]);

  const send = async (question: string) => {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    const id = nextId++;
    const previous = turns.length ? turns[turns.length - 1].question : null;
    setTurns((list) => [...list, { id, question: text }]);
    setDraft("");
    setFocus({ turn: id, n: null });
    try {
      const answer = await api.ask({
        question: text, lang, mode, previous,
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

  const focused = turns.find((turn) => turn.id === focus?.turn) ?? turns[turns.length - 1];
  const sources = focused?.answer?.sources ?? [];
  const cite = (turnId: number, n: number) => {
    setFocus({ turn: turnId, n });
    document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const scopeLabel = scope.table ?? (scope.study ? `${scope.study} · ${studyById.get(scope.study)?.short ?? ""}` : null);
  const suggestions = [t("ask.q1"), t("ask.q2"), t("ask.q3"), t("ask.q4")];

  return (
    <div className="chat">
      <div className="chat-main">
        <div style={{ padding: "26px 36px 18px", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ alignItems: "flex-start", gap: 20 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h1 style={{ fontSize: 34 }}>{t("ask.title")}</h1>
              <p className="muted" style={{ marginTop: 8, maxWidth: "70ch" }}>{t("ask.lead")}</p>
            </div>
            {turns.length > 0 && <button className="btn small" onClick={() => { setTurns([]); setFocus(null); }}>{t("ask.new")}</button>}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <div className="seg compact">
              <button aria-pressed={mode === "simple"} onClick={() => setMode("simple")}>{t("ask.simple")}</button>
              <button aria-pressed={mode === "tech"} onClick={() => setMode("tech")}>{t("ask.tech")}</button>
            </div>
            {env && (
              <label className="check" style={{ marginLeft: 8 }}>
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

        <div className="chat-log">
          {turns.length === 0 && (
            <div>
              <div className="label" style={{ marginBottom: 12 }}>{t("ask.start")}</div>
              <div className="suggest">
                {suggestions.map((q) => <button key={q} onClick={() => void send(q)}>{q}</button>)}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="stack" style={{ "--gap": "14px" } as CSSProperties}>
              <div className="msg-q">{turn.question}</div>
              <div className="msg-a">
                {!turn.answer && !turn.error && <div className="thinking"><i />{t("ask.thinking")}</div>}
                {turn.error && <div className="note">{t("ask.error", { e: turn.error })}</div>}
                {turn.answer && (
                  <>
                    <AnswerText text={turn.answer.answer} active={focus?.turn === turn.id ? focus.n : null} onCite={(n) => cite(turn.id, n)} />
                    <Verification answer={turn.answer} />
                    {turn.answer.ranking.length > 0 && (
                      <div className="row small" style={{ marginTop: 12 }}>
                        <span className="muted">{t("nav.studies")}:</span>
                        {turn.answer.ranking.slice(0, 4).map((r) => (
                          <a key={r.id} className="link" href={href(`studies/${r.id}`)}>{studyById.get(r.id)?.short ?? r.id}</a>
                        ))}
                      </div>
                    )}
                    {focused?.id !== turn.id && (
                      <button className="link small" style={{ marginTop: 8 }} onClick={() => setFocus({ turn: turn.id, n: null })}>
                        {t("ask.sources")} ({turn.answer.sources.length})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={logEnd} />
        </div>

        <form className="chat-input" onSubmit={submit}>
          <div className="ask">
            <span className="prompt">›</span>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("ask.placeholder")} autoFocus aria-label={t("ask.placeholder")} />
            <button className="btn primary" type="submit" disabled={busy || draft.trim().length < 2}>{t("ask.send")}<Icon name="arrow" /></button>
          </div>
        </form>
      </div>

      <aside className="chat-side">
        <div className="label" style={{ marginBottom: 6 }}>{t("ask.sources")}{sources.length ? ` · ${sources.length}` : ""}</div>
        {sources.length ? <SourceList sources={sources} active={focus?.turn === focused?.id ? focus?.n ?? null : null} />
          : <p className="muted small">{t("ask.noSources")}</p>}
      </aside>
    </div>
  );
}
