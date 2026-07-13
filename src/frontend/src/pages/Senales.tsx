/* ============================================================
 * Senales.tsx
 * Implementa RF-004, RF-005, RF-006, RF-007, RF-008,
 *            RF-010, RF-011 — HU-02, SRS §24.3
 * Vista de lista de señales y detalle individual con:
 *   - Impacto: Positivo/Negativo/Neutral/Incierto (color-coded)
 *   - Confianza 0-100
 *   - Evidencia y fuentes
 *   - Comparación histórica (mock cuando no hay datos reales)
 *   - Disclaimer fijo (RF-008, RNF-011)
 *   - Acciones: Revisada/Escalada/Descartada + comentario (RF-010, RF-011)
 * ============================================================ */
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Signal, SignalStatus, SignalImpact } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import {
  Zap, TrendingUp, TrendingDown, Minus, HelpCircle,
  CheckCircle, AlertTriangle, XCircle, Clock,
  FlaskConical, ChevronRight, ArrowLeft, BarChart2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ConfirmModal from '../components/ConfirmModal';

// ─── Mock signals data ────────────────────────────────────────
const MOCK_SIGNALS: Signal[] = [
  {
    id: 's1', news_id: 'mock-2', asset_id: 'a3',
    impact: 'Positivo', confidence: 85,
    explanation: 'La aprobación de ETFs spot de Bitcoin en Europa abre el acceso institucional a una base de inversores significativamente mayor. Históricamente, eventos similares (aprobación de ETFs en EE.UU.) resultaron en flujos de capital sostenidos hacia el activo durante 60–90 días. Los datos de flujo institucional señalan acumulación.',
    risks: 'Alta volatilidad histórica del activo; posible corrección tras la euforia inicial; riesgo regulatorio en otras jurisdicciones.',
    suggested_research: 'Analizar volumen de trading en ETFs spot europeos; revisar datos on-chain de wallets institucionales; comparar con flujos post-aprobación en EE.UU. (enero 2024).',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [68000, 69200, 70100, 71500, 72800, 74100, 75200],
      event_date: '2026-07-11',
      annotation: 'Aprobación ETFs Europa',
    },
    status: 'Pendiente', reviewed_by: null, review_comment: null,
    created_at: new Date(Date.now()-1*3600*1000).toISOString(),
    assets: { id:'a3', symbol:'BTC', name:'Bitcoin', type:'Cripto', sector:'Criptoactivos' },
    news: { id:'mock-2', title:'Bitcoin supera los $75,000 tras aprobación de nuevos ETFs spot en Europa', content:'', source:'Feed de prueba — NewsAPI Mock', published_at: new Date(Date.now()-5*3600*1000).toISOString(), sector:'Criptoactivos', is_test_data:true, created_at:new Date().toISOString() },
  },
  {
    id: 's2', news_id: 'mock-3', asset_id: 'a5',
    impact: 'Positivo', confidence: 78,
    explanation: 'Los resultados de Apple superan el consenso en ingresos (+4%) y márgenes operativos, impulsados por el crecimiento del iPhone en mercados emergentes. Este patrón de sorpresas positivas ha correlacionado históricamente con apreciación del precio en los 10 días siguientes.',
    risks: 'Saturación del mercado de smartphones premium; dependencia de la cadena de suministro en Asia; posible desaceleración en ciclos de actualización.',
    suggested_research: 'Comparar márgenes con competidores; revisar guía de gestión para próximo trimestre; analizar crecimiento de servicios (App Store, Apple TV+).',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [188, 190, 191, 193, 195, 196, 199],
      event_date: '2026-07-10',
      annotation: 'Reporte de ganancias Q3',
    },
    status: 'Revisada', reviewed_by: null, review_comment: null,
    created_at: new Date(Date.now()-5*3600*1000).toISOString(),
    assets: { id:'a5', symbol:'AAPL', name:'Apple Inc.', type:'Acción', sector:'Tecnología' },
    news: { id:'mock-3', title:'Apple reporta ganancias trimestrales superiores a las expectativas', content:'', source:'Feed de prueba — NewsAPI Mock', published_at: new Date(Date.now()-24*3600*1000).toISOString(), sector:'Tecnología', is_test_data:true, created_at:new Date().toISOString() },
  },
  {
    id: 's3', news_id: 'mock-5', asset_id: 'a7',
    impact: 'Negativo', confidence: 72,
    explanation: 'El aumento inesperado de inventarios de crudo en 4.2M de barriles versus la expectativa de reducción de 1.5M señala debilidad en la demanda o aumento de producción. Este tipo de dato EIA ha correlacionado con caídas del WTI entre 2% y 5% en el día de publicación.',
    risks: 'Posible reducción de producción por parte de la OPEP+ que revierta la tendencia; eventos geopolíticos que impulsen prima de riesgo; recuperación de demanda en Asia.',
    suggested_research: 'Revisar datos de demanda China; monitorear reunión OPEP+ de agosto; analizar tendencia de inventarios en las últimas 8 semanas.',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [82.1, 81.5, 80.8, 79.5, 79.0, 78.2, 75.8],
      event_date: '2026-07-11',
      annotation: 'Dato EIA inventarios',
    },
    status: 'Pendiente', reviewed_by: null, review_comment: null,
    created_at: new Date(Date.now()-6*3600*1000).toISOString(),
    assets: { id:'a7', symbol:'WTI', name:'Petróleo WTI', type:'Commodity', sector:'Energía' },
    news: { id:'mock-5', title:'Petróleo WTI cae 3% por datos de inventarios en EE.UU.', content:'', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: new Date(Date.now()-6*3600*1000).toISOString(), sector:'Energía', is_test_data:true, created_at:new Date().toISOString() },
  },
  {
    id: 's4', news_id: 'mock-4', asset_id: 'a6',
    impact: 'Positivo', confidence: 80,
    explanation: 'La confirmación de inversión de $2,000M en la Gigafactory de México amplía la capacidad productiva de Tesla para el mercado latinoamericano, reduce costos de manufactura y mejora márgenes. Los analistas estiman impacto positivo en EPS 2027.',
    risks: 'Posibles retrasos en construcción y permisos; riesgo cambiario USD/MXN; competencia creciente de fabricantes chinos de VE.',
    suggested_research: 'Analizar cronograma oficial de expansión; revisar el impacto en costos unitarios; comparar con la expansión en Berlín (2022).',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [220, 222, 225, 228, 230, 235, 244],
      event_date: '2026-07-11',
      annotation: 'Anuncio expansión México',
    },
    status: 'Escalada', reviewed_by: null, review_comment: null,
    created_at: new Date(Date.now()-3*3600*1000).toISOString(),
    assets: { id:'a6', symbol:'TSLA', name:'Tesla Inc.', type:'Acción', sector:'Automotriz' },
    news: { id:'mock-4', title:'Tesla anuncia expansión de planta en México; acciones suben 4%', content:'', source:'Feed de prueba — NewsAPI Mock', published_at: new Date(Date.now()-3*3600*1000).toISOString(), sector:'Automotriz', is_test_data:true, created_at:new Date().toISOString() },
  },
  {
    id: 's5', news_id: 'mock-10', asset_id: 'a14',
    impact: 'Positivo', confidence: 76,
    explanation: 'La combinación de un dólar débil (DXY -0.8%) y el aumento de tensiones geopolíticas en el Mar Rojo crea condiciones favorables para activos de refugio como el oro. Los ETFs respaldados en oro reportaron entradas netas significativas.',
    risks: 'Estabilización geopolítica súbita; fortalecimiento inesperado del dólar por dato económico; rotación hacia renta variable.',
    suggested_research: 'Monitorear evolución DXY; revisar posicionamiento de contratos futuros en COMEX; analizar entradas a ETFs (GLD, IAU).',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [2380, 2395, 2410, 2420, 2430, 2442, 2455],
      event_date: '2026-07-10',
      annotation: 'Tensiones Mar Rojo',
    },
    status: 'Pendiente', reviewed_by: null, review_comment: null,
    created_at: new Date(Date.now()-18*3600*1000).toISOString(),
    assets: { id:'a14', symbol:'GOLD', name:'Oro spot', type:'Commodity', sector:'Metales preciosos' },
    news: { id:'mock-10', title:'Oro alcanza $2,450 por onza ante debilidad del dólar y tensiones geopolíticas', content:'', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: new Date(Date.now()-18*3600*1000).toISOString(), sector:'Metales preciosos', is_test_data:true, created_at:new Date().toISOString() },
  },
  {
    id: 's6', news_id: 'mock-8', asset_id: 'a12',
    impact: 'Neutral', confidence: 61,
    explanation: 'La actualización Pectra mejora la eficiencia técnica de la red Ethereum, pero su impacto en precio a corto plazo es incierto. Mejoras de escalabilidad anteriores (Merge, Shanghai) tuvieron efectos mixtos en el precio inmediato.',
    risks: 'Adopción lenta de mejoras L2; competencia de otras cadenas (Solana, Base); incertidumbre regulatoria.',
    suggested_research: 'Analizar métricas de adopción en L2 (Arbitrum, Optimism, Base); revisar TVL (Total Value Locked) post-actualización; comparar con impacto de actualizaciones anteriores.',
    historical_comparison: {
      dates: ['2026-07-05','2026-07-06','2026-07-07','2026-07-08','2026-07-09','2026-07-10','2026-07-11'],
      prices: [3200, 3180, 3220, 3240, 3210, 3230, 3255],
      event_date: '2026-07-11',
      annotation: 'Actualización Pectra',
    },
    status: 'Descartada', reviewed_by: null, review_comment: 'Impacto no relevante para el portafolio actual.',
    created_at: new Date(Date.now()-12*3600*1000).toISOString(),
    assets: { id:'a12', symbol:'ETH', name:'Ethereum', type:'Cripto', sector:'Criptoactivos' },
    news: { id:'mock-8', title:'Ethereum completa actualización Pectra; desarrolladores anticipan mayor escalabilidad', content:'', source:'Feed de prueba — Yahoo Finance RSS Mock', published_at: new Date(Date.now()-12*3600*1000).toISOString(), sector:'Criptoactivos', is_test_data:true, created_at:new Date().toISOString() },
  },
];

const STATUS_ICONS: Record<SignalStatus, React.ReactNode> = {
  Pendiente:   <Clock       size={13} />,
  Revisada:    <CheckCircle size={13} />,
  Escalada:    <AlertTriangle size={13} />,
  Descartada:  <XCircle     size={13} />,
};

const STATUS_COLORS: Record<SignalStatus, string> = {
  Pendiente:  '#f59e0b',
  Revisada:   '#10b981',
  Escalada:   '#8b5cf6',
  Descartada: '#6b7280',
};

const IMPACT_COLOR: Record<SignalImpact, string> = {
  Positivo: 'var(--positivo)',
  Negativo: 'var(--negativo)',
  Neutral:  'var(--neutral)',
  Incierto: 'var(--incierto)',
};

// ─── Componente principal ─────────────────────────────────────
export default function Senales() {
  const { roleName } = useAuth();
  const [signals, setSignals]   = useState<Signal[]>(MOCK_SIGNALS);
  const [loading, setLoading]   = useState(false);
  const [usingMock, setUsingMock] = useState(true);
  const [selected, setSelected] = useState<Signal | null>(null);
  const [filterStatus, setFilterStatus] = useState<SignalStatus | ''>('');
  const [filterImpact, setFilterImpact] = useState<SignalImpact | ''>('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('signals')
        .select('*, assets(*), news(*)')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setSignals(data as Signal[]);
        setUsingMock(false);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = signals.filter(s => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterImpact && s.impact !== filterImpact) return false;
    return true;
  });

  const canReview = roleName && ['Administrador','Analista','Supervisor'].includes(roleName);

  if (selected) {
    return (
      <SignalDetail
        signal={selected}
        canReview={!!canReview}
        onBack={() => setSelected(null)}
        onUpdate={updated => {
          setSignals(prev => prev.map(s => s.id === updated.id ? updated : s));
          setSelected(updated);
        }}
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <Zap size={24} style={{ color:'var(--accent-light)' }} />
            Señales de Impacto
          </h1>
          <p className="page-subtitle">Señales explicables generadas por el Agente IA (Asesor Financiero)</p>
        </div>
        {usingMock && (
          <div className="chip chip-test-data" style={{ padding:'6px 12px' }}>
            <FlaskConical size={12} /> Datos de prueba
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom:'20px' }}>
        <div className="filter-bar">
          <select id="filter-signal-impact" className="filter-select" value={filterImpact}
            onChange={e => setFilterImpact(e.target.value as SignalImpact | '')}>
            <option value="">Todos los impactos</option>
            {(['Positivo','Negativo','Neutral','Incierto'] as SignalImpact[]).map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <select id="filter-signal-status" className="filter-select" value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as SignalStatus | '')}>
            <option value="">Todos los estados</option>
            {(['Pendiente','Revisada','Escalada','Descartada'] as SignalStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {[...Array(4)].map((_,i) => <div key={i} className="skeleton" style={{ height:'80px', borderRadius:'var(--radius-lg)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><Zap size={36} /><h3>Sin señales</h3><p>No hay señales con estos filtros.</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtered.map(signal => (
            <div key={signal.id} className="news-card" onClick={() => setSelected(signal)}
              role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(signal)}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                {/* Impacto badge */}
                <span className={`impact-badge impact-${signal.impact}`} style={{ flexShrink:0, fontSize:'12px' }}>
                  {signal.impact === 'Positivo' ? <TrendingUp size={13} /> :
                   signal.impact === 'Negativo' ? <TrendingDown size={13} /> :
                   signal.impact === 'Neutral'  ? <Minus size={13} /> :
                   <HelpCircle size={13} />}
                  {signal.impact}
                </span>

                {/* Asset */}
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
                    {signal.assets?.symbol}
                    <span style={{ fontWeight:400, fontSize:'12px', color:'var(--text-muted)' }}>{signal.assets?.name}</span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {signal.explanation}
                  </div>
                </div>

                {/* Confianza */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'16px', color: IMPACT_COLOR[signal.impact] }}>
                    {signal.confidence}%
                  </div>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)' }}>confianza</div>
                </div>

                {/* Status */}
                <div style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11.5px', fontWeight:600, color: STATUS_COLORS[signal.status], flexShrink:0 }}>
                  {STATUS_ICONS[signal.status]}
                  {signal.status}
                </div>

                <ChevronRight size={15} style={{ color:'var(--text-muted)', flexShrink:0 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Detalle de señal (SRS §24.3) ────────────────────────────
function SignalDetail({ signal, canReview, onBack, onUpdate }: {
  signal: Signal;
  canReview: boolean;
  onBack: () => void;
  onUpdate: (s: Signal) => void;
}) {
  const { user } = useAuth();
  const [newStatus, setNewStatus]   = useState<SignalStatus>(signal.status);
  const [comment, setComment]       = useState(signal.review_comment ?? '');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);

  const confidenceClass =
    signal.confidence >= 70 ? 'confidence-high' :
    signal.confidence >= 40 ? 'confidence-medium' :
    'confidence-low';

  function handleSaveReview() {
    if (!comment.trim()) { setSaveError('La justificación es obligatoria (RN-04).'); return; }
    setConfirmSave(true);
  }

  async function executeSaveReview() {
    setConfirmSave(false);
    setSaving(true);
    setSaveError(null);

    // Guardar en Supabase (con audit_log vía service_role en producción)
    const { data, error } = await supabase
      .from('signals')
      .update({
        status: newStatus,
        reviewed_by: user?.id,
        review_comment: comment,
      })
      .eq('id', signal.id)
      .select('*, assets(*), news(*)')
      .single();

    if (error) {
      // En modo demo (mock), actualizar localmente
      const updated: Signal = { ...signal, status: newStatus, review_comment: comment };
      onUpdate(updated);
      setSaving(false);
      return;
    }

    onUpdate(data as Signal);
    setSaving(false);
  }

  // Datos del gráfico histórico
  const chartData = signal.historical_comparison?.dates?.map((d, i) => ({
    date: d,
    precio: signal.historical_comparison!.prices[i],
    event: d === signal.historical_comparison?.event_date ? signal.historical_comparison.annotation : undefined,
  })) ?? [];

  return (
    <div>
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom:'16px' }}>
        <ArrowLeft size={14} /> Volver a señales
      </button>

      {/* Encabezado (SRS §24.3) */}
      <div className="signal-detail-header">
        <div>
          <div className="signal-asset-name">
            {signal.assets?.symbol}
            <span style={{ fontWeight:400, fontSize:'14px', color:'var(--text-muted)', marginLeft:'10px' }}>
              {signal.assets?.name} · {signal.assets?.type}
            </span>
          </div>
        </div>
        <span className={`impact-badge impact-${signal.impact}`} style={{ fontSize:'16px', padding:'8px 16px' }}>
          {signal.impact === 'Positivo' ? <TrendingUp size={16} /> :
           signal.impact === 'Negativo' ? <TrendingDown size={16} /> :
           signal.impact === 'Neutral'  ? <Minus size={16} /> :
           <HelpCircle size={16} />}
          {signal.impact}
        </span>
      </div>

      {/* Medidor de confianza (RF-005) */}
      <div className="signal-section">
        <div className="signal-section-title">Nivel de Confianza (RF-005)</div>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div className="confidence-bar-container" style={{ flex:1 }}>
            <div
              className={`confidence-bar ${confidenceClass}`}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
          <div style={{ fontWeight:800, fontSize:'22px', minWidth:'48px', textAlign:'right',
            color: signal.confidence >= 70 ? 'var(--positivo)' : signal.confidence >= 40 ? 'var(--incierto)' : 'var(--negativo)' }}>
            {signal.confidence}%
          </div>
        </div>
      </div>

      {/* Explicación y evidencia (RF-007) */}
      <div className="signal-section">
        <div className="signal-section-title">Explicación y Evidencia (RF-007)</div>
        <p style={{ fontSize:'14px', lineHeight:'1.7', color:'var(--text-secondary)' }}>
          {signal.explanation}
        </p>
        {signal.news && (
          <div style={{ marginTop:'12px', padding:'10px 14px', background:'var(--bg-hover)', borderRadius:'var(--radius)', borderLeft:'3px solid var(--accent)' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>
              Fuente de la noticia
            </div>
            <div style={{ fontSize:'13px', fontWeight:600 }}>{signal.news.title}</div>
            <div style={{ fontSize:'11.5px', color:'var(--accent-light)', marginTop:'3px' }}>
              {signal.news.source} · {formatDistanceToNow(parseISO(signal.news.published_at), { addSuffix:true, locale:es })}
            </div>
          </div>
        )}
      </div>

      {/* Riesgos */}
      {signal.risks && (
        <div className="signal-section">
          <div className="signal-section-title">Riesgos identificados</div>
          <p style={{ fontSize:'14px', lineHeight:'1.6', color:'var(--text-secondary)' }}>
            {signal.risks}
          </p>
        </div>
      )}

      {/* Investigación sugerida */}
      {signal.suggested_research && (
        <div className="signal-section">
          <div className="signal-section-title">Investigación adicional sugerida</div>
          <p style={{ fontSize:'14px', lineHeight:'1.6', color:'var(--text-secondary)' }}>
            {signal.suggested_research}
          </p>
        </div>
      )}

      {/* Comparación histórica (RF-006) */}
      {chartData.length > 0 && (
        <div className="signal-section">
          <div className="signal-section-title" style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <BarChart2 size={13} /> Comparación histórica de precio (RF-006)
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize:11, fill:'var(--text-muted)' }} tickLine={false} axisLine={false} width={60} />
              <Tooltip
                contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, fontSize:12 }}
                labelStyle={{ color:'var(--text-muted)' }}
                itemStyle={{ color:'var(--accent-light)' }}
              />
              {signal.historical_comparison?.event_date && (
                <ReferenceLine x={signal.historical_comparison.event_date} stroke="var(--incierto)" strokeDasharray="4 4"
                  label={{ value: '●', fill:'var(--incierto)', fontSize:10 }} />
              )}
              <Line type="monotone" dataKey="precio" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r:4 }} />
            </LineChart>
          </ResponsiveContainer>
          {signal.historical_comparison?.annotation && (
            <div style={{ fontSize:'11.5px', color:'var(--incierto)', marginTop:'6px', display:'flex', gap:'5px', alignItems:'center' }}>
              <span>●</span> {signal.historical_comparison.annotation}
            </div>
          )}
          {signal.news?.is_test_data && (
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>
              * Datos históricos simulados (is_test_data = true) — RN-08
            </div>
          )}
        </div>
      )}

      {/* Revisión humana (RF-010, RF-011) */}
      {canReview && (
        <div className="signal-section">
          <div className="signal-section-title">Revisión del analista (RF-010, RF-011)</div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
            {(['Revisada','Escalada','Descartada'] as SignalStatus[]).map(s => (
              <button
                key={s}
                id={`signal-status-${s.toLowerCase()}`}
                className={`btn ${newStatus === s ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setNewStatus(s)}
                style={{ gap:'6px' }}
              >
                {STATUS_ICONS[s]} {s}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="review-comment">
              Justificación / Comentario <span style={{ color:'var(--negativo)' }}>*</span> (RN-04)
            </label>
            <textarea
              id="review-comment"
              className="form-textarea"
              placeholder="Describe el razonamiento de tu revisión (obligatorio según RN-04)..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
            />
          </div>
          {saveError && (
            <div style={{ color:'var(--negativo)', fontSize:'12.5px', marginTop:'8px', display:'flex', gap:'5px', alignItems:'center' }}>
              <AlertTriangle size={13} /> {saveError}
            </div>
          )}
          <button
            id="save-review"
            className="btn btn-primary"
            onClick={handleSaveReview}
            disabled={saving}
            style={{ marginTop:'12px' }}
          >
            {saving ? <><span className="spinner" style={{ width:14, height:14 }} /> Guardando…</> : (
              <><CheckCircle size={14} /> Guardar revisión</>
            )}
          </button>
        </div>
      )}

      {/* Estado actual de la señal */}
      {signal.status !== 'Pendiente' && (
        <div className="signal-section" style={{ borderLeft:`3px solid ${STATUS_COLORS[signal.status]}` }}>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', fontWeight:600, color: STATUS_COLORS[signal.status], marginBottom:'4px' }}>
            {STATUS_ICONS[signal.status]} {signal.status}
          </div>
          {signal.review_comment && (
            <p style={{ fontSize:'13.5px', color:'var(--text-secondary)', lineHeight:'1.6' }}>
              {signal.review_comment}
            </p>
          )}
        </div>
      )}

      {/* Disclaimer fijo (RF-008, RNF-011) */}
      <div className="disclaimer" style={{ marginTop:'16px' }}>
        <AlertTriangle size={14} />
        <span>
          <strong>Aviso legal:</strong> Esta señal no constituye asesoría financiera personalizada
          ni garantiza rendimientos. Es una propuesta generada por IA para apoyo al análisis humano.
          El sistema no ejecuta ni puede ejecutar operaciones financieras automáticas. (RN-01, RF-008)
        </span>
      </div>

      <ConfirmModal
        isOpen={confirmSave}
        title="Confirmar revisión de señal"
        message={`¿Confirmas guardar esta señal (${signal.assets?.symbol}) como "${newStatus}"?`}
        confirmText="Guardar revisión"
        isDestructive={newStatus === 'Descartada'}
        onConfirm={executeSaveReview}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}
