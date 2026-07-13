/* ============================================================
 * Auditoria.tsx — RF-017, SRS §23, §24.6
 * Solo Administrador y Supervisor pueden ver todos los registros.
 * Analista solo ve los suyos (sección 22.1).
 * Tabla inmutable: no hay DELETE/UPDATE desde la UI.
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AuditLog } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const MOCK_AUDIT: AuditLog[] = [
  { id:'au1', user_id:'u1', action:'signal.status_change', entity:'signals', entity_id:'s1', previous_state:{ status:'Pendiente' }, new_state:{ status:'Revisada', review_comment:'Análisis confirma tendencia alcista.' }, created_at: new Date(Date.now()-1*3600*1000).toISOString() },
  { id:'au2', user_id:'u2', action:'briefing.approve', entity:'briefings', entity_id:'b3', previous_state:{ status:'En revisión' }, new_state:{ status:'Aprobado' }, created_at: new Date(Date.now()-2*3600*1000).toISOString() },
  { id:'au3', user_id:null, action:'signal.create', entity:'signals', entity_id:'s3', previous_state:null, new_state:{ impact:'Negativo', confidence:72, status:'Pendiente' }, created_at: new Date(Date.now()-6*3600*1000).toISOString() },
  { id:'au4', user_id:'u1', action:'alert.create', entity:'alerts', entity_id:'al1', previous_state:null, new_state:{ asset_id:'a3', condition:'Nueva señal generada', is_active:true }, created_at: new Date(Date.now()-8*3600*1000).toISOString() },
  { id:'au5', user_id:'u1', action:'signal.status_change', entity:'signals', entity_id:'s4', previous_state:{ status:'Pendiente' }, new_state:{ status:'Escalada', review_comment:'Requiere análisis de supervisor.' }, created_at: new Date(Date.now()-3*3600*1000).toISOString() },
  { id:'au6', user_id:null, action:'signal.create', entity:'signals', entity_id:'s5', previous_state:null, new_state:{ impact:'Positivo', confidence:76, status:'Pendiente' }, created_at: new Date(Date.now()-18*3600*1000).toISOString() },
  { id:'au7', user_id:'u1', action:'watchlist.create', entity:'watchlists', entity_id:'w1', previous_state:null, new_state:{ name:'Portafolio Tech' }, created_at: new Date(Date.now()-5*24*3600*1000).toISOString() },
  { id:'au8', user_id:'u2', action:'briefing.status_change', entity:'briefings', entity_id:'b1', previous_state:{ status:'Borrador' }, new_state:{ status:'En revisión' }, created_at: new Date(Date.now()-2*3600*1000).toISOString() },
];

const FIELD_LABELS: Record<string, string> = {
  status: 'Estado',
  impact: 'Impacto',
  confidence: 'Confianza',
  review_comment: 'Comentario',
  name: 'Nombre',
  asset_id: 'Activo',
  condition: 'Condición',
  is_active: 'Activa',
};

function formatFieldValue(key: string, value: unknown): string {
  if (key === 'confidence' && typeof value === 'number') return `${value}%`;
  if (key === 'is_active') return value ? 'Sí' : 'No';
  return String(value);
}

const IMPACT_TEXT_COLOR: Record<string, string> = {
  Positivo: 'var(--positivo)',
  Negativo: 'var(--negativo)',
  Neutral:  'var(--neutral)',
  Incierto: 'var(--incierto)',
};

function AuditState({ state }: { state: Record<string, unknown> | null }) {
  if (!state) {
    return <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Registro inicial (creación)</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {Object.entries(state).map(([key, value]) => {
        const impactColor = key === 'impact' ? IMPACT_TEXT_COLOR[String(value)] : undefined;
        return (
          <div key={key} style={{ fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{FIELD_LABELS[key] ?? key}:</span>{' '}
            <span style={{ fontWeight: 600, color: impactColor ?? 'var(--text-primary)' }}>
              {formatFieldValue(key, value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  'signal.status_change':   'Cambio de estado (Señal)',
  'signal.create':          'Creación de señal',
  'briefing.approve':       'Aprobación de briefing',
  'briefing.status_change': 'Cambio de estado (Briefing)',
  'alert.create':           'Creación de alerta',
  'watchlist.create':       'Creación de watchlist',
};

const ACTION_COLORS: Record<string, string> = {
  'signal.status_change': 'var(--accent-light)',
  'signal.create':        'var(--positivo)',
  'briefing.approve':     '#10b981',
  'briefing.status_change': 'var(--incierto)',
  'alert.create':         '#8b5cf6',
  'watchlist.create':     '#f59e0b',
};

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'var(--text-secondary)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontWeight: 600, fontSize: '11.5px', color,
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: '999px', padding: '3px 10px',
      whiteSpace: 'nowrap',
    }}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

type AuditUser = { email: string; roles?: { name: string } | null } | null;
type AuditLogRow = AuditLog & { users?: AuditUser };

function UserCell({ log }: { log: AuditLogRow }) {
  if (!log.user_id) {
    return <span style={{ fontStyle: 'italic', color: 'var(--accent-light)' }}>Agente IA</span>;
  }
  if (log.users) {
    return (
      <span>
        {log.users.roles?.name && <strong style={{ color: 'var(--text-primary)' }}>{log.users.roles.name}</strong>}
        {log.users.roles?.name && ' · '}
        {log.users.email}
      </span>
    );
  }
  return <span>{log.user_id.slice(0, 8)}…</span>;
}

export default function Auditoria() {
  const { roleName, user } = useAuth();
  const [logs, setLogs]       = useState<AuditLogRow[]>(MOCK_AUDIT);
  const [usingMock, setUsingMock] = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    async function load() {
      let q = supabase.from('audit_logs').select('*, users(email, roles(name))').order('created_at', { ascending:false });
      // Analista: solo sus propios registros
      if (roleName === 'Analista' && user?.id) q = q.eq('user_id', user.id);
      const { data, error } = await q;
      if (!error && data?.length) { setLogs(data as AuditLogRow[]); setUsingMock(false); }
    }
    load();
  }, [roleName, user?.id]);

  const filtered = logs.filter(l => {
    if (filterEntity && l.entity !== filterEntity) return false;
    if (filterAction && l.action !== filterAction) return false;
    return true;
  });

  const entities = [...new Set(logs.map(l => l.entity))];
  const actions  = [...new Set(logs.map(l => l.action))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <ClipboardList size={24} style={{ color:'var(--accent-light)' }} />
            Auditoría
          </h1>
          <p className="page-subtitle">
            Registros inmutables de acciones del sistema (RF-017, SRS §23)
            {roleName === 'Analista' && ' — Solo tus acciones'}
          </p>
        </div>
      </div>

      {/* Filtros (SRS §24.6) */}
      <div className="card" style={{ marginBottom:'20px' }}>
        <div className="filter-bar">
          <select id="audit-filter-entity" className="filter-select" value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
            <option value="">Todas las entidades</option>
            {entities.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select id="audit-filter-action" className="filter-select" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">Todas las acciones</option>
            {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
          </select>
          {(filterEntity || filterAction) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setFilterEntity(''); setFilterAction(''); }}>
              Limpiar
            </button>
          )}
          <div style={{ marginLeft:'auto', fontSize:'12px', color:'var(--text-muted)' }}>
            <Search size={12} style={{ display:'inline', marginRight:'4px' }} />
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tabla de auditoría (SRS §24.6) */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Usuario</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <React.Fragment key={log.id}>
                <tr>
                  <td style={{ fontFamily:'monospace', fontSize:'12px', whiteSpace:'nowrap' }}>
                    {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale:es })}
                  </td>
                  <td>
                    <ActionBadge action={log.action} />
                  </td>
                  <td>
                    <span className="chip chip-sector" style={{ fontSize:'11px' }}>{log.entity}</span>
                  </td>
                  <td style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                    <UserCell log={log} />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      aria-expanded={expanded === log.id}
                      id={`audit-expand-${log.id}`}
                    >
                      {expanded === log.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {expanded === log.id ? 'Ocultar' : 'Ver'}
                    </button>
                  </td>
                </tr>
                {expanded === log.id && (
                  <tr>
                    <td colSpan={5} style={{ padding:'0 16px 12px' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                        <div>
                          <div style={{ fontSize:'10.5px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'6px' }}>Estado anterior</div>
                          <div style={{
                            background:'var(--bg-elevated)', padding:'10px', borderRadius:'var(--radius)',
                            overflow:'auto', maxHeight:'120px',
                          }}>
                            <AuditState state={log.previous_state} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:'10.5px', fontWeight:700, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'6px' }}>Estado nuevo</div>
                          <div style={{
                            background:'var(--bg-elevated)', padding:'10px', borderRadius:'var(--radius)',
                            overflow:'auto', maxHeight:'120px',
                          }}>
                            <AuditState state={log.new_state} />
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'6px' }}>
                        ID entidad: <span className="mono">{log.entity_id}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state" style={{ marginTop:'20px' }}>
          <ClipboardList size={36} />
          <h3>Sin registros</h3>
          <p>No hay registros de auditoría con los filtros actuales.</p>
        </div>
      )}
    </div>
  );
}
