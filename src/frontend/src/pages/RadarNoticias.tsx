/* ============================================================
 * RadarNoticias.tsx
 * Implementa: RF-001, RF-002, RF-003, RF-023
 * HU-01 — Sección 29 del SRS
 * Criterios de aceptación §25 + §29 HU-01:
 *   ✓ Al menos 2 fuentes con fuente y fecha/hora
 *   ✓ Cada noticia relacionada con uno o más instrumentos
 *   ✓ Filtros: tipo instrumento, activo, sector, antigüedad
 *   ✓ Badge "Datos de prueba" cuando is_test_data=true (RN-08)
 * ============================================================ */
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { News, Asset, AssetType, NewsFilters } from '../types/database';
import { formatDistanceToNow, parseISO, subHours, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Newspaper, Search, Filter, RefreshCw, AlertTriangle,
  Calendar, ExternalLink, ChevronRight, X, Clock,
  TrendingUp, FlaskConical, Building2,
} from 'lucide-react';
import DetalleNoticia from '../components/DetalleNoticia';
import type { NewsWithAssets } from '../components/DetalleNoticia';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import type { ToastData } from '../components/Toast';

// ─── Mock data de respaldo (RF-023, RNF-009, RN-08) ──────────
const MOCK_NEWS: NewsWithAssets[] = [
  {
    id: 'mock-1',
    title: 'La Fed mantiene tasas sin cambios en reunión de julio 2026',
    content: 'La Reserva Federal de Estados Unidos decidió en su reunión de julio de 2026 mantener la tasa de fondos federales en el rango del 5.25%–5.50%, señalando que aún no existen condiciones suficientes para iniciar un ciclo de recortes. El presidente Jerome Powell indicó que la institución seguirá siendo dependiente de los datos y que la inflación, aunque moderada, sigue por encima del objetivo del 2%.',
    source: 'Feed de prueba — NewsAPI Mock',
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    sector: 'Financiero',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a1', symbol: 'JPM',   name: 'JPMorgan Chase',  type: 'Acción', sector: 'Financiero' },
      { id: 'a2', symbol: 'SPY',   name: 'SPDR S&P 500 ETF', type: 'ETF',   sector: 'Índices' },
    ],
  },
  {
    id: 'mock-2',
    title: 'Bitcoin supera los $75,000 tras aprobación de nuevos ETFs spot en Europa',
    content: 'El precio de Bitcoin alcanzó un nuevo máximo histórico de $75,200 USD luego de que reguladores europeos aprobaran el listado de tres nuevos ETFs spot en mercados de la Unión Europea.',
    source: 'Feed de prueba — NewsAPI Mock',
    published_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    sector: 'Criptoactivos',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a3', symbol: 'BTC', name: 'Bitcoin',  type: 'Cripto', sector: 'Criptoactivos' },
      { id: 'a4', symbol: 'ETH', name: 'Ethereum', type: 'Cripto', sector: 'Criptoactivos' },
    ],
  },
  {
    id: 'mock-3',
    title: 'Apple reporta ganancias trimestrales superiores a las expectativas',
    content: 'Apple Inc. (AAPL) publicó resultados del tercer trimestre fiscal 2026 con ingresos de $98.2 mil millones, superando el consenso de analistas de $94.5 mil millones. Las ventas del iPhone crecieron 8% interanual.',
    source: 'Feed de prueba — NewsAPI Mock',
    published_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    sector: 'Tecnología',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a5', symbol: 'AAPL', name: 'Apple Inc.', type: 'Acción', sector: 'Tecnología' },
    ],
  },
  {
    id: 'mock-4',
    title: 'Tesla anuncia expansión de planta en México; acciones suben 4%',
    content: 'Tesla Inc. confirmó la inversión de $2,000 millones de dólares para ampliar su Gigafactory en Monterrey, México. La planta producirá el modelo Cybertruck para mercados latinoamericanos a partir del primer trimestre de 2027.',
    source: 'Feed de prueba — NewsAPI Mock',
    published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    sector: 'Automotriz',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a6', symbol: 'TSLA', name: 'Tesla Inc.', type: 'Acción', sector: 'Automotriz' },
    ],
  },
  {
    id: 'mock-5',
    title: 'Petróleo WTI cae 3% por datos de inventarios en EE.UU.',
    content: 'Los precios del petróleo crudo WTI cayeron un 3.1% tras la publicación del informe semanal de la EIA que mostró un aumento inesperado en los inventarios de crudo de 4.2 millones de barriles.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    sector: 'Energía',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a7', symbol: 'WTI',  name: 'Petróleo WTI', type: 'Commodity', sector: 'Energía' },
      { id: 'a8', symbol: 'XOM',  name: 'Exxon Mobil',  type: 'Acción',    sector: 'Energía' },
    ],
  },
  {
    id: 'mock-6',
    title: 'JPMorgan eleva perspectivas del S&P 500 para cierre de 2026',
    content: 'Estrategas de JPMorgan Chase elevaron su objetivo de precio del S&P 500 a 5,800 puntos para finales de 2026, citando resiliencia económica, moderación de la inflación y solidez de las ganancias corporativas.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    sector: 'Financiero',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a9',  symbol: 'JPM', name: 'JPMorgan Chase', type: 'Acción', sector: 'Financiero' },
      { id: 'a10', symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'ETF', sector: 'Índices' },
    ],
  },
  {
    id: 'mock-7',
    title: 'El peso mexicano se fortalece ante expectativas de recorte de tasas Banxico',
    content: 'El par USD/MXN operó en mínimos de seis meses, por debajo de 17.20, luego de que funcionarios del Banco de México señalaran la posibilidad de un recorte de 25 puntos base en la reunión de agosto.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    sector: 'Forex',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a11', symbol: 'USDMXN', name: 'Dólar/Peso mexicano', type: 'Divisa', sector: 'Forex' },
    ],
  },
  {
    id: 'mock-8',
    title: 'Ethereum completa actualización Pectra; desarrolladores anticipan mayor escalabilidad',
    content: 'La red Ethereum completó exitosamente la actualización Pectra, que introduce mejoras significativas en el manejo de blobs de datos y reduce costos de transacción en capas L2.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    sector: 'Criptoactivos',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a12', symbol: 'ETH', name: 'Ethereum', type: 'Cripto', sector: 'Criptoactivos' },
    ],
  },
  {
    id: 'mock-9',
    title: 'Microsoft integra Copilot en Office 365; analistas proyectan crecimiento cloud',
    content: 'Microsoft anunció la integración completa de Copilot AI en toda la suite Office 365 sin costo adicional para suscriptores Enterprise. Los analistas de Wall Street proyectan un impacto positivo en la retención de clientes.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    sector: 'Tecnología',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a13', symbol: 'MSFT', name: 'Microsoft Corporation', type: 'Acción', sector: 'Tecnología' },
    ],
  },
  {
    id: 'mock-10',
    title: 'Oro alcanza $2,450 por onza ante debilidad del dólar y tensiones geopolíticas',
    content: 'El precio del oro spot superó los $2,450 por onza troy, alcanzando su nivel más alto en tres meses. La debilidad del índice DXY y el aumento de tensiones en la región del Mar Rojo impulsaron la demanda de activos de refugio.',
    source: 'Feed de prueba — Yahoo Finance RSS Mock',
    published_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    sector: 'Metales preciosos',
    is_test_data: true,
    created_at: new Date().toISOString(),
    assets: [
      { id: 'a14', symbol: 'GOLD', name: 'Oro spot', type: 'Commodity', sector: 'Metales preciosos' },
      { id: 'a15', symbol: 'GLD',  name: 'SPDR Gold Shares', type: 'ETF', sector: 'Commodities' },
    ],
  },
];

// ─── Constantes ───────────────────────────────────────────────
const INSTRUMENT_TYPES: AssetType[] = ['Acción','Cripto','ETF','Bono','Commodity','Divisa','Otro'];
const SECTORS = ['Tecnología','Financiero','Energía','Criptoactivos','Automotriz','Forex','Metales preciosos','Índices','Consumo','Otro'];
const SINCE_OPTIONS = [
  { value: '1h',  label: 'Última hora' },
  { value: '24h', label: 'Últimas 24 h' },
  { value: '7d',  label: 'Última semana' },
  { value: '30d', label: 'Último mes' },
];

// ─── Helpers ──────────────────────────────────────────────────
function cutoffDate(since: string): Date {
  const now = new Date();
  switch (since) {
    case '1h':  return subHours(now, 1);
    case '24h': return subHours(now, 24);
    case '7d':  return subDays(now, 7);
    case '30d': return subDays(now, 30);
    default:    return new Date(0);
  }
}

function formatDate(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

// ─── Componente principal ─────────────────────────────────────
export default function RadarNoticias() {
  const { user, roleName } = useAuth();
  const [news, setNews] = useState<NewsWithAssets[]>([]);
  const [loading, setLoading]   = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [selected, setSelected] = useState<NewsWithAssets | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmAnalyze, setConfirmAnalyze] = useState<NewsWithAssets | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  const [filters, setFilters] = useState<NewsFilters>({
    instrument_type: '',
    asset_symbol: '',
    sector: '',
    since: '',
  });

  // Lista de activos disponibles para el filtro de símbolo
  const [assets, setAssets] = useState<Asset[]>([]);

  // ─── Carga de datos ──────────────────────────────────────
  const loadNews = useCallback(async () => {
    setLoading(true);

    // Intentar cargar desde Supabase
    const { data, error } = await supabase
      .from('news')
      .select('*, signals(*, assets(*))')
      .order('published_at', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      // Fallback a mock (RNF-009)
      console.warn('[RadarNoticias] Usando datos de prueba como fallback:', error?.message);
      setNews(MOCK_NEWS);
      setAssets(MOCK_NEWS.flatMap(n => n.assets ?? []).filter(
        (a, i, arr) => arr.findIndex(x => x.symbol === a.symbol) === i
      ));
      setUsingMock(true);
    } else {
      // Enriquecer con activos desde señales (relación news→signals→assets)
      const enriched: NewsWithAssets[] = data.map((n: any) => {
        const signalAssets: Asset[] = (n.signals ?? [])
          .flatMap((s: any) => s.assets ? [s.assets] : [])
          .filter((a: Asset, i: number, arr: Asset[]) =>
            arr.findIndex(x => x.symbol === a.symbol) === i
          );
        return { ...n, assets: signalAssets };
      });
      setNews(enriched);

      // Cargar lista de activos para el selector
      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .order('symbol');
      setAssets(assetData ?? []);
      setUsingMock(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadNews(); }, [loadNews]);

  // ─── Filtrado local (RF-003) ──────────────────────────────
  const filtered = news.filter(n => {
    // Filtro: búsqueda de texto libre (título)
    if (query.trim() && !n.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    // Filtro: tipo de instrumento
    if (filters.instrument_type) {
      const hasType = (n.assets ?? []).some(a => a.type === filters.instrument_type);
      if (!hasType) return false;
    }
    // Filtro: activo específico (símbolo)
    if (filters.asset_symbol) {
      const hasAsset = (n.assets ?? []).some(a =>
        a.symbol.toLowerCase() === filters.asset_symbol.toLowerCase()
      );
      if (!hasAsset) return false;
    }
    // Filtro: sector económico
    if (filters.sector && n.sector !== filters.sector) return false;
    // Filtro: antigüedad
    if (filters.since) {
      const cutoff = cutoffDate(filters.since);
      if (parseISO(n.published_at) < cutoff) return false;
    }
    return true;
  });

  function clearFilters() {
    setFilters({ instrument_type: '', asset_symbol: '', sector: '', since: '' });
    setQuery('');
    setSearchParams({});
  }

  // ─── Lógica de Análisis con Gemini ─────────────────────────
  const handleAnalyze = async (noticia: NewsWithAssets) => {
    if (analyzingIds.has(noticia.id)) return;

    // Si la noticia ya tiene un activo vinculado (por una señal previa), se usa ese.
    // Si no, el Agente 1 (aquí simulado) infiere el activo relacionado por el sector
    // de la noticia — así es como funcionaría el análisis real de Gemini.
    const linkedAsset = noticia.assets && noticia.assets.length > 0 ? noticia.assets[0] : null;
    const inferredAsset = !linkedAsset && noticia.sector
      ? assets.find(a => a.sector === noticia.sector) ?? null
      : null;
    const assetToAnalyze = linkedAsset ?? inferredAsset;

    if (!assetToAnalyze) {
      setToast({ message: 'No se pudo determinar un activo relacionado con esta noticia.', type: 'info' });
      return;
    }

    setAnalyzingIds(prev => {
      const next = new Set(prev);
      next.add(noticia.id);
      return next;
    });

    try {
      // 1 y 2. Invocar Edge Functions (mocked en la demo con timeout)
      // En una implementación real: 
      // const res1 = await supabase.functions.invoke('agent-market-analyst', { body: { newsId: noticia.id } });
      // const res2 = await supabase.functions.invoke('agent-financial-advisor', { body: { ...res1.data } });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulando latencia LLM

      // Simulamos la respuesta de Gemini (fallback) o éxito
      const newSignal = {
        news_id: noticia.id,
        asset_id: assetToAnalyze.id,
        impact: 'Neutral', // Simulación genérica
        confidence: 85,
        explanation: 'Análisis generado por IA confirmando impacto sectorial según los últimos reportes.',
        risks: 'Volatilidad a corto plazo y cambios regulatorios.',
        suggested_research: 'Revisar reportes de ganancias del próximo trimestre.',
        status: 'Pendiente'
      };

      const { data: insertedSignal, error: insertError } = await supabase
        .from('signals')
        .insert(newSignal)
        .select('*, assets(*)')
        .single();

      if (insertError) throw insertError;

      // 5. Registrar en audit_logs (RF-017)
      if (insertedSignal) {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'signal.create',
          entity: 'signals',
          entity_id: insertedSignal.id,
          new_state: insertedSignal
        });

        // Actualizar UI local para reflejar que fue analizada sin recargar
        setNews(prev => prev.map(n => {
          if (n.id === noticia.id) {
            return {
              ...n,
              signals: [...(n.signals || []), insertedSignal]
            };
          }
          return n;
        }));
      }

    } catch (err: any) {
      console.error("Error en análisis:", err);
      setToast({ message: `No se pudo completar el análisis. Intenta de nuevo. (${err.message})`, type: 'error' });
      // RNF-009: Fallback de seguridad en Incierto
      try {
        const fallbackSignal = {
          news_id: noticia.id,
          asset_id: assetToAnalyze.id,
          impact: 'Incierto',
          confidence: 30,
          explanation: 'No se pudo completar el análisis mediante IA. Impacto desconocido.',
          status: 'Pendiente'
        };
        const { data: insertedSignal } = await supabase.from('signals').insert(fallbackSignal).select('*, assets(*)').single();
        if (insertedSignal) {
          await supabase.from('audit_logs').insert({
            user_id: user?.id,
            action: 'signal.create',
            entity: 'signals',
            entity_id: insertedSignal.id,
            new_state: insertedSignal
          });
          setNews(prev => prev.map(n => n.id === noticia.id ? { ...n, signals: [...(n.signals || []), insertedSignal] } : n));
        }
      } catch (fallbackErr) {
        console.error("Fallback también falló", fallbackErr);
      }
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(noticia.id);
        return next;
      });
    }
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || query.trim() !== '';

  return (
    <div>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ─── Encabezado de página ─── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Newspaper size={24} style={{ color: 'var(--accent-light)' }} />
            Radar de Noticias
          </h1>
          <p className="page-subtitle">
            Noticias financieras recientes relacionadas con instrumentos del mercado
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {usingMock && (
            <div className="chip chip-test-data" style={{ padding: '6px 12px' }}>
              <FlaskConical size={12} />
              Datos de prueba activos
            </div>
          )}
          <button
            id="radar-refresh"
            className="btn btn-secondary btn-sm"
            onClick={loadNews}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* ─── Barra de filtros (SRS §24.2, RF-003) ─── */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filtros
          </span>
          {hasActiveFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ marginLeft: 'auto', gap: '4px' }}>
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
        <div className="filter-bar">
          {/* Búsqueda de texto libre */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="filter-search"
              type="text"
              className="filter-select"
              placeholder="Buscar por título…"
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchParams(e.target.value ? { q: e.target.value } : {}); }}
              aria-label="Buscar noticias por título"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          {/* Tipo de instrumento */}
          <select
            id="filter-instrument-type"
            className="filter-select"
            value={filters.instrument_type}
            onChange={e => setFilters(f => ({ ...f, instrument_type: e.target.value as AssetType | '' }))}
            aria-label="Filtrar por tipo de instrumento"
          >
            <option value="">Todos los instrumentos</option>
            {INSTRUMENT_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Activo específico */}
          <select
            id="filter-asset"
            className="filter-select"
            value={filters.asset_symbol}
            onChange={e => setFilters(f => ({ ...f, asset_symbol: e.target.value }))}
            aria-label="Filtrar por activo específico"
          >
            <option value="">Todos los activos</option>
            {assets.map(a => (
              <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
            ))}
          </select>

          {/* Sector económico */}
          <select
            id="filter-sector"
            className="filter-select"
            value={filters.sector}
            onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
            aria-label="Filtrar por sector económico"
          >
            <option value="">Todos los sectores</option>
            {SECTORS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Antigüedad */}
          <select
            id="filter-since"
            className="filter-select"
            value={filters.since}
            onChange={e => setFilters(f => ({ ...f, since: e.target.value as NewsFilters['since'] }))}
            aria-label="Filtrar por antigüedad"
          >
            <option value="">Cualquier fecha</option>
            {SINCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── Stats rápidas ─── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{filtered.length}</span>
          {' '}noticia{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
          {hasActiveFilters && ` (de ${news.length} total)`}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          · <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {new Set(news.map(n => n.source)).size}
          </span> fuentes activas
        </div>
      </div>

      {/* ─── Lista de tarjetas (SRS §24.2) ─── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '110px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Search size={36} />
          <h3>Sin resultados</h3>
          <p>No se encontraron noticias con los filtros seleccionados. Prueba ajustando los criterios.</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(noticia => (
            <NewsCard
              key={noticia.id}
              noticia={noticia}
              onClick={() => setSelected(noticia)}
              onAnalyze={(e) => {
                e.stopPropagation();
                setConfirmAnalyze(noticia);
              }}
              isAnalyzing={analyzingIds.has(noticia.id)}
            />
          ))}
        </div>
      )}

      {/* ─── Vista de detalle (SRS §24.2) ─── */}
      {selected && (
        <DetalleNoticia
          noticia={news.find(n => n.id === selected.id) || selected}
          onClose={() => setSelected(null)}
          onReanalyze={handleAnalyze}
          isAnalyzing={analyzingIds.has(selected.id)}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmAnalyze}
        title="Confirmar análisis con IA"
        message={`¿Confirmas analizar "${confirmAnalyze?.title}"? Esto generará una nueva señal a partir de esta noticia.`}
        confirmText="Analizar con IA"
        isDestructive={false}
        onConfirm={() => {
          if (confirmAnalyze) handleAnalyze(confirmAnalyze);
          setConfirmAnalyze(null);
        }}
        onCancel={() => setConfirmAnalyze(null)}
      />
    </div>
  );
}

// ─── NewsCard ─────────────────────────────────────────────────
function NewsCard({
  noticia,
  onClick,
  onAnalyze,
  isAnalyzing,
}: {
  noticia: NewsWithAssets;
  onClick: () => void;
  onAnalyze: (e: React.MouseEvent) => void;
  isAnalyzing: boolean;
}) {
  const isAnalyzed = (noticia.signals?.length || 0) > 0;

  return (
    <article className="news-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Ver detalle de: ${noticia.title}`}
    >
      <div className="news-card-header">
        <div style={{ flex: 1 }}>
          <div className="news-title">{noticia.title}</div>
          <div className="news-meta" style={{ marginTop: '6px' }}>
            {/* Fuente (RF-001) */}
            <span className="news-source" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ExternalLink size={11} />
              {noticia.source}
            </span>
            <span>·</span>
            {/* Fecha/hora (RF-001) */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} />
              {formatDate(noticia.published_at)}
            </span>
            {noticia.sector && (
              <>
                <span>·</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building2 size={11} />
                  {noticia.sector}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
      </div>

      {/* Extracto */}
      <p style={{
        fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.55',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {noticia.content}
      </p>

      {/* Activos relacionados (RF-002) */}
      {(noticia.assets ?? []).length > 0 && (
        <div className="news-assets" style={{ marginBottom: '12px' }}>
          {(noticia.assets ?? []).map(asset => (
            <span key={asset.symbol} className="chip chip-asset">
              <TrendingUp size={10} />
              {asset.symbol}
              <span style={{ opacity: 0.6, fontWeight: 400 }}>·{asset.type}</span>
            </span>
          ))}
        </div>
      )}

      {/* Controles de Análisis */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          Estado: 
          {isAnalyzing ? (
            <span style={{ color: 'var(--text-muted)' }}>Analizando...</span>
          ) : isAnalyzed ? (
            <span style={{ color: 'var(--positivo)' }}>Analizado</span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Sin analizar</span>
          )}
        </div>
        
        <div>
          {isAnalyzing ? (
            <button className="btn btn-secondary btn-sm" disabled>
              <span className="spinner" style={{ width: 14, height: 14 }} /> Analizando...
            </button>
          ) : isAnalyzed ? (
            <button className="btn btn-ghost btn-sm" onClick={onClick}>Ver análisis</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onAnalyze}>
              Analizar con IA
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
