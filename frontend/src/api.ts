// Types mirror the JSON returned by backend/app.py. GET responses are cached
// for the session: the database is rebuilt offline, so it never changes under us.

export type Lang = "ru" | "en";
export type L10n = { ru: string; en: string };
export type Range = [number, number] | null;
export type State = "solid" | "liquid" | "gas" | "aerosol";
export type Pillar = "prevention" | "detection" | "suppression" | "fundamentals";

export interface Environment {
  id: string;
  o2: number;
  p: number;
  g: number | null;
  name: L10n;
  note: L10n;
  source: string;
  assumed: boolean;
}

export interface Coverage {
  id: string;
  rows: number;
  studies: [string, number][];
  matrix: string[];
  status: "data" | "partial" | "none";
  gravity_ok: boolean;
}

export interface Source {
  n: number;
  kind: string;
  study: string | null;
  study_short: string | null;
  title: string;
  file: string;
  loc: string;
  snippet: string;
  text?: string;
  url: string | null;
  table?: string | null;
  row?: number | null;
  why?: string | null;
}

export interface Faq {
  id: string;
  q: L10n;
  a: L10n;
  sources: Source[];
}

export interface EarthUse {
  id: string;
  icon: string;
  title: L10n;
  text: L10n;
  where: L10n;
  source: string;
  url: string;
  studies: string[];
}

export interface Totals {
  studies: number;
  flight: number;
  ground: number;
  tables: number;
  records: number;
  tests: number;
  files: number;
  bytes: number;
  missing_files: number;
  documents: number;
  passages: number;
  environments: number;
  publications: number;
  traces: number;
  built: string;
}

export interface Meta {
  totals: Totals;
  environments: Environment[];
  coverage: Coverage[];
  groups: Record<string, L10n>;
  pillars: Record<Pillar, L10n>;
  states: Record<State, L10n>;
  faq: Faq[];
  earth: EarthUse[];
  synthesis: { enabled: boolean; models: string[] };
}

export interface ScorePart {
  key: "o2" | "p" | "safety" | "g";
  points: number;
  max: number;
  range?: Range;
  dist?: number;
  assumed?: boolean;
  oxidizer?: Range;
  pillars?: Pillar[];
  why?: "match" | "ground" | "na" | "efield" | "partial";
}

export interface Proximity {
  score: number;
  parts: ScorePart[];
}

export interface StudyStats {
  tables: number;
  records: number;
  tests: number;
  o2_ambient: Range;
  o2_oxidizer: Range;
  p: Range;
  p_assumed: number | null;
  flow: Range;
  fuels: [string, number][];
  first_test: string | null;
  last_test: string | null;
  test_days: number;
}

export interface TableRef {
  id: string;
  label: string;
  file: string;
  rows: number;
  columns: number;
}

export interface Study {
  id: string;
  short: string;
  acronym: string;
  title: string;
  title_ru: string;
  flight: boolean;
  area: string;
  hardware: string;
  program: string;
  start: string | null;
  end: string | null;
  group: string;
  state: State;
  pillars: Pillar[];
  safety: number;
  summary: L10n;
  fuel_text: L10n;
  sensors: L10n;
  varied: L10n;
  safety_link: L10n;
  stats: StudyStats;
  proximity: Record<string, Proximity>;
  tables: TableRef[];
  psi_url: string;
  doi_url: string | null;
  doi: string | null;
  files: { total: number; bytes: number; folders: [string, number][] };
  missing_files: number;
  publications: number;
}

export interface Publication {
  title: string;
  authors?: string;
  status?: string;
  doi?: string;
}

export interface StudyFull extends Omit<Study, "publications"> {
  project_type: string;
  center: string;
  license: string;
  objective: string;
  approach: string;
  hypothesis: string;
  impacts: string;
  publications: Publication[];
  people: { name: string; affiliation: string; role: string }[];
  timeline: { date: string; tests: number; rows: number; table: string; first_row: number; fuels: string[] }[];
}

export interface Point {
  s: string;
  t: string;
  r: number;
  o2: number;
  p: number | null;
  b: "ambient" | "oxidizer";
  ps: "table" | "assumed" | "none" | "note";
  m: boolean;
  f: string | null;
  run: string | null;
  dist?: number;
}

export interface ColumnProfile {
  name: string;
  filled: number;
  type: "number" | "text";
  distinct?: number;
  min?: number;
  max?: number;
  min_row?: number;
  max_row?: number;
  top?: [string, number][];
}

export interface TableData {
  id: string;
  study: string;
  short: string;
  label: string;
  file: string;
  psi_url: string;
  columns: string[];
  meta: Record<string, string | number | null>;
  profile: ColumnProfile[];
  rows: { n: number; cells: string[] }[];
}

export interface TableInfo {
  id: string;
  study: string;
  short: string;
  label: string;
  file: string;
  rows: number;
  columns: number;
  row_kind: string | null;
}

export interface Evidence {
  kind: string;
  title: string;
  file: string;
  loc: string;
  snippet: string;
}

export interface Ranked {
  id: string;
  score: number;
  relevance: number | null;
  proximity: Proximity | null;
  evidence: Evidence[];
}

export interface RankResponse {
  terms: string[];
  conditions: { o2: number | null; p: number | null } | null;
  nearest: Point[];
  ranking: Ranked[];
}

export interface SearchHit {
  id: number;
  kind: string;
  study: string | null;
  study_short: string | null;
  title: string;
  file: string;
  loc: string;
  snippet: string;
  table: string | null;
  row: number | null;
  url: string | null;
}

export type Flag =
  | "elevated_o2" | "hyperoxic_pp" | "hypoxic_pp" | "partial_g_gap"
  | "no_solid_tests" | "quiescent_sustained";

export interface Simulation {
  input: { o2: number; p: number; g: number; flow: number };
  physics: {
    p_psia: number;
    pp_o2_kpa: number;
    pp_o2_psia: number;
    earth_pp_ratio: number;
    normoxic_o2_pct: number;
    buoyant_vel_cms: number;
    effective_vel_cms: number;
    matching_records: number;
  };
  flags: Flag[];
  nearest: Point[];
  studies: { id: string; short: string; state: State; group: string; safety: number; proximity: Proximity }[];
}

export interface Channel {
  key: string;
  label: L10n | string;
  unit: string;
  min: number;
  max: number;
  values: (number | null)[];
}

export interface Trace {
  id: string;
  study: string;
  run?: string;
  family: string;
  file: string;
  title: L10n;
  subtitle: L10n;
  x_label: L10n;
  x_unit: string;
  samples_raw: number;
  t: number[];
  channels: Channel[];
  events: { t: number; label: L10n }[];
}

export interface SmokeSeries {
  key: string;
  gravity: "0g" | "1g";
  position: string;
  label: L10n;
  raw: number[];
  norm: number[];
}

export interface Workbench {
  traces: Trace[];
  smoke: {
    study: string;
    related: string[];
    file: string;
    diameter_nm: number[];
    series: SmokeSeries[];
    bands: { id: string; min_nm: number; max_nm: number; label: L10n }[];
  } | null;
  modeling: Record<string, Record<string, string | number | null>[]>;
}

export interface Answer {
  question: string;
  answer: string;
  mode: "llm" | "extractive" | "none";
  model: string | null;
  sources: Source[];
  ranking: Ranked[];
  terms: string[];
  keywords?: string[];
  conditions?: { o2: number | null; p: number | null };
  check: {
    cited: number[];
    invalid: number[];
    unsupported_numbers: string[];
    misplaced_numbers?: string[];
    statements?: number;
    cited_statements?: number;
    numbers_checked?: number;
  };
  took_ms: number;
  cached?: boolean;
}

export interface AskParams {
  question: string;
  lang: Lang;
  env?: string | null;
  mode?: "simple" | "tech";
  table?: string | null;
  study?: string | null;
  previous?: string | null;
}

const cache = new Map<string, Promise<unknown>>();

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${url}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

function cached<T>(url: string): Promise<T> {
  let hit = cache.get(url) as Promise<T> | undefined;
  if (!hit) {
    hit = request<T>(url);
    hit.catch(() => cache.delete(url));
    cache.set(url, hit);
  }
  return hit;
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") out.set(k, String(v));
  return out.toString();
};

export const api = {
  meta: () => cached<Meta>("/api/meta"),
  studies: () => cached<Study[]>("/api/studies"),
  study: (id: string) => cached<StudyFull>(`/api/studies/${encodeURIComponent(id)}`),
  files: (id: string, folder: string) =>
    cached<{ total: number; files: { folder: string; name: string; size: number; ext: string; run: string | null }[] }>(
      `/api/studies/${encodeURIComponent(id)}/files?${qs({ folder, limit: 400 })}`),
  tables: () => cached<TableInfo[]>("/api/tables"),
  table: (id: string) => cached<TableData>(`/api/tables/${encodeURIComponent(id)}`),
  tableCsv: (id: string) => `/api/tables/${encodeURIComponent(id)}/csv`,
  points: () => cached<Point[]>("/api/points"),
  workbench: () => cached<Workbench>("/api/workbench"),
  modelingCsv: (dataset: string) => `/api/modeling/${dataset}/csv`,
  rank: (q: string, env: string | null, lang: Lang) => cached<RankResponse>(`/api/rank?${qs({ q, env, lang })}`),
  search: (q: string, lang: Lang) => cached<{ hits: SearchHit[]; terms: string[] }>(`/api/search?${qs({ q, lang, limit: 12 })}`),
  simulate: (o2: number, p: number, g: number, flow: number) =>
    cached<Simulation>(`/api/simulate?${qs({ o2, p, g, flow })}`),
  ask: (params: AskParams) =>
    request<Answer>("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }),
};
