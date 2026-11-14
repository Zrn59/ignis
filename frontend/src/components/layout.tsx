import { useEffect, useMemo, useRef, useState } from "react";
import { api, type TableInfo } from "../api";
import type { Key } from "../i18n";
import { go, href, useStore } from "../store";
import { Icon, Logo } from "./ui";

export const SECTIONS: { path: string; key: Key }[] = [
  { path: "", key: "nav.overview" },
  { path: "studies", key: "nav.studies" },
  { path: "atmosphere", key: "nav.atmosphere" },
  { path: "flight", key: "nav.flight" },
  { path: "compare", key: "nav.compare" },
  { path: "tables", key: "nav.tables" },
  { path: "earth", key: "nav.earth" },
  { path: "about", key: "nav.about" },
];

export function Topbar({ section }: { section: string }) {
  const { t, lang, setLang, setPaletteOpen } = useStore();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [section]);

  return (
    <header className="topbar">
      <div className="wrap">
        <a className="brand" href="#/"><Logo />IGNIS</a>
        <nav className={`nav${menu ? " open" : ""}`}>
          {SECTIONS.slice(1).map((s) => (
            <a key={s.path} href={href(s.path)} aria-current={section === s.path ? "page" : undefined}>{t(s.key)}</a>
          ))}
        </nav>
        <div className="topbar-tools">
          <button className="btn small on-dark hide-sm" onClick={() => setPaletteOpen(true)} title={t("nav.jump")} aria-label={t("nav.jump")}>
            <Icon name="search" /><span className="kbd">Ctrl K</span>
          </button>
          <div className="lang" role="group" aria-label="Language">
            {(["ru", "en"] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a className="btn small flame" href={href("ask")} aria-current={section === "ask" ? "page" : undefined}>
            <Icon name="chat" />{t("nav.ask")}
          </a>
          <button className="menu-btn" onClick={() => setMenu((v) => !v)} aria-label={t("nav.menu")}><Icon name="menu" size={22} /></button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t, meta } = useStore();
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <div className="brand" style={{ color: "#e8ecf1" }}><Logo />IGNIS</div>
          <p style={{ marginTop: 12, maxWidth: "36ch" }}>{t("footer.about")}</p>
        </div>
        <div>
          <h4>{t("footer.sections")}</h4>
          {SECTIONS.slice(1, 5).map((s) => <a key={s.path} href={href(s.path)}>{t(s.key)}</a>)}
          <a href={href("ask")}>{t("nav.ask")}</a>
        </div>
        <div>
          <h4>{t("footer.data")}</h4>
          <a href={href("tables")}>{t("nav.tables")}</a>
          <a href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">{t("footer.psi")}</a>
          <a href="/docs" target="_blank" rel="noreferrer">{t("footer.api")}</a>
        </div>
        <div>
          <h4>{t("footer.project")}</h4>
          <a href={href("earth")}>{t("nav.earth")}</a>
          <a href={href("about")}>{t("nav.about")}</a>
          <a href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer">{t("footer.challenge")}</a>
        </div>
        <div className="fine">
          {t("footer.fine")}{meta ? ` · ${meta.totals.built}` : ""}
        </div>
      </div>
    </footer>
  );
}

interface Item {
  kind: "section" | "study" | "table";
  label: string;
  hint: string;
  path: string;
  params?: Record<string, string>;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, studies, t, lang, showTable } = useStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery("");
    setCursor(0);
    api.tables().then(setTables).catch(() => undefined);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...SECTIONS.map((s) => ({ kind: "section" as const, label: t(s.key), hint: "", path: s.path })),
      { kind: "section", label: t("nav.ask"), hint: "", path: "ask" },
      ...studies.map((s) => ({
        kind: "study" as const, label: `${s.short} — ${lang === "ru" ? s.title_ru : s.title}`, hint: s.id, path: `studies/${s.id}`,
      })),
      ...tables.map((tb) => ({ kind: "table" as const, label: `${tb.short}: ${tb.label}`, hint: tb.id, path: "table" })),
    ];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 40);
    return all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q)).slice(0, 40);
  }, [query, studies, tables, t, lang]);

  if (!paletteOpen) return null;

  const choose = (item: Item | undefined) => {
    if (!item) return;
    setPaletteOpen(false);
    if (item.kind === "table") showTable({ id: item.hint });
    else go(item.path);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
      <div className="modal palette" role="dialog" aria-modal="true">
        <input ref={inputRef} className="input" placeholder={t("palette.placeholder")} value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(items.length - 1, c + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            if (e.key === "Enter") choose(items[cursor]);
            if (e.key === "Escape") setPaletteOpen(false);
          }} />
        <ul role="listbox">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.hint}-${item.path}`}>
              <button aria-selected={i === cursor} onMouseEnter={() => setCursor(i)} onClick={() => choose(item)}>
                <span className="label">{t(`palette.${item.kind}`)}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span className="mono small muted">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mono small muted" style={{ padding: "10px 16px", borderTop: "1px solid var(--line)" }}>{t("palette.hint")}</div>
      </div>
    </div>
  );
}
