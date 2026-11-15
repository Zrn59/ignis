import { useEffect, useMemo, useRef, useState } from "react";
import { api, type TableInfo } from "../api";
import type { Key } from "../i18n";
import { go, href, useStore } from "../store";
import { Go, Icon, Logo } from "./ui";

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

const DRAWER_HINT: Record<string, Key> = {
  studies: "drawer.studies",
  atmosphere: "drawer.atmosphere",
  flight: "drawer.flight",
  compare: "drawer.compare",
  tables: "drawer.tables",
  earth: "drawer.earth",
  about: "drawer.about",
};

export function Topbar({ section }: { section: string }) {
  const { t, lang, setLang, setPaletteOpen, compare } = useStore();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [section]);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menu]);

  return (
    <>
      <a className="skip" href="#main">{t("nav.skip")}</a>
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href="#/" aria-label="IGNIS">
            <Logo />
            <span>IGNIS<small>Flame in Freefall</small></span>
          </a>
          <nav className="nav" aria-label={t("nav.menu")}>
            {SECTIONS.slice(1).map((s) => (
              <a key={s.path} href={href(s.path)} aria-current={section === s.path ? "page" : undefined}>
                {t(s.key)}{s.path === "compare" && compare.length > 0 && <span className="count-badge">{compare.length}</span>}
              </a>
            ))}
          </nav>
          <div className="topbar-tools">
            <button className="search-btn" onClick={() => setPaletteOpen(true)} aria-label={t("nav.jump")}>
              <Icon name="search" /><span>{t("nav.search")}</span><span className="kbd hide-sm">/</span>
            </button>
            <div className="lang hide-sm" role="group" aria-label="Language">
              {(["ru", "en"] as const).map((l) => (
                <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <a className="btn small flame hide-sm" href={href("ask")} aria-current={section === "ask" ? "page" : undefined}>
              {t("nav.ask")}
            </a>
            <button className="menu-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={t("nav.menu")}>
              <Icon name={menu ? "close" : "menu"} size={24} />
            </button>
          </div>
        </div>
      </header>
      {menu && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div className="wrap">
            {[...SECTIONS.slice(1), { path: "ask", key: "nav.ask" as Key }].map((s) => (
              <a key={s.path} className="big" href={href(s.path)} onClick={() => setMenu(false)}>
                <span>{t(s.key)}<br /><small>{DRAWER_HINT[s.path] ? t(DRAWER_HINT[s.path]) : t("drawer.ask")}</small></span>
                <span className="go"><span className="dot"><Icon name="arrow" /></span></span>
              </a>
            ))}
            <div className="row" style={{ marginTop: 28, gap: 12 }}>
              <span className="label" style={{ color: "#a8a8a8" }}>Language</span>
              <div className="lang">
                {(["ru", "en"] as const).map((l) => (
                  <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l === "ru" ? "Русский" : "English"}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BackToTop() {
  const { t } = useStore();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 900);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button className={`to-top${show ? " show" : ""}`} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={t("nav.top")} title={t("nav.top")}>
      <Icon name="arrow" />
    </button>
  );
}

export function Footer() {
  const { t, meta } = useStore();
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <div className="brand"><Logo />IGNIS</div>
          <p style={{ marginTop: 20, maxWidth: "38ch", fontSize: 16, color: "#d0d0d0" }}>{t("footer.about")}</p>
          <div style={{ marginTop: 28 }}><Go href={href("ask")} small>{t("footer.askCta")}</Go></div>
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
          <span>{t("footer.fine")}</span>
          <span>sulateam{meta ? ` · ${t("footer.built")} ${meta.totals.built}` : ""}</span>
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
        <div className="palette-input"><Icon name="search" /><input ref={inputRef} className="input" placeholder={t("palette.placeholder")} value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(items.length - 1, c + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            if (e.key === "Enter") choose(items[cursor]);
            if (e.key === "Escape") setPaletteOpen(false);
          }} /></div>
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
        <div className="foot"><span>{t("palette.hint")}</span><span className="spacer" /><span>Ctrl K · /</span></div>
      </div>
    </div>
  );
}

/** Pinned to the bottom while something is picked for comparison, so the "Compare" button has a visible result. */
export function CompareTray({ section }: { section: string }) {
  const { t, compare, setCompare, toggleCompare, studyById } = useStore();
  // the assistant has its own sticky input at the bottom, so the tray stays out of its way
  if (!compare.length || section === "compare" || section === "ask") return null;
  return (
    <div className="compare-tray" role="region" aria-label={t("tray.label")}>
      <div className="wrap">
        <span className="label">{t("tray.label")}</span>
        <div className="tray-items">
          {compare.map((id) => (
            <button key={id} className="tray-item" onClick={() => toggleCompare(id)} title={t("compare.remove")}>
              {studyById.get(id)?.short ?? id}<Icon name="close" size={12} />
            </button>
          ))}
          {compare.length === 1 && <span className="small" style={{ color: "#9a9a9a" }}>{t("tray.need")}</span>}
        </div>
        <button className="btn small ghost on-dark-ghost" onClick={() => setCompare([])}>{t("tray.clear")}</button>
        <Go small href={href("compare")}>{t("tray.open")} · {compare.length}</Go>
      </div>
    </div>
  );
}
