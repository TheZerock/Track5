/* ============================================================
 * Dashboard.tsx
 * Implementa RF-013 — SRS §24.1
 * Layout inspirado en dashboards fintech (tipo Tradeflare) pero
 * adaptado 100% al propósito real: señales explicables de IA,
 * nunca ejecución de operaciones. Todo botón de acción termina
 * en una revisión humana (Revisada/Escalada/Descartada), jamás
 * en una compra/venta.
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import type { Signal, News, Asset, Briefing, SignalStatus } from '../types/database';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  TrendingUp, TrendingDown, Info,
  ArrowUpRight, ArrowDownRight, Clock, Newspaper, BookMarked,
  FileText, History, CheckCircle, AlertTriangle, XCircle, Zap, FlaskConical,
  Minus, HelpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import ConfirmModal from '../components/ConfirmModal';
import { generatePriceSeries, formatPrice } from '../lib/mockPrices';

function tightDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    return [min - pad, max + pad];
  }
  return [min * 0.998, max * 1.002];
}

type PriceRangeKey = '24h' | '7d' | '30d' | '90d' | 'all';
const PRICE_RANGE_CONFIG: Record<PriceRangeKey, { points: number; hoursSpan: number; labelFmt: string; title: string }> = {
  '24h': { points: 24, hoursSpan: 24,    labelFmt: 'HH:mm',     title: 'Últimas 24 horas' },
  '7d':  { points: 42, hoursSpan: 168,   labelFmt: 'EEE HH:mm', title: 'Últimos 7 días' },
  '30d': { points: 30, hoursSpan: 720,   labelFmt: 'd MMM',     title: 'Últimos 30 días' },
  '90d': { points: 45, hoursSpan: 2160,  labelFmt: 'd MMM',     title: 'Últimos 90 días' },
  'all': { points: 60, hoursSpan: 4320,  labelFmt: 'd MMM',     title: 'Todo el historial' },
};

function PriceChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const price = payload[0].value as number;
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
      padding: '8px 12px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatPrice(price)}</div>
    </div>
  );
}

// ─── Mock data para dashboard (RNF-009: fallback si Supabase no responde) ──
const MOCK_SIGNALS: Signal[] = [
  { id: 's1', news_id: 'mock-1', asset_id: 'a3', impact: 'Positivo',  confidence: 85, explanation: 'La aprobación de ETFs spot de Bitcoin en Europa abre el acceso institucional a una base de inversores significativamente mayor.', risks: 'Alta volatilidad histórica del activo.', suggested_research: null, historical_comparison: null, status: 'Pendiente', reviewed_by: null, review_comment: null, created_at: new Date().toISOString(), assets: { id:'a3', symbol:'BTC', name:'Bitcoin', type:'Cripto', sector:'Criptoactivos' }, news: { id:'mock-1', title:'Bitcoin supera los $75,000 tras aprobación de ETFs', content:'', source:'CoinDesk', published_at: new Date(Date.now()-5*3600*1000).toISOString(), sector:'Criptoactivos', is_test_data:true, created_at:new Date().toISOString() } },
  { id: 's2', news_id: 'mock-3', asset_id: 'a5', impact: 'Positivo',  confidence: 78, explanation: 'Los resultados de Apple superan el consenso en ingresos y márgenes operativos.', risks: 'Saturación del mercado de smartphones premium.', suggested_research: null, historical_comparison: null, status: 'Revisada', reviewed_by: null, review_comment: null, created_at: new Date().toISOString(), assets: { id:'a5', symbol:'AAPL', name:'Apple Inc.', type:'Acción', sector:'Tecnología' }, news: { id:'mock-3', title:'Apple reporta ganancias trimestrales superiores a expectativas', content:'', source:'Bloomberg', published_at: new Date(Date.now()-24*3600*1000).toISOString(), sector:'Tecnología', is_test_data:true, created_at:new Date().toISOString() } },
  { id: 's3', news_id: 'mock-5', asset_id: 'a7', impact: 'Negativo',  confidence: 72, explanation: 'El aumento inesperado de inventarios de crudo señala debilidad en la demanda.', risks: 'Posible recorte de producción de la OPEP+.', suggested_research: null, historical_comparison: null, status: 'Pendiente', reviewed_by: null, review_comment: null, created_at: new Date(Date.now()-6*3600*1000).toISOString(), assets: { id:'a7', symbol:'WTI', name:'Petróleo WTI', type:'Commodity', sector:'Energía' }, news: { id:'mock-5', title:'Petróleo WTI cae 3% por datos de inventarios en EE.UU.', content:'', source:'Yahoo Finance RSS', published_at: new Date(Date.now()-6*3600*1000).toISOString(), sector:'Energía', is_test_data:true, created_at:new Date().toISOString() } },
  { id: 's4', news_id: 'mock-4', asset_id: 'a6', impact: 'Positivo',  confidence: 80, explanation: 'La confirmación de inversión en la Gigafactory de México amplía la capacidad productiva.', risks: 'Posibles retrasos en construcción y permisos.', suggested_research: null, historical_comparison: null, status: 'Escalada', reviewed_by: null, review_comment: null, created_at: new Date(Date.now()-3*3600*1000).toISOString(), assets: { id:'a6', symbol:'TSLA', name:'Tesla Inc.', type:'Acción', sector:'Automotriz' }, news: { id:'mock-4', title:'Tesla anuncia expansión de planta en México', content:'', source:'Reuters', published_at: new Date(Date.now()-3*3600*1000).toISOString(), sector:'Automotriz', is_test_data:true, created_at:new Date().toISOString() } },
  { id: 's5', news_id: 'mock-6', asset_id: 'a12', impact: 'Neutral', confidence: 61, explanation: 'La actualización Pectra mejora la eficiencia técnica de la red Ethereum.', risks: 'Adopción lenta de mejoras L2.', suggested_research: null, historical_comparison: null, status: 'Descartada', reviewed_by: null, review_comment: 'Impacto no relevante para el portafolio actual.', created_at: new Date(Date.now()-12*3600*1000).toISOString(), assets: { id:'a12', symbol:'ETH', name:'Ethereum', type:'Cripto', sector:'Criptoactivos' }, news: { id:'mock-6', title:'Ethereum completa actualización Pectra', content:'', source:'Yahoo Finance RSS', published_at: new Date(Date.now()-12*3600*1000).toISOString(), sector:'Criptoactivos', is_test_data:true, created_at:new Date().toISOString() } },
];

const MOCK_NEWS_RECENT: (News & { assets?: Asset[] })[] = [
  { id: 'mock-1', title: 'La Fed mantiene tasas sin cambios en reunión de julio', source: 'Reuters', published_at: new Date(Date.now()-2*3600*1000).toISOString(), content: '', sector: 'Financiero', is_test_data: true, created_at: new Date().toISOString() },
  { id: 'mock-2', title: 'Bitcoin supera los $75,000 tras aprobación de ETFs', source: 'CoinDesk', published_at: new Date(Date.now()-5*3600*1000).toISOString(), content: '', sector: 'Criptoactivos', is_test_data: true, created_at: new Date().toISOString() },
  { id: 'mock-3', title: 'Apple reporta ganancias trimestrales superiores a expectativas', source: 'Bloomberg', published_at: new Date(Date.now()-24*3600*1000).toISOString(), content: '', sector: 'Tecnología', is_test_data: true, created_at: new Date().toISOString() },
];

const MOCK_BRIEFINGS: Briefing[] = [
  { id: 'b1', title: 'Impacto de la Fed en renta fija', watchlist_id: null, asset_id: 'a3', status: 'En revisión', created_by: 'u1', approved_by: null, created_at: new Date(Date.now()-3*3600*1000).toISOString(), assets: { id:'a3', symbol:'BTC', name:'Bitcoin', type:'Cripto', sector:'Criptoactivos' } },
  { id: 'b2', title: 'Resumen semanal — Sector Tecnología', watchlist_id: null, asset_id: 'a5', status: 'Aprobado', created_by: 'u1', approved_by: 'u2', created_at: new Date(Date.now()-26*3600*1000).toISOString(), assets: { id:'a5', symbol:'AAPL', name:'Apple Inc.', type:'Acción', sector:'Tecnología' } },
  { id: 'b3', title: 'Riesgo geopolítico — Energía', watchlist_id: null, asset_id: 'a7', status: 'Borrador', created_by: 'u1', approved_by: null, created_at: new Date(Date.now()-8*3600*1000).toISOString(), assets: { id:'a7', symbol:'WTI', name:'Petróleo WTI', type:'Commodity', sector:'Energía' } },
];

const STATUS_ICONS: Record<SignalStatus, React.ReactNode> = {
  Pendiente:   <Clock       size={12} />,
  Revisada:    <CheckCircle size={12} />,
  Escalada:    <AlertTriangle size={12} />,
  Descartada:  <XCircle     size={12} />,
};

const STATUS_COLORS: Record<SignalStatus, string> = {
  Pendiente:  'var(--incierto)',
  Revisada:   'var(--positivo)',
  Escalada:   '#8b5cf6',
  Descartada: 'var(--text-muted)',
};

const BRIEFING_STATUS_COLORS: Record<string, string> = {
  'Borrador':     'var(--borrador)',
  'En revisión':  'var(--en-revision)',
  'Aprobado':     'var(--aprobado)',
  'Escalado':     'var(--escalado)',
};

type SignalImpact = 'Positivo' | 'Negativo' | 'Neutral' | 'Incierto';
const IMPACT_ICON: Record<SignalImpact, React.ReactNode> = {
  Positivo: <TrendingUp size={13} />,
  Negativo: <TrendingDown size={13} />,
  Neutral:  <Minus size={13} />,
  Incierto: <HelpCircle size={13} />,
};

// ─── Activos disponibles en el panel de info de activo ────────
const FEATURED_ASSETS: { symbol: string; name: string; type: Asset['type']; sector: string }[] = [
  { symbol: 'BTC',  name: 'Bitcoin',              type: 'Cripto',    sector: 'Criptoactivos' },
  { symbol: 'ETH',  name: 'Ethereum',             type: 'Cripto',    sector: 'Criptoactivos' },
  { symbol: 'SPY',  name: 'SPDR S&P 500 ETF',     type: 'ETF',       sector: 'Índices' },
  { symbol: 'AAPL', name: 'Apple Inc.',            type: 'Acción',    sector: 'Tecnología' },
  { symbol: 'WTI',  name: 'Petróleo WTI',         type: 'Commodity', sector: 'Energía' },
  { symbol: 'GOLD', name: 'Oro spot',              type: 'Commodity', sector: 'Metales preciosos' },
];

export default function Dashboard() {
  const { user, roleName } = useAuth();

  const [signals, setSignals]       = useState<Signal[]>(MOCK_SIGNALS);
  const [news, setNews]             = useState<(News & { assets?: Asset[] })[]>(MOCK_NEWS_RECENT);
  const [briefings, setBriefings]   = useState<Briefing[]>(MOCK_BRIEFINGS);
  const [briefingsPending, setBriefingsPending] = useState(0);
  const [alertsCount, setAlertsCount]           = useState(3);
  // Panel de activo destacado
  const [featuredAssetSymbol, setFeaturedAssetSymbol] = useState('BTC');
  const [assetPriceRange, setAssetPriceRange] = useState<PriceRangeKey>('24h');

  useEffect(() => {
    async function load() {
      const [sigRes, newsRes, briefListRes, briefRes, alertRes] = await Promise.all([
        supabase.from('signals').select('*, assets(*), news(*)').order('created_at', { ascending: false }).limit(20),
        supabase.from('news').select('*').order('published_at', { ascending: false }).limit(5),
        supabase.from('briefings').select('*, assets(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('briefings').select('id', { count: 'exact' }).in('status', ['Borrador','En revisión']),
        supabase.from('alerts').select('id', { count: 'exact' }).eq('is_active', true),
      ]);

      if (!sigRes.error && (sigRes.data?.length ?? 0) > 0) {
        setSignals(sigRes.data as Signal[]);
        setNews(newsRes.data as News[]);
        setBriefingsPending(briefRes.count ?? 0);
        setAlertsCount(alertRes.count ?? 3);
      }
      if (!briefListRes.error && (briefListRes.data?.length ?? 0) > 0) {
        setBriefings(briefListRes.data as Briefing[]);
      }
    }
    load();
  }, []);

  // ─── KPIs ────────────────────────────────────────────────────
  const noticiasDia    = news.length;
  const senalesTotal   = signals.length;

  // Activos más impactados (para tabla) + última señal por activo (para watchlist lateral)
  const assetImpact: Record<string, { symbol: string; asset?: Asset; signals: Signal[]; positivos: number; negativos: number; latest: Signal }> = {};
  signals.forEach(s => {
    const sym = s.assets?.symbol ?? 'N/A';
    if (!assetImpact[sym]) assetImpact[sym] = { symbol: sym, asset: s.assets, signals: [], positivos: 0, negativos: 0, latest: s };
    assetImpact[sym].signals.push(s);
    if (s.impact === 'Positivo') assetImpact[sym].positivos++;
    if (s.impact === 'Negativo') assetImpact[sym].negativos++;
    if (parseISO(s.created_at) > parseISO(assetImpact[sym].latest.created_at)) assetImpact[sym].latest = s;
  });
  const topAssets = Object.values(assetImpact).sort((a, b) => b.signals.length - a.signals.length).slice(0, 4);
  const watchlistAssets = Object.values(assetImpact).sort((a, b) => parseISO(b.latest.created_at).getTime() - parseISO(a.latest.created_at).getTime()).slice(0, 6);

  // Señal destacada: la Pendiente con mayor confianza, o si no hay, la más reciente
  const pendientes = signals.filter(s => s.status === 'Pendiente').sort((a, b) => b.confidence - a.confidence);
  const featuredSignal = pendientes[0] ?? [...signals].sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())[0];

  const historial = signals.filter(s => s.status !== 'Pendiente')
    .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
    .slice(0, 5);

  // Sparklines de activos para el "Resumen de Mercado" (3 activos fijos)
  const SUMMARY_ASSETS: { symbol: string; name: string; type: Asset['type'] }[] = [
    { symbol: 'BTC',  name: 'Bitcoin',          type: 'Cripto' },
    { symbol: 'ETH',  name: 'Ethereum',         type: 'Cripto' },
    { symbol: 'SPY',  name: 'S&P 500 ETF',      type: 'ETF'    },
  ];

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* ─── Encabezado ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Análisis y señales explicables — ninguna acción aquí ejecuta operaciones financieras
          </p>
        </div>
        <Link to="/briefings" className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', textDecoration: 'none' }}>
          Generar Briefing
        </Link>
      </div>

      {/* ─── Layout principal: contenido + lateral ─── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ═══════════ Columna principal ═══════════ */}
        <div style={{ flex: '1 1 640px', minWidth: 0 }}>

          {/* ─── Panel de Activo Destacado + KPIs ─── */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <AssetInfoPanel
              symbol={featuredAssetSymbol}
              assetMeta={FEATURED_ASSETS.find(a => a.symbol === featuredAssetSymbol)!}
              priceRange={assetPriceRange}
              onRangeChange={setAssetPriceRange}
              allAssets={FEATURED_ASSETS}
              onAssetChange={setFeaturedAssetSymbol}
            />

            <div className="card" style={{ width: '280px', padding: '0', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Métricas Diarias</span>
                <Info size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <StatRow label="Noticias Analizadas" value={noticiasDia} prev={Math.floor(noticiasDia * 0.8)} />
                <StatRow label="Señales Generadas" value={senalesTotal} prev={Math.floor(senalesTotal * 0.9)} />
                <StatRow label="Alertas Activas" value={alertsCount} prev={alertsCount + 1} invert />
                <StatRow label="Briefings Pendientes" value={briefingsPending} prev={briefingsPending - 1} isLast />
              </div>
            </div>
          </div>

          {/* ─── Resumen de Mercado: mini-cards de activos ─── */}
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Resumen de Mercado</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {SUMMARY_ASSETS.map(a => (
              <AssetSummaryCard key={a.symbol} symbol={a.symbol} name={a.name} type={a.type} />
            ))}
          </div>

          {/* ─── Activos Destacados + Noticias Recientes ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Activos Destacados</div>
                <Info size={14} style={{ color: 'var(--text-muted)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '50%' }}>Activo</div>
                <div style={{ width: '25%', textAlign: 'right' }}>Señales</div>
                <div style={{ width: '25%', textAlign: 'right' }}>Última señal</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topAssets.map((asset, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '50%' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {asset.symbol.slice(0, 1)}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{asset.symbol}</div>
                    </div>
                    <div style={{ width: '25%', textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {asset.signals.length}
                    </div>
                    <div style={{ width: '25%', textAlign: 'right' }}>
                      <span className={`impact-badge impact-${asset.latest.impact}`} style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                        {asset.latest.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Noticias Recientes</div>
                <Link to="/noticias" style={{ fontSize: '12px', color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
                  Ver todas →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {news.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
                    No hay noticias recientes.
                  </div>
                )}
                {news.slice(0, 5).map((n) => (
                  <Link
                    key={n.id}
                    to="/noticias"
                    className="dashboard-news-row"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: '6px',
                      padding: '10px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {n.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      <span className="news-source" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Newspaper size={11} /> {n.source}
                      </span>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        {formatDistanceToNow(parseISO(n.published_at), { addSuffix: true, locale: es })}
                      </span>
                      {n.sector && <span className="chip chip-sector">{n.sector}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Precios de Activos Destacados ─── */}
          {watchlistAssets.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Precios de Activos Destacados</div>
                <div className="chip chip-test-data" style={{ padding: '4px 10px', fontSize: '10.5px' }}>
                  <FlaskConical size={11} /> Precios simulados — no son cotizaciones reales
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px' }}>
                {watchlistAssets.map(a => (
                  <AssetPriceCard key={a.symbol} symbol={a.symbol} type={a.asset?.type} />
                ))}
              </div>
            </div>
          )}

          {/* ─── Briefings Recientes + Historial de Señales ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} style={{ color: 'var(--text-muted)' }} /> Briefings Recientes
                </div>
                <Link to="/briefings" style={{ fontSize: '12px', color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
                  Ver todos →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {briefings.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>Sin briefings recientes.</div>
                )}
                {briefings.slice(0, 5).map(b => (
                  <Link key={b.id} to="/briefings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {b.assets?.symbol ?? 'General'} · {formatDistanceToNow(parseISO(b.created_at), { addSuffix: true, locale: es })}
                      </div>
                    </div>
                    <span style={{
                      flexShrink: 0, fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                      color: BRIEFING_STATUS_COLORS[b.status] ?? 'var(--text-muted)',
                      background: 'color-mix(in srgb, ' + (BRIEFING_STATUS_COLORS[b.status] ?? 'var(--text-muted)') + ' 15%, transparent)',
                    }}>
                      {b.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} style={{ color: 'var(--text-muted)' }} /> Historial de Señales
                </div>
                <Link to="/senales" style={{ fontSize: '12px', color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
                  Ver todas →
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historial.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>Aún no hay señales revisadas.</div>
                )}
                {historial.map(s => (
                  <Link key={s.id} to="/senales" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span className={`impact-badge impact-${s.impact}`} style={{ fontSize: '10px', padding: '2px 7px', flexShrink: 0 }}>
                        {IMPACT_ICON[s.impact]}
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.assets?.symbol}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: STATUS_COLORS[s.status], flexShrink: 0 }}>
                      {STATUS_ICONS[s.status]} {s.status}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ Columna lateral ═══════════ */}
        <aside style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <WatchlistWidget assets={watchlistAssets} />
          {featuredSignal && (
            <SignalHighlightCard
              signal={featuredSignal}
              canReview={!!roleName && ['Administrador','Analista','Supervisor'].includes(roleName)}
              userId={user?.id}
              onUpdate={updated => setSignals(prev => prev.map(s => s.id === updated.id ? updated : s))}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────

function StatRow({ label, value, prev, invert = false, isLast = false }: { label: string; value: number; prev: number; invert?: boolean; isLast?: boolean }) {
  const diff = value - prev;
  const isPositive = diff >= 0;
  const isGood = invert ? !isPositive : isPositive;
  void isGood; // color computed but not applied visually — kept for possible future use

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: isLast ? 0 : '16px', borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: 2, height: 12, background: 'var(--accent)', borderRadius: 2 }} />
        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hoy</span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{value}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ayer</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{prev}</span>
        </div>
      </div>
    </div>
  );
}



// ─── Mini-gráfica de precio (simulado) por activo destacado ───
function AssetPriceCard({ symbol, type }: { symbol: string; type?: Asset['type'] }) {
  const series = React.useMemo(() => generatePriceSeries(symbol, type ?? 'Otro', 20, 24), [symbol, type]);
  const first = series[0].price;
  const last = series[series.length - 1].price;
  const changePct = ((last - first) / first) * 100;
  const isUp = changePct >= 0;

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontWeight: 700, fontSize: '12.5px' }}>{symbol}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10.5px', fontWeight: 700,
          color: isUp ? 'var(--positivo)' : 'var(--negativo)',
        }}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </span>
      </div>
      <div style={{ height: '40px', margin: '2px 0 6px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`dash-price-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="price" stroke={isUp ? 'var(--positivo)' : 'var(--negativo)'} strokeWidth={1.5} fill={`url(#dash-price-grad-${symbol})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(last)}</div>
    </div>
  );
}

// ─── Watchlist lateral: activos con badge de última señal ────
function WatchlistWidget({ assets }: { assets: { symbol: string; asset?: Asset; latest: Signal }[] }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BookMarked size={14} style={{ color: 'var(--text-muted)' }} /> Watchlist
        </div>
        <Link to="/watchlists" style={{ fontSize: '11.5px', color: 'var(--accent-light)', fontWeight: 500, textDecoration: 'none' }}>
          Gestionar →
        </Link>
      </div>
      {assets.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin activos con señales aún.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {assets.map(a => (
            <Link key={a.symbol} to="/senales" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                  {a.symbol.slice(0, 2)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.symbol}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.asset?.sector ?? a.asset?.type ?? ''}
                  </div>
                </div>
              </div>
              <span className={`impact-badge impact-${a.latest.impact}`} style={{ fontSize: '10px', padding: '2px 8px', flexShrink: 0 }}>
                {IMPACT_ICON[a.latest.impact]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Señal Destacada: reemplaza el panel "Create Order" ───────
// Nunca ejecuta operaciones: solo permite marcar la revisión humana.
function SignalHighlightCard({ signal, canReview, userId, onUpdate }: {
  signal: Signal;
  canReview: boolean;
  userId?: string;
  onUpdate: (s: Signal) => void;
}) {
  const [newStatus, setNewStatus] = useState<SignalStatus>(signal.status);
  const [comment, setComment]     = useState(signal.review_comment ?? '');
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  const confidenceClass =
    signal.confidence >= 70 ? 'confidence-high' :
    signal.confidence >= 40 ? 'confidence-medium' :
    'confidence-low';

  function handleSave() {
    if (!comment.trim()) { setSaveError('La justificación es obligatoria (RN-04).'); return; }
    setConfirmSave(true);
  }

  async function execute() {
    setConfirmSave(false);
    setSaving(true);
    setSaveError(null);

    const { data, error } = await supabase
      .from('signals')
      .update({ status: newStatus, reviewed_by: userId, review_comment: comment })
      .eq('id', signal.id)
      .select('*, assets(*), news(*)')
      .single();

    if (error) {
      onUpdate({ ...signal, status: newStatus, review_comment: comment });
    } else {
      onUpdate(data as Signal);
    }
    setSaving(false);
  }

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Señal Destacada</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {signal.assets?.symbol}
            <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              {signal.assets?.name}
            </span>
          </div>
        </div>
        <span className={`impact-badge impact-${signal.impact}`} style={{ fontSize: '11px' }}>
          {IMPACT_ICON[signal.impact]} {signal.impact}
        </span>
      </div>

      {/* Confianza */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div className="confidence-bar-container" style={{ flex: 1 }}>
          <div className={`confidence-bar ${confidenceClass}`} style={{ width: `${signal.confidence}%` }} />
        </div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: signal.confidence >= 70 ? 'var(--positivo)' : signal.confidence >= 40 ? 'var(--incierto)' : 'var(--negativo)' }}>
          {signal.confidence}%
        </div>
      </div>

      {/* Explicación */}
      <p style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {signal.explanation}
      </p>

      {/* Evidencia */}
      {signal.news && (
        <div style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)', marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
            Fuente
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>{signal.news.title}</div>
          <div style={{ fontSize: '11px', color: 'var(--accent-light)', marginTop: '3px' }}>
            {signal.news.source} · {formatDistanceToNow(parseISO(signal.news.published_at), { addSuffix: true, locale: es })}
          </div>
        </div>
      )}

      {/* Acciones de revisión (nunca ejecución de operaciones) */}
      {canReview ? (
        <>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {(['Revisada','Escalada','Descartada'] as SignalStatus[]).map(s => (
              <button
                key={s}
                className={`btn ${newStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setNewStatus(s)}
                style={{ gap: '5px', fontSize: '11.5px' }}
              >
                {STATUS_ICONS[s]} {s}
              </button>
            ))}
          </div>
          <textarea
            className="form-textarea"
            placeholder="Justificación de la revisión (obligatoria, RN-04)…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            style={{ fontSize: '12px', marginBottom: '8px' }}
          />
          {saveError && (
            <div style={{ color: 'var(--negativo)', fontSize: '11.5px', marginBottom: '8px', display: 'flex', gap: '5px', alignItems: 'center' }}>
              <AlertTriangle size={12} /> {saveError}
            </div>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Guardando…</> : <><CheckCircle size={13} /> Guardar revisión</>}
          </button>
        </>
      ) : (
        <Link to="/senales" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
          <Zap size={13} /> Ver todas las señales
        </Link>
      )}

      {/* Disclaimer fijo (RF-008, RNF-011, RN-01) */}
      <div className="disclaimer" style={{ marginTop: '14px', fontSize: '11px' }}>
        <AlertTriangle size={13} />
        <span>
          Esta señal no constituye asesoría financiera personalizada ni garantiza resultados.
          El sistema no ejecuta operaciones; toda acción es una propuesta para revisión humana.
        </span>
      </div>

      <ConfirmModal
        isOpen={confirmSave}
        title="Confirmar revisión de señal"
        message={`¿Confirmas guardar esta señal (${signal.assets?.symbol}) como "${newStatus}"?`}
        confirmText="Guardar revisión"
        isDestructive={newStatus === 'Descartada'}
        onConfirm={execute}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}

// ─── Panel de información de activo (reemplaza "Actividad de Señales") ─────
function AssetInfoPanel({
  symbol,
  assetMeta,
  priceRange,
  onRangeChange,
  allAssets,
  onAssetChange,
}: {
  symbol: string;
  assetMeta: { symbol: string; name: string; type: Asset['type']; sector: string };
  priceRange: PriceRangeKey;
  onRangeChange: (r: PriceRangeKey) => void;
  allAssets: { symbol: string; name: string; type: Asset['type']; sector: string }[];
  onAssetChange: (s: string) => void;
}) {
  const cfg = PRICE_RANGE_CONFIG[priceRange];
  const series = React.useMemo(
    () => generatePriceSeries(symbol, assetMeta?.type ?? 'Otro', cfg.points, cfg.hoursSpan),
    [symbol, assetMeta, cfg.points, cfg.hoursSpan]
  );

  const first      = series[0]?.price ?? 0;
  const last       = series[series.length - 1]?.price ?? 0;
  const changePct  = first !== 0 ? ((last - first) / first) * 100 : 0;
  const isUp       = changePct >= 0;
  const priceColor = isUp ? 'var(--positivo)' : 'var(--negativo)';

  // Estadísticas simuladas derivadas del precio
  const high24h   = Math.max(...series.map(p => p.price));
  const low24h    = Math.min(...series.map(p => p.price));
  const volume    = (last * (Math.random() * 5000 + 2000)).toFixed(0);
  const mktCap    = (last * (Math.random() * 1_000_000 + 500_000)).toFixed(0);

  // Datos de volumen (barra inferior): aleatorios pero coherentes
  const volumeSeries = series.map((p, i) => ({
    time: p.time,
    vol:  Math.floor(Math.abs((series[i - 1]?.price ?? p.price) - p.price) * 800 + 50),
  }));

  // Formateador de etiqueta del eje X
  const xFormatter = (t: string) => {
    const d = new Date(t);
    if (priceRange === '24h') return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  function fmtLargeNum(n: string) {
    const v = parseFloat(n);
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toLocaleString()}`;
  }

  const RANGES: PriceRangeKey[] = ['24h', '7d', '30d', '90d', 'all'];

  return (
    <div className="card" style={{ flex: '1 1 380px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
      {/* ── Cabecera: selector + nombre + tipo ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          {/* Selector de activo */}
          <div style={{ marginBottom: '6px' }}>
            <select
              value={symbol}
              onChange={e => onAssetChange(e.target.value)}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '11px',
                padding: '4px 10px', cursor: 'pointer', outline: 'none',
                fontWeight: 600, letterSpacing: '0.3px',
              }}
              aria-label="Seleccionar activo"
            >
              {allAssets.map(a => (
                <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
              ))}
            </select>
          </div>

          {/* Precio actual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1.5px', fontVariantNumeric: 'tabular-nums' }}>
              {formatPrice(last)}
            </div>
            <div style={{
              background: isUp ? 'var(--positivo-bg)' : 'var(--negativo-bg)',
              color: priceColor,
              padding: '3px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isUp ? '+' : ''}{changePct.toFixed(2)}%
            </div>
          </div>

          {/* Tipo + sector */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
              {assetMeta?.type}
            </span>
            <span style={{ opacity: 0.7 }}>{assetMeta?.sector}</span>
          </div>
        </div>

        {/* Selector de rango */}
        <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', height: 'fit-content' }}>
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className="range-pill-btn"
              style={{
                background: priceRange === r ? 'var(--bg-surface)' : 'transparent',
                color: priceRange === r ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {r === 'all' ? 'Todo' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats: High / Low / Vol / MCap ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'Máximo', value: formatPrice(high24h), color: 'var(--positivo)' },
          { label: 'Mínimo',  value: formatPrice(low24h),  color: 'var(--negativo)' },
          { label: 'Volumen', value: fmtLargeNum(volume),  color: 'var(--text-primary)' },
          { label: 'Mkt Cap', value: fmtLargeNum(mktCap),  color: 'var(--text-primary)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Gráfico de precio ── */}
      <div style={{ flex: 1, minHeight: '130px', marginTop: 'auto' }}>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`asset-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={priceColor} stopOpacity={0.30} />
                <stop offset="100%" stopColor={priceColor} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tickFormatter={xFormatter} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis hide domain={tightDomain(series.map(p => p.price))} />
            <Tooltip content={<PriceChartTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="price" stroke={priceColor} strokeWidth={2} fill={`url(#asset-grad-${symbol})`} activeDot={{ r: 4, fill: priceColor }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Barras de volumen ── */}
      <div style={{ height: '22px', marginTop: '3px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volumeSeries} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="vol" fill="var(--border-subtle)" radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Pie: disclaimer de datos simulados ── */}
      <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <FlaskConical size={10} />
        Precios simulados — no son cotizaciones reales
      </div>
    </div>
  );
}

// ─── AssetSummaryCard: mini-card de activo para "Resumen de Mercado" ─────────
function AssetSummaryCard({ symbol, name, type }: { symbol: string; name: string; type: Asset['type'] }) {
  const series = React.useMemo(
    () => generatePriceSeries(symbol, type, 24, 24),
    [symbol, type]
  );
  const first     = series[0]?.price ?? 0;
  const last      = series[series.length - 1]?.price ?? 0;
  const changePct = first !== 0 ? ((last - first) / first) * 100 : 0;
  const isUp      = changePct >= 0;
  const color     = isUp ? 'var(--positivo)' : 'var(--negativo)';

  return (
    <div className="card" style={{ padding: '20px' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>{name}</div>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {formatPrice(last)}
          </div>
        </div>
        <div style={{
          background: isUp ? 'var(--positivo-bg)' : 'var(--negativo-bg)',
          color,
          padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: '3px', height: 'fit-content',
        }}>
          {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>

      {/* Badge de tipo */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', gap: '6px' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{symbol}</span>
        <span style={{ background: 'var(--bg-elevated)', padding: '1px 7px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
          {type}
        </span>
      </div>

      {/* Sparkline */}
      <div style={{ height: '56px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`summary-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <YAxis hide domain={tightDomain(series.map(p => p.price))} />
            <Tooltip content={<PriceChartTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              fill={`url(#summary-grad-${symbol})`}
              activeDot={{ r: 3, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <FlaskConical size={9} /> Precio simulado
      </div>
    </div>
  );
}
