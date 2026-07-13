/* ============================================================
 * Briefings.tsx
 * Implementa RF-009, RF-010, RF-011, RF-012, RF-020 — HU-03
 * SRS §21, §24.4
 * Estados exactos: Borrador / En revisión / Aprobado / Escalado
 * Restricción dura RN-01: ninguna acción ejecuta compra/venta
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Briefing, BriefingStatus, Signal, SignalStatus } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, ArrowLeft, CheckCircle, AlertTriangle, XCircle,
  Clock, ChevronRight, Zap, FlaskConical, TrendingUp,
  TrendingDown, Minus, HelpCircle, Plus, Send,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import ConfirmModal from '../components/ConfirmModal';

// ─── Mock data ────────────────────────────────────────────────
const MOCK_SIGNALS_FOR_BRIEFING: Signal[] = [
  { id:'s1', news_id:'mock-2', asset_id:'a3', impact:'Positivo', confidence:85, explanation:'Aprobación de ETFs spot impulsa demanda institucional.', risks:'Volatilidad', suggested_research:'Analizar volumen institucional', historical_comparison:null, status:'Pendiente', reviewed_by:null, review_comment:null, created_at:new Date(Date.now()-1*3600*1000).toISOString(), assets:{id:'a3',symbol:'BTC',name:'Bitcoin',type:'Cripto',sector:'Criptoactivos'}, news:{id:'mock-2',title:'Bitcoin supera los $75,000 tras aprobación de nuevos ETFs spot en Europa',content:'',source:'Feed de prueba — NewsAPI Mock',published_at:new Date(Date.now()-5*3600*1000).toISOString(),sector:'Criptoactivos',is_test_data:true,created_at:new Date().toISOString()} },
  { id:'s3', news_id:'mock-5', asset_id:'a7', impact:'Negativo', confidence:72, explanation:'Aumento inesperado de inventarios deprime precio del WTI.', risks:'Desaceleración global', suggested_research:'Revisar datos de demanda OPEP+', historical_comparison:null, status:'Pendiente', reviewed_by:null, review_comment:null, created_at:new Date(Date.now()-6*3600*1000).toISOString(), assets:{id:'a7',symbol:'WTI',name:'Petróleo WTI',type:'Commodity',sector:'Energía'}, news:{id:'mock-5',title:'Petróleo WTI cae 3% por datos de inventarios en EE.UU.',content:'',source:'Feed de prueba — Yahoo Finance RSS Mock',published_at:new Date(Date.now()-6*3600*1000).toISOString(),sector:'Energía',is_test_data:true,created_at:new Date().toISOString()} },
  { id:'s4', news_id:'mock-4', asset_id:'a6', impact:'Positivo', confidence:80, explanation:'Inversión en planta amplía capacidad productiva de Tesla.', risks:'Retrasos en construcción', suggested_research:'Analizar cronograma de expansión', historical_comparison:null, status:'Escalada', reviewed_by:null, review_comment:null, created_at:new Date(Date.now()-3*3600*1000).toISOString(), assets:{id:'a6',symbol:'TSLA',name:'Tesla Inc.',type:'Acción',sector:'Automotriz'}, news:{id:'mock-4',title:'Tesla anuncia expansión de planta en México',content:'',source:'Feed de prueba — NewsAPI Mock',published_at:new Date(Date.now()-3*3600*1000).toISOString(),sector:'Automotriz',is_test_data:true,created_at:new Date().toISOString()} },
];

const MOCK_BRIEFINGS: (Briefing & { signals?: Signal[] })[] = [
  {
    id: 'b1', title: 'Briefing Portafolio Tecnología y Criptoactivos — 11 Jul 2026',
    watchlist_id: null, asset_id: null,
    status: 'En revisión', created_by: 'user-1', approved_by: null,
    created_at: new Date(Date.now()-2*3600*1000).toISOString(),
    signals: [MOCK_SIGNALS_FOR_BRIEFING[0], MOCK_SIGNALS_FOR_BRIEFING[2]],
  },
  {
    id: 'b2', title: 'Briefing Commodities — Energía y Metales — 10 Jul 2026',
    watchlist_id: null, asset_id: 'a7',
    status: 'Borrador', created_by: 'user-1', approved_by: null,
    created_at: new Date(Date.now()-24*3600*1000).toISOString(),
    signals: [MOCK_SIGNALS_FOR_BRIEFING[1]],
  },
  {
    id: 'b3', title: 'Briefing Mercados Globales — 9 Jul 2026',
    watchlist_id: null, asset_id: null,
    status: 'Aprobado', created_by: 'user-1', approved_by: 'user-2',
    created_at: new Date(Date.now()-48*3600*1000).toISOString(),
    signals: [],
  },
];

const STATUS_CONFIG: Record<BriefingStatus, { color: string; label: string; icon: React.ReactNode }> = {
  'Borrador':     { color:'var(--borrador)',    label:'Borrador',     icon:<Clock size={13} /> },
  'En revisión':  { color:'var(--en-revision)', label:'En revisión',  icon:<AlertTriangle size={13} /> },
  'Aprobado':     { color:'var(--aprobado)',    label:'Aprobado',     icon:<CheckCircle size={13} /> },
  'Escalado':     { color:'var(--escalado)',    label:'Escalado',     icon:<Send size={13} /> },
};

const SIGNAL_STATUS_ICONS: Record<SignalStatus, React.ReactNode> = {
  Pendiente:  <Clock size={12} />,
  Revisada:   <CheckCircle size={12} />,
  Escalada:   <AlertTriangle size={12} />,
  Descartada: <XCircle size={12} />,
};

// ─── Componente principal ─────────────────────────────────────
export default function Briefings() {
  const { roleName, user } = useAuth();
  const [briefings, setBriefings] = useState<(Briefing & { signals?: Signal[] })[]>(MOCK_BRIEFINGS);
  const [usingMock, setUsingMock] = useState(true);
  const [selected, setSelected]   = useState<(Briefing & { signals?: Signal[] }) | null>(null);
  const [creating, setCreating]   = useState(false);

  const canApprove = roleName && ['Administrador','Supervisor'].includes(roleName);
  const canCreate  = roleName && ['Administrador','Analista','Supervisor'].includes(roleName);

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('briefings')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setBriefings(data as Briefing[]);
        setUsingMock(false);
      }
    }
    if (roleName !== undefined) {
      load();
    }
  }, [user?.id, roleName]);

  if (selected) {
    return (
      <BriefingDetail
        briefing={selected}
        canApprove={!!canApprove}
        onBack={() => setSelected(null)}
        onUpdate={updated => {
          setBriefings(prev => prev.map(b => b.id === updated.id ? updated : b));
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
            <FileText size={24} style={{ color:'var(--accent-light)' }} />
            Briefings de Mercado
          </h1>
          <p className="page-subtitle">Resúmenes consolidados de señales para revisión humana (HU-03)</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {usingMock && (
            <div className="chip chip-test-data" style={{ padding:'6px 12px' }}>
              <FlaskConical size={12} /> Datos de prueba
            </div>
          )}
          {canCreate && (
            <button id="create-briefing" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Nuevo briefing
            </button>
          )}
        </div>
      </div>

      {/* Lista de briefings */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {briefings.map(b => {
          const cfg = STATUS_CONFIG[b.status];
          return (
            <div key={b.id} className="news-card" onClick={() => setSelected(b)}
              role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(b)}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{
                  width:38, height:38, borderRadius:'10px',
                  background:`${cfg.color}18`, border:`1px solid ${cfg.color}40`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: cfg.color, flexShrink:0,
                }}>
                  {cfg.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'14px' }}>{b.title}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <span>{formatDistanceToNow(parseISO(b.created_at), { addSuffix:true, locale:es })}</span>
                    {b.signals && <span>· {b.signals.length} señal{b.signals.length !== 1 ? 'es' : ''}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px', fontWeight:700, fontSize:'12px', color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </div>
                <ChevronRight size={15} style={{ color:'var(--text-muted)' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal crear briefing */}
      {creating && (
        <CreateBriefingModal
          signals={MOCK_SIGNALS_FOR_BRIEFING}
          onClose={() => setCreating(false)}
          onCreate={(nb) => {
            setBriefings(prev => [nb, ...prev]);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Detalle de briefing (SRS §24.4) ─────────────────────────
function BriefingDetail({ briefing, canApprove, onBack, onUpdate }: {
  briefing: Briefing & { signals?: Signal[] };
  canApprove: boolean;
  onBack: () => void;
  onUpdate: (b: Briefing & { signals?: Signal[] }) => void;
}) {
  const { roleName } = useAuth();
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<BriefingStatus | null>(null);
  const cfg = STATUS_CONFIG[briefing.status];

  const canSendToReview = roleName && ['Administrador','Analista','Supervisor'].includes(roleName)
    && briefing.status === 'Borrador';

  const STATUS_CONFIRM_TEXT: Record<BriefingStatus, string> = {
    'Borrador': 'Guardar como borrador',
    'En revisión': 'Enviar a revisión',
    'Aprobado': 'Aprobar briefing',
    'Escalado': 'Devolver / escalar',
  };

  async function handleStatusChange(newStatus: BriefingStatus) {
    setConfirmStatus(null);
    setSaving(true);
    const { data, error } = await supabase
      .from('briefings')
      .update({ status: newStatus })
      .eq('id', briefing.id)
      .select()
      .single();

    if (error) {
      // Modo demo: actualizar localmente
      onUpdate({ ...briefing, status: newStatus });
    } else {
      onUpdate({ ...data as Briefing, signals: briefing.signals });
    }
    setSaving(false);
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom:'16px' }}>
        <ArrowLeft size={14} /> Volver a briefings
      </button>

      {/* Header (SRS §24.4) */}
      <div className="page-header">
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:'20px', fontWeight:800, marginBottom:'6px' }}>{briefing.title}</h1>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ display:'flex', alignItems:'center', gap:'5px', fontWeight:700, fontSize:'13px', color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
            <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>
              Creado {formatDistanceToNow(parseISO(briefing.created_at), { addSuffix:true, locale:es })}
            </span>
          </div>
        </div>
      </div>

      {/* Señales incluidas (RF-009, RF-010) */}
      {(briefing.signals ?? []).length > 0 && (
        <div className="card" style={{ marginBottom:'20px' }}>
          <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'8px' }}>
            <Zap size={15} style={{ color:'var(--accent-light)' }} />
            Señales incluidas en este briefing
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {(briefing.signals ?? []).map(signal => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </div>
        </div>
      )}

      {/* Restricción RN-01 — recordatorio explícito */}
      <div className="card" style={{ marginBottom:'20px', borderLeft:'3px solid var(--incierto)' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
          <AlertTriangle size={16} style={{ color:'var(--incierto)', flexShrink:0, marginTop:'2px' }} />
          <div>
            <div style={{ fontWeight:700, fontSize:'13px', color:'var(--incierto)', marginBottom:'4px' }}>
              Restricción RN-01 activa
            </div>
            <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.6' }}>
              Este briefing <strong>no ejecuta ni puede ejecutar</strong> operaciones de compra/venta.
              Las acciones disponibles son únicamente de revisión, aprobación o escalada para
              revisión humana adicional. (RF-012, RN-01)
            </p>
          </div>
        </div>
      </div>

      {/* Acciones según rol (SRS §24.4) */}
      <div className="card">
        <div style={{ fontWeight:700, fontSize:'13.5px', marginBottom:'14px' }}>Acciones del briefing</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          {/* Analista: enviar a revisión */}
          {canSendToReview && (
            <button id="briefing-send-review" className="btn btn-primary" onClick={() => setConfirmStatus('En revisión')} disabled={saving}>
              <Send size={14} /> Enviar a revisión
            </button>
          )}

          {/* Supervisor/Admin: aprobar o escalar */}
          {canApprove && briefing.status === 'En revisión' && (
            <>
              <button id="briefing-approve" className="btn btn-primary" style={{ background:'var(--positivo)' }}
                onClick={() => setConfirmStatus('Aprobado')} disabled={saving}>
                <CheckCircle size={14} /> Aprobar
              </button>
              <button id="briefing-escalate" className="btn btn-secondary"
                onClick={() => setConfirmStatus('Escalado')} disabled={saving}>
                <AlertTriangle size={14} /> Devolver / Escalar
              </button>
            </>
          )}

          {briefing.status === 'Aprobado' && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', color:'var(--aprobado)', fontWeight:600, fontSize:'13px' }}>
              <CheckCircle size={15} /> Briefing aprobado — listo para compartir con cliente (solo supervisores)
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer (RF-008, RNF-011) */}
      <div className="disclaimer" style={{ marginTop:'16px' }}>
        <AlertTriangle size={14} />
        <span>
          <strong>Aviso legal:</strong> Este briefing no constituye asesoría financiera personalizada
          ni garantiza rendimientos. Es un resumen informativo sujeto a revisión humana.
          No ejecuta operaciones financieras de ningún tipo. (RN-01, RN-03, RF-012)
        </span>
      </div>

      <ConfirmModal
        isOpen={!!confirmStatus}
        title="Confirmar cambio de estado"
        message={`¿Confirmas la acción "${confirmStatus ? STATUS_CONFIRM_TEXT[confirmStatus] : ''}" para este briefing?`}
        confirmText={confirmStatus ? STATUS_CONFIRM_TEXT[confirmStatus] : 'Confirmar'}
        isDestructive={confirmStatus === 'Escalado'}
        onConfirm={() => confirmStatus && handleStatusChange(confirmStatus)}
        onCancel={() => setConfirmStatus(null)}
      />
    </div>
  );
}

// ─── Fila de señal dentro de un briefing ─────────────────────
function SignalRow({ signal }: { signal: Signal }) {
  const [localStatus, setLocalStatus] = useState<SignalStatus>(signal.status);
  const [comment, setComment] = useState(signal.review_comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  async function save(status: SignalStatus) {
    setConfirmSave(false);
    if (!comment.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('signals')
      .update({ status, review_comment: comment })
      .eq('id', signal.id);
    setLocalStatus(status);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{
      background:'var(--bg-base)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:'14px 16px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
        <span className={`impact-badge impact-${signal.impact}`} style={{ fontSize:'11px' }}>
          {signal.impact === 'Positivo' ? <TrendingUp size={11} /> :
           signal.impact === 'Negativo' ? <TrendingDown size={11} /> :
           signal.impact === 'Neutral'  ? <Minus size={11} /> :
           <HelpCircle size={11} />}
          {signal.impact}
        </span>
        <span style={{ fontWeight:700, fontSize:'13.5px' }}>{signal.assets?.symbol}</span>
        <span style={{ fontSize:'12px', color:'var(--text-muted)', flex:1 }}>{signal.assets?.name}</span>
        <span style={{ fontWeight:700, fontSize:'13px', color:'var(--accent-light)' }}>{signal.confidence}%</span>
      </div>

      <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.55', marginBottom:'10px' }}>
        {signal.explanation}
      </p>

      {signal.suggested_research && (
        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'10px', fontStyle:'italic' }}>
          📋 Investigación sugerida: {signal.suggested_research}
        </div>
      )}

      {/* Acciones individuales de la señal (RF-010, RF-011) */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
        {(['Revisada','Escalada','Descartada'] as SignalStatus[]).map(s => (
          <button key={s}
            id={`briefing-signal-${signal.id}-${s.toLowerCase()}`}
            className={`btn btn-sm ${localStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLocalStatus(s)}
          >
            {SIGNAL_STATUS_ICONS[s]} {s}
          </button>
        ))}
        {saved && <span style={{ fontSize:'12px', color:'var(--positivo)', fontWeight:600 }}>✓ Guardado</span>}
      </div>

      {localStatus !== 'Pendiente' && (
        <div style={{ marginTop:'10px', display:'flex', gap:'8px' }}>
          <input
            id={`signal-comment-${signal.id}`}
            className="form-input"
            placeholder="Justificación obligatoria (RN-04)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={{ flex:1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setConfirmSave(true)} disabled={saving || !comment.trim()}>
            {saving ? <span className="spinner" style={{ width:12, height:12 }} /> : <CheckCircle size={13} />}
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmSave}
        title="Confirmar revisión de señal"
        message={`¿Confirmas guardar esta señal (${signal.assets?.symbol}) como "${localStatus}"?`}
        confirmText="Guardar revisión"
        isDestructive={localStatus === 'Descartada'}
        onConfirm={() => save(localStatus)}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}

// ─── Modal crear briefing (RF-009) ────────────────────────────
function CreateBriefingModal({ signals, onClose, onCreate }: {
  signals: Signal[];
  onClose: () => void;
  onCreate: (b: Briefing & { signals?: Signal[] }) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);

  function toggleSignal(id: string) {
    setSelectedSignals(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    setConfirmCreate(false);
    if (!title.trim()) return;
    setSaving(true);

    const newBriefing: Briefing & { signals?: Signal[] } = {
      id: `b-${Date.now()}`,
      title,
      watchlist_id: null,
      asset_id: null,
      status: 'Borrador',
      created_by: user?.id ?? 'demo',
      approved_by: null,
      created_at: new Date().toISOString(),
      signals: signals.filter(s => selectedSignals.includes(s.id)),
    };

    // Intentar guardar en Supabase
    const { data, error } = await supabase
      .from('briefings')
      .insert({ title, status:'Borrador', created_by: user?.id ?? null })
      .select()
      .single();

    onCreate(data ? { ...data as Briefing, signals: newBriefing.signals } : newBriefing);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ fontWeight:800, fontSize:'18px' }}>Nuevo Briefing</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="form-group" style={{ marginBottom:'16px' }}>
          <label className="form-label" htmlFor="briefing-title">Título del briefing</label>
          <input id="briefing-title" className="form-input" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Briefing Portafolio Tecnología — Jul 2026" />
        </div>

        {signals.length > 0 && (
          <div style={{ marginBottom:'16px' }}>
            <div className="form-label" style={{ marginBottom:'8px' }}>Señales a incluir</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {signals.map(s => (
                <label key={s.id} style={{ display:'flex', gap:'10px', alignItems:'center', cursor:'pointer', padding:'8px', background:'var(--bg-elevated)', borderRadius:'var(--radius)', border:`1px solid ${selectedSignals.includes(s.id) ? 'var(--accent)' : 'var(--border)'}` }}>
                  <input type="checkbox" checked={selectedSignals.includes(s.id)} onChange={() => toggleSignal(s.id)} />
                  <span className={`impact-badge impact-${s.impact}`} style={{ fontSize:'10.5px' }}>{s.impact}</span>
                  <span style={{ fontWeight:600, fontSize:'13px' }}>{s.assets?.symbol}</span>
                  <span style={{ fontSize:'12px', color:'var(--text-muted)', flex:1 }}>{s.explanation?.slice(0,60)}…</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button id="create-briefing-confirm" className="btn btn-primary" onClick={() => setConfirmCreate(true)}
            disabled={saving || !title.trim()}>
            {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : <Plus size={14} />}
            Crear briefing
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmCreate}
        title="Confirmar nuevo briefing"
        message={`¿Confirmas crear el briefing "${title}"${selectedSignals.length > 0 ? ` con ${selectedSignals.length} señal(es) incluida(s)` : ''}?`}
        confirmText="Crear briefing"
        isDestructive={false}
        onConfirm={handleCreate}
        onCancel={() => setConfirmCreate(false)}
      />
    </div>
  );
}
