/* ============================================================
 * Market Intelligence AI — Tipos TypeScript del modelo de datos
 * Generado a partir de secciones 16.1–16.10 del SRS
 * NO modificar nombres de campos: deben coincidir literalmente
 * con los definidos en el SRS.
 * ============================================================ */

// ─── §16.2 Roles ───────────────────────────────────────────
export type RoleName = 'Administrador' | 'Analista' | 'Supervisor' | 'Invitado';

export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
}

// ─── §16.1 Users ───────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string | null;
  created_at: string;
  // join
  roles?: Role;
}

// ─── §16.4 Assets ──────────────────────────────────────────
export type AssetType = 'Acción' | 'Cripto' | 'ETF' | 'Bono' | 'Commodity' | 'Divisa' | 'Otro';

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  sector: string | null;
}

// ─── §16.3 News ────────────────────────────────────────────
export interface News {
  id: string;
  title: string;
  content: string;
  source: string;
  published_at: string;
  sector: string | null;
  is_test_data: boolean;
  created_at: string;
  // joins
  assets?: Asset[];
}

// ─── §16.5 Signals ─────────────────────────────────────────
// Valores exactos de impact según SRS §16.5 y §13
export type SignalImpact = 'Positivo' | 'Negativo' | 'Neutral' | 'Incierto';

// Valores exactos de status según SRS §16.5 y §17.4
export type SignalStatus = 'Pendiente' | 'Revisada' | 'Escalada' | 'Descartada';

export interface HistoricalComparison {
  dates: string[];
  prices: number[];
  event_date?: string;
  annotation?: string;
}

export interface Signal {
  id: string;
  news_id: string;
  asset_id: string;
  impact: SignalImpact;
  confidence: number;           // 0–100
  explanation: string;
  risks: string | null;
  suggested_research: string | null;
  historical_comparison: HistoricalComparison | null;
  status: SignalStatus;
  reviewed_by: string | null;
  review_comment: string | null;
  created_at: string;
  // joins
  news?: News;
  assets?: Asset;
  reviewed_by_user?: User;
}

// ─── §16.6 Briefings ───────────────────────────────────────
// Valores exactos de status según SRS §16.6 y §21
export type BriefingStatus = 'Borrador' | 'En revisión' | 'Aprobado' | 'Escalado';

export interface Briefing {
  id: string;
  title: string;
  watchlist_id: string | null;
  asset_id: string | null;
  status: BriefingStatus;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  // joins
  assets?: Asset;
  watchlists?: Watchlist;
  created_by_user?: User;
  approved_by_user?: User;
  signals?: Signal[];
}

// ─── §16.7 Watchlists ──────────────────────────────────────
export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  // joins
  watchlist_assets?: WatchlistAsset[];
}

// ─── §16.8 Watchlist_Assets ────────────────────────────────
export interface WatchlistAsset {
  id: string;
  watchlist_id: string;
  asset_id: string;
  // joins
  assets?: Asset;
}

// ─── §16.9 Alerts ──────────────────────────────────────────
export interface Alert {
  id: string;
  user_id: string;
  asset_id: string;
  condition: string;
  is_active: boolean;
  created_at: string;
  // joins
  assets?: Asset;
}

// ─── §16.10 Audit_Logs ─────────────────────────────────────
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;         // ej. "signal.status_change"
  entity: string;         // ej. "signals"
  entity_id: string;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: string;
  // joins
  users?: User;
}

// ─── Tipos de filtros para Radar de Noticias (HU-01) ───────
export interface NewsFilters {
  instrument_type: AssetType | '';
  asset_symbol: string;
  sector: string;
  since: '1h' | '24h' | '7d' | '30d' | '';
}

// ─── Respuesta JSON de Gemini (SRS §13 — campos exactos) ───
export interface GeminiSignalOutput {
  activo: string;
  impacto: SignalImpact;
  confianza: number;
  explicacion: string;
  riesgos: string;
  investigacion_sugerida: string;
}
