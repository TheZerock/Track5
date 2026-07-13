/* ============================================================
 * Activos.tsx
 * Listado de activos monitoreados. Los precios vienen de la Edge
 * Function `fetch-market-prices` (Alpha Vantage / CoinGecko según
 * el tipo de instrumento — ver supabase/functions/fetch-market-prices).
 * Si esa función falla, no está desplegada, o un activo puntual no
 * tiene fuente real disponible, se usa un precio simulado de
 * respaldo (RNF-009) y se marca explícitamente con `is_test_data`.
 * ============================================================ */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Asset, AssetType } from '../types/database';
import { generatePriceSeries, formatPrice, type PricePoint } from '../lib/mockPrices';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart as LineChartIcon, Search, TrendingUp, TrendingDown,
  AlertTriangle, X, FlaskConical, Radio,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─── Precio real devuelto por la Edge Function fetch-market-prices ──
export interface RealPrice {
  asset_id: string;
  symbol: string;
  price: number;
  change_pct: number;
  sparkline_data: number[];
  is_test_data: boolean;
  source: string;
}

const MOCK_ASSETS: Asset[] = [
  { id: 'a1',  symbol: 'AAPL',   name: 'Apple Inc.',                    type: 'Acción',    sector: 'Tecnología' },
  { id: 'a2',  symbol: 'MSFT',   name: 'Microsoft Corporation',         type: 'Acción',    sector: 'Tecnología' },
  { id: 'a3',  symbol: 'GOOGL',  name: 'Alphabet Inc.',                 type: 'Acción',    sector: 'Tecnología' },
  { id: 'a4',  symbol: 'AMZN',   name: 'Amazon.com Inc.',               type: 'Acción',    sector: 'Consumo' },
  { id: 'a5',  symbol: 'TSLA',   name: 'Tesla Inc.',                    type: 'Acción',    sector: 'Automotriz' },
  { id: 'a6',  symbol: 'JPM',    name: 'JPMorgan Chase & Co.',          type: 'Acción',    sector: 'Financiero' },
  { id: 'a7',  symbol: 'XOM',    name: 'Exxon Mobil Corporation',       type: 'Acción',    sector: 'Energía' },
  { id: 'a8',  symbol: 'BTC',    name: 'Bitcoin',                       type: 'Cripto',    sector: 'Criptoactivos' },
  { id: 'a9',  symbol: 'ETH',    name: 'Ethereum',                      type: 'Cripto',    sector: 'Criptoactivos' },
  { id: 'a10', symbol: 'SOL',    name: 'Solana',                        type: 'Cripto',    sector: 'Criptoactivos' },
  { id: 'a11', symbol: 'SPY',    name: 'SPDR S&P 500 ETF Trust',        type: 'ETF',       sector: 'Índices' },
  { id: 'a12', symbol: 'QQQ',    name: 'Invesco QQQ Trust',             type: 'ETF',       sector: 'Tecnología' },
  { id: 'a13', symbol: 'GLD',    name: 'SPDR Gold Shares',              type: 'ETF',       sector: 'Commodities' },
  { id: 'a14', symbol: 'GOLD',   name: 'Oro spot',                      type: 'Commodity', sector: 'Metales preciosos' },
  { id: 'a15', symbol: 'WTI',    name: 'Petróleo crudo WTI',            type: 'Commodity', sector: 'Energía' },
  { id: 'a16', symbol: 'EURUSD', name: 'Euro / Dólar estadounidense',   type: 'Divisa',    sector: 'Forex' },
  { id: 'a17', symbol: 'USDMXN', name: 'Dólar / Peso mexicano',         type: 'Divisa',    sector: 'Forex' },
  { id: 'a18', symbol: 'TLT',    name: 'iShares 20+ Year T-Bond ETF',   type: 'Bono',       sector: 'Deuda pública' },
];

const INSTRUMENT_TYPES: AssetType[] = ['Acción', 'Cripto', 'ETF', 'Bono', 'Commodity', 'Divisa', 'Otro'];

// Eje Y ajustado al rango real de precios (no arranca en 0) — esto es lo
// que amplifica visualmente el movimiento intradía, igual que hacen
// Google Finance / Yahoo Finance en sus gráficos.
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

function PriceTooltip({ active, payload, label }: any) {
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

export default function Activos() {
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('');
  const [selected, setSelected] = useState<Asset | null>(null);
  const [realPrices, setRealPrices] = useState<Record<string, RealPrice>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesUnavailable, setPricesUnavailable] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('assets').select('*').order('symbol');
      if (!error && data && data.length > 0) setAssets(data as Asset[]);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadRealPrices() {
      if (assets.length === 0) return;
      setPricesLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-market-prices', {
        body: { asset_ids: assets.map(a => a.id) },
      });

      if (error || !data?.data) {
        // La Edge Function no está desplegada, falló, o no hay conexión —
        // nos quedamos con los precios simulados (RNF-009).
        setPricesUnavailable(true);
        setPricesLoading(false);
        return;
      }

      const map: Record<string, RealPrice> = {};
      (data.data as RealPrice[]).forEach(p => { map[p.asset_id] = p; });
      setRealPrices(map);
      setPricesUnavailable(false);
      setPricesLoading(false);
    }
    loadRealPrices();
  }, [assets]);

  const anyRealPrice = Object.values(realPrices).some(p => !p.is_test_data);

  const filtered = assets.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!a.symbol.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LineChartIcon size={24} style={{ color: 'var(--accent-light)' }} />
            Activos
          </h1>
          <p className="page-subtitle">Instrumentos financieros monitoreados por el sistema</p>
        </div>
        {anyRealPrice ? (
          <div className="chip chip-sector" style={{ padding: '6px 12px' }}>
            <Radio size={12} /> Precios en tiempo real (Alpha Vantage / CoinGecko)
          </div>
        ) : (
          <div className="chip chip-test-data" style={{ padding: '6px 12px' }}>
            <FlaskConical size={12} /> {pricesLoading ? 'Cargando precios…' : 'Precios simulados — no son cotizaciones reales'}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="filter-bar">
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="filter-select"
              placeholder="Buscar por símbolo o nombre…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px' }}
              aria-label="Buscar activos"
            />
          </div>
          <select
            className="filter-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as AssetType | '')}
            aria-label="Filtrar por tipo de instrumento"
          >
            <option value="">Todos los instrumentos</option>
            {INSTRUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Grid de activos */}
      <div className="assets-grid">
        {filtered.map(asset => (
          <AssetCard key={asset.id} asset={asset} real={realPrices[asset.id]} onClick={() => setSelected(asset)} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <Search size={32} />
          <h3>Sin resultados</h3>
          <p>No hay activos que coincidan con la búsqueda.</p>
        </div>
      )}

      {selected && (
        <AssetDetailModal asset={selected} real={realPrices[selected.id]} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Tarjeta cuadrada de activo con mini-gráfica ───────────────
function AssetCard({ asset, real, onClick }: { asset: Asset; real?: RealPrice; onClick: () => void }) {
  const mockSeries = useMemo(() => generatePriceSeries(asset.symbol, asset.type, 24, 24), [asset.symbol, asset.type]);
  const mockChartData = mockSeries.map(p => ({ price: p.price, label: format(parseISO(p.time), 'HH:mm') }));

  const isLive = !!real && !real.is_test_data;
  // Solo usamos la serie del servidor si es un precio real de verdad —
  // el fallback del servidor es un array plano (mismo valor repetido) y
  // se ve mejor con la curva simulada local que con una línea recta.
  const hasRealChart = isLive && real!.sparkline_data.length >= 3;

  const chartData = hasRealChart
    ? real!.sparkline_data.map((price, i) => ({ price, label: String(i) }))
    : mockChartData;

  const last = real ? real.price : mockSeries[mockSeries.length - 1].price;
  const changePct = real ? real.change_pct : (() => {
    const first = mockSeries[0].price;
    return ((last - first) / first) * 100;
  })();
  const isUp = changePct >= 0;

  return (
    <div
      className="asset-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Ver detalle de ${asset.symbol}`}
    >
      {/* Encabezado: ticker + badge de tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{asset.symbol}</span>
        <span className="chip chip-sector" style={{ fontSize: '9px', padding: '2px 6px' }}>{asset.type}</span>
        {isLive && (
          <span title={`Fuente: ${real!.source}`} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--positivo)', flexShrink: 0 }} />
        )}
      </div>

      {/* Nombre completo */}
      <div style={{
        fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {asset.name}
      </div>

      {/* Mini gráfica con tooltip de precio */}
      <div style={{ flex: 1, minHeight: '48px', margin: '6px 0' }} onClick={e => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`asset-grad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={tightDomain(chartData.map(p => p.price))} />
            <Tooltip content={<PriceTooltip />} cursor={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="price" stroke={isUp ? 'var(--positivo)' : 'var(--negativo)'} strokeWidth={2} fill={`url(#asset-grad-${asset.id})`} activeDot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Precio y variación */}
      <div>
        <div style={{ fontSize: '17px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(last)}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11.5px', fontWeight: 600,
          color: isUp ? 'var(--positivo)' : 'var(--negativo)',
        }}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

// ─── Detalle grande de un activo ───────────────────────────────
type RangeKey = '24h' | '7d' | '30d' | '90d' | 'all';
const RANGE_CONFIG: Record<RangeKey, { points: number; hoursSpan: number; labelFmt: string; title: string }> = {
  '24h': { points: 24, hoursSpan: 24,    labelFmt: 'HH:mm',     title: 'Últimas 24 horas' },
  '7d':  { points: 42, hoursSpan: 168,   labelFmt: 'EEE HH:mm', title: 'Últimos 7 días' },
  '30d': { points: 30, hoursSpan: 720,   labelFmt: 'd MMM',     title: 'Últimos 30 días' },
  '90d': { points: 45, hoursSpan: 2160,  labelFmt: 'd MMM',     title: 'Últimos 90 días' },
  'all': { points: 60, hoursSpan: 4320,  labelFmt: 'd MMM',     title: 'Todo el historial' },
};

function AssetDetailModal({ asset, real, onClose }: { asset: Asset; real?: RealPrice; onClose: () => void }) {
  const [range, setRange] = useState<RangeKey>('24h');
  const cfg = RANGE_CONFIG[range];

  const isLive = !!real && !real.is_test_data;
  // Solo usamos la serie real en la vista 24h y cuando trae suficientes puntos
  // para dibujar una curva (Alpha Vantage GLOBAL_QUOTE de acciones solo da 1
  // punto; ahí seguimos usando la curva simulada, pero con precio/% reales).
  const useRealSeries = range === '24h' && isLive && real!.sparkline_data.length >= 3;

  const mockSeries: (PricePoint & { label: string })[] = useMemo(() => {
    const raw = generatePriceSeries(asset.symbol, asset.type, cfg.points, cfg.hoursSpan);
    return raw.map(p => ({ ...p, label: format(parseISO(p.time), cfg.labelFmt, { locale: es }) }));
  }, [asset.symbol, asset.type, range]);

  const series = useRealSeries
    ? real!.sparkline_data.map((price, i) => ({ price, time: '', label: String(i) }))
    : mockSeries;

  const last = range === '24h' && isLive ? real!.price : series[series.length - 1].price;
  const changePct = range === '24h' && isLive
    ? real!.change_pct
    : ((series[series.length - 1].price - series[0].price) / series[0].price) * 100;
  const isUp = changePct >= 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '640px' }} role="dialog" aria-modal="true" aria-label={`Detalle de ${asset.symbol}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{asset.symbol}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{asset.name} · {asset.type}{asset.sector ? ` · ${asset.sector}` : ''}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(last)}</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700,
            padding: '3px 9px', borderRadius: '20px',
            background: isUp ? 'var(--positivo-bg)' : 'var(--negativo-bg)',
            color: isUp ? 'var(--positivo)' : 'var(--negativo)',
          }}>
            {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px' }}>
            {(['24h', '7d', '30d', '90d', 'all'] as RangeKey[]).map(r => (
              <button
                key={r}
                className="range-pill-btn"
                onClick={() => setRange(r)}
                style={{
                  background: range === r ? 'var(--bg-surface)' : 'transparent',
                  color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {r === 'all' ? 'Todo' : r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '220px', marginBottom: '4px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="asset-detail-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={isUp ? 'var(--positivo)' : 'var(--negativo)'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={54}
                domain={tightDomain(series.map(p => p.price))}
                tickFormatter={v => formatPrice(v)}
              />
              <Tooltip content={<PriceTooltip />} cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="price" stroke={isUp ? 'var(--positivo)' : 'var(--negativo)'} strokeWidth={1.5} fill="url(#asset-detail-grad)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--bg-surface)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tira de volumen (apoyo visual, misma serie) */}
        <div style={{ height: '22px', marginBottom: '6px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="price" fill="var(--border-subtle)" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>{RANGE_CONFIG[range].title}</div>

        <div className="disclaimer">
          <AlertTriangle size={13} />
          <span>
            {range === '24h' && isLive ? (
              <>Precio y variación de <strong>{real!.source}</strong> — no constituye asesoría financiera ni garantiza resultados.</>
            ) : (
              <>Esta vista es <strong>simulada</strong> con fines demostrativos — no proviene de ninguna
              fuente de mercado real ni debe usarse para decisiones de inversión.</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
