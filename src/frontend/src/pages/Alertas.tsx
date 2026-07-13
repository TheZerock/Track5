/* ============================================================
 * Alertas.tsx — RF-013, RF-014, RF-015, SRS §20, §24.5
 * Crear/editar/activar-desactivar alertas por activo.
 * RN-05: Invitado no puede crear alertas.
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Alert, Asset } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const MOCK_ALERTS: (Alert & { assets?: Asset })[] = [
  { id:'al1', user_id:'u1', asset_id:'a3', condition:'Nueva señal generada', is_active:true,  created_at: new Date(Date.now()-2*3600*1000).toISOString(), assets:{ id:'a3', symbol:'BTC', name:'Bitcoin', type:'Cripto', sector:'Criptoactivos' } },
  { id:'al2', user_id:'u1', asset_id:'a5', condition:'Confianza mayor a 70%', is_active:true,  created_at: new Date(Date.now()-5*3600*1000).toISOString(), assets:{ id:'a5', symbol:'AAPL', name:'Apple Inc.', type:'Acción', sector:'Tecnología' } },
  { id:'al3', user_id:'u1', asset_id:'a7', condition:'Impacto negativo detectado', is_active:false, created_at: new Date(Date.now()-24*3600*1000).toISOString(), assets:{ id:'a7', symbol:'WTI', name:'Petróleo WTI', type:'Commodity', sector:'Energía' } },
];

const MOCK_ASSETS: Asset[] = [
  { id:'a1', symbol:'AAPL', name:'Apple Inc.', type:'Acción', sector:'Tecnología' },
  { id:'a3', symbol:'BTC',  name:'Bitcoin',    type:'Cripto', sector:'Criptoactivos' },
  { id:'a4', symbol:'ETH',  name:'Ethereum',   type:'Cripto', sector:'Criptoactivos' },
  { id:'a5', symbol:'TSLA', name:'Tesla Inc.', type:'Acción', sector:'Automotriz' },
  { id:'a6', symbol:'GOLD', name:'Oro spot',   type:'Commodity', sector:'Metales preciosos' },
  { id:'a7', symbol:'WTI',  name:'Petróleo WTI', type:'Commodity', sector:'Energía' },
];

const CONDITION_PRESETS = [
  'Nueva señal generada',
  'Impacto positivo detectado',
  'Impacto negativo detectado',
  'Confianza mayor a 70%',
  'Confianza mayor a 85%',
  'Señal escalada',
];

export default function Alertas() {
  const { roleName, user } = useAuth();
  const [alerts, setAlerts]     = useState<(Alert & { assets?: Asset })[]>(MOCK_ALERTS);
  const [assets, setAssets]     = useState<Asset[]>(MOCK_ASSETS);
  const [usingMock, setUsingMock] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ asset_id:'', condition:'' });
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<(Alert & { assets?: Asset }) | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);

  const canCreate = roleName && roleName !== 'Invitado';

  useEffect(() => {
    async function load() {
      const [aRes, asRes] = await Promise.all([
        supabase.from('alerts').select('*, assets(*)').eq('user_id', user?.id ?? '').order('created_at', { ascending:false }),
        supabase.from('assets').select('*').order('symbol'),
      ]);
      if (!aRes.error && aRes.data?.length) { setAlerts(aRes.data as (Alert & { assets?: Asset })[]); setUsingMock(false); }
      if (!asRes.error && asRes.data?.length) setAssets(asRes.data as Asset[]);
    }
    if (user?.id) load();
  }, [user?.id]);

  async function toggle(alert: Alert & { assets?: Asset }) {
    if (alert.is_active) {
      setConfirmDeactivate(alert);
    } else {
      await executeToggle(alert);
    }
  }

  async function executeToggle(alert: Alert & { assets?: Asset }) {
    const newVal = !alert.is_active;
    await supabase.from('alerts').update({ is_active: newVal }).eq('id', alert.id);
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_active: newVal } : a));
    setConfirmDeactivate(null);
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete;
    await supabase.from('alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    setConfirmDelete(null);
  }

  async function createAlert() {
    if (!form.asset_id || !form.condition) return;
    const asset = assets.find(a => a.id === form.asset_id);
    const newAlert: Alert & { assets?: Asset } = {
      id: `al-${Date.now()}`, user_id: user?.id ?? 'demo',
      asset_id: form.asset_id, condition: form.condition, is_active: true,
      created_at: new Date().toISOString(), assets: asset,
    };
    const { data } = await supabase.from('alerts').insert({
      user_id: user?.id, asset_id: form.asset_id, condition: form.condition, is_active: true,
    }).select('*, assets(*)').single();
    setAlerts(prev => [data ? data as Alert & { assets?: Asset } : newAlert, ...prev]);
    setForm({ asset_id:'', condition:'' });
    setShowForm(false);
    setConfirmCreate(false);
  }

  const pendingAssetLabel = assets.find(a => a.id === form.asset_id)?.symbol ?? form.asset_id;

  const activeCount = alerts.filter(a => a.is_active).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <Bell size={24} style={{ color:'var(--accent-light)' }} />
            Alertas
          </h1>
          <p className="page-subtitle">
            Seguimiento de activos · <span style={{ color:'var(--positivo)', fontWeight:600 }}>{activeCount} activas</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {canCreate && (
            <button id="create-alert" className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Nueva alerta
            </button>
          )}
        </div>
      </div>

      {/* Formulario */}
      {showForm && canCreate && (
        <div className="card" style={{ marginBottom:'16px' }}>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div className="form-group" style={{ flex:1, minWidth:'160px' }}>
              <label className="form-label" htmlFor="alert-asset">Activo</label>
              <select id="alert-asset" className="form-select" value={form.asset_id}
                onChange={e => setForm(f => ({ ...f, asset_id:e.target.value }))}>
                <option value="">Seleccionar activo…</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex:1, minWidth:'200px' }}>
              <label className="form-label" htmlFor="alert-condition">Condición</label>
              <select id="alert-condition" className="form-select" value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition:e.target.value }))}>
                <option value="">Seleccionar condición…</option>
                {CONDITION_PRESETS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button id="alert-create-confirm" className="btn btn-primary"
              onClick={() => setConfirmCreate(true)} disabled={!form.asset_id || !form.condition}>
              <Plus size={14} /> Crear
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Lista de alertas */}
      {alerts.length === 0 ? (
        <div className="empty-state"><Bell size={36} /><h3>Sin alertas</h3><p>Crea alertas para recibir notificaciones cuando haya señales relevantes.</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              background:'var(--bg-surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-lg)', padding:'14px 18px',
              display:'flex', alignItems:'center', gap:'14px',
              opacity: alert.is_active ? 1 : 0.55,
            }}>
              <div style={{
                width:10, height:10, borderRadius:'50%', flexShrink:0,
                background: alert.is_active ? 'var(--positivo)' : 'var(--text-muted)',
              }} className={alert.is_active ? 'notification-dot' : ''} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:'13.5px' }}>
                  {alert.assets?.symbol}
                  <span style={{ fontWeight:400, fontSize:'12px', color:'var(--text-muted)', marginLeft:'8px' }}>{alert.assets?.name}</span>
                </div>
                <div style={{ fontSize:'12.5px', color:'var(--text-secondary)', marginTop:'2px' }}>
                  {alert.condition}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                <button
                  id={`alert-toggle-${alert.id}`}
                  className="btn btn-ghost btn-sm"
                  onClick={() => toggle(alert)}
                  aria-label={alert.is_active ? 'Desactivar alerta' : 'Activar alerta'}
                >
                  {alert.is_active
                    ? <ToggleRight size={20} style={{ color:'var(--positivo)' }} />
                    : <ToggleLeft  size={20} style={{ color:'var(--text-muted)' }} />}
                </button>
                {canCreate && (
                  <button
                    id={`alert-delete-${alert.id}`}
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmDelete(alert.id)}
                    aria-label="Eliminar alerta"
                  >
                    <Trash2 size={14} style={{ color:'var(--negativo)' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmCreate}
        title="Confirmar nueva alerta"
        message={`¿Confirmas crear una alerta para ${pendingAssetLabel} con la condición "${form.condition}"?`}
        confirmText="Crear alerta"
        isDestructive={false}
        onConfirm={createAlert}
        onCancel={() => setConfirmCreate(false)}
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Confirmar eliminación"
        message="¿Confirmas eliminar permanentemente esta alerta?"
        confirmText="Eliminar alerta"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeactivate}
        title="Confirmar desactivación"
        message={`¿Confirmas desactivar la alerta para ${confirmDeactivate?.assets?.symbol}? Dejarás de recibir notificaciones de esta alerta.`}
        confirmText="Desactivar alerta"
        onConfirm={() => confirmDeactivate && executeToggle(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
