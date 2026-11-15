import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Environment, type Lang, type Meta, type Study } from "./api";
import { translate, type Key, type Params } from "./i18n";

// hash router: #/studies/PSI-99?tab=files

export interface Route {
  parts: string[];
  params: URLSearchParams;
}

function readRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function href(path: string, params?: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== null && v !== undefined && v !== "") query.set(k, String(v));
  const tail = query.toString();
  return `#/${path.replace(/^\//, "")}${tail ? `?${tail}` : ""}`;
}

export function go(path: string, params?: Record<string, string | number | null | undefined>) {
  window.location.hash = href(path, params);
}

// persisted settings

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ignis.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => stored(key, fallback));
  useEffect(() => {
    localStorage.setItem(`ignis.${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

const initialLang: Lang = navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";

// app state

export interface TableTarget {
  id: string;
  row?: number;
}

interface Store {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key, params?: Params) => string;
  meta: Meta | null;
  studies: Study[];
  studyById: Map<string, Study>;
  loadError: string | null;
  envId: string;
  env: Environment | null;
  setEnvId: (id: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  setCompare: (ids: string[]) => void;
  openTable: TableTarget | null;
  showTable: (target: TableTarget | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePersisted<Lang>("lang", initialLang);
  const [envId, setEnvId] = usePersisted("env", "moon");
  const [compare, setCompare] = usePersisted<string[]>("compare", []);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [studies, setStudies] = useState<Study[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openTable, showTable] = useState<TableTarget | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.meta(), api.studies()])
      .then(([m, s]) => {
        setMeta(m);
        setStudies(s);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: Key, params?: Params) => translate(lang, key, params), [lang]);

  const toggleCompare = useCallback(
    (id: string) => setCompare((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-4))),
    [setCompare],
  );

  const value = useMemo<Store>(() => {
    const env = meta?.environments.find((e) => e.id === envId) ?? meta?.environments[0] ?? null;
    return {
      lang, setLang, t, meta, studies, loadError,
      studyById: new Map(studies.map((s) => [s.id, s])),
      envId: env?.id ?? envId, env, setEnvId,
      compare, toggleCompare, setCompare,
      openTable, showTable,
      paletteOpen, setPaletteOpen,
    };
  }, [lang, setLang, t, meta, studies, loadError, envId, setEnvId, compare, toggleCompare, setCompare, openTable, paletteOpen]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}

// data loading

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    load()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((err: Error) => alive && setState({ data: null, error: err.message, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
