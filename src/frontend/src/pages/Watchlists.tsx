/* ============================================================
 * Watchlists.tsx — RF-016, SRS §24.5
 * Crear/editar watchlists, agregar/quitar activos,
 * generar briefing desde una watchlist.
 * RN-05: Invitado no puede crear watchlists.
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Watchlist, WatchlistAsset, Asset } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import {
  BookMarked, Plus, Trash2, FileText, X, TrendingUp, RefreshCw,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import type { ToastData } from '../components/Toast';

const MOCK_ASSETS: Asset[] = [
  { id:'a1',  symbol:'AAPL',   name:'Apple Inc.',           type:'Acción',    sector:'Tecnología' },
  { id:'a2',  symbol:'MSFT',   name:'Microsoft Corporation',type:'Acción',    sector:'Tecnología' },
  { id:'a3',  symbol:'BTC',    name:'Bitcoin',              type:'Cripto',    sector:'Criptoactivos' },
  { id:'a4',  symbol:'ETH',    name:'Ethereum',             type:'Cripto',    sector:'Criptoactivos' },
  { id:'a5',  symbol:'TSLA',   name:'Tesla Inc.',           type:'Acción',    sector:'Automotriz' },
  { id:'a6',  symbol:'GOLD',   name:'Oro spot',             type:'Commodity', sector:'Metales preciosos' },
  { id:'a7',  symbol:'WTI',    name:'Petróleo WTI',         type:'Commodity', sector:'Energía' },
  { id:'a8',  symbol:'SPY',    name:'SPDR S&P 500 ETF',     type:'ETF',       sector:'Índices' },
  { id:'a9',  symbol:'USDMXN', name:'Dólar/Peso mexicano',  type:'Divisa',    sector:'Forex' },
  { id:'a10', symbol:'JPM',    name:'JPMorgan Chase',        type:'Acción',    sector:'Financiero' },
];

type WatchlistFull = Watchlist & { watchlist_assets?: (WatchlistAsset & { assets?: Asset })[] };

const MOCK_WATCHLISTS: WatchlistFull[] = [
  {
    id: 'w1', user_id: 'u1', name: 'Portafolio Tech', created_at: new Date(Date.now()-5*24*3600*1000).toISOString(),
    watchlist_assets: [
      { id:'wa1', watchlist_id:'w1', asset_id:'a1', assets: MOCK_ASSETS[0] },
      { id:'wa2', watchlist_id:'w1', asset_id:'a2', assets: MOCK_ASSETS[1] },
      { id:'wa3', watchlist_id:'w1', asset_id:'a5', assets: MOCK_ASSETS[4] },
    ],
  },
  {
    id: 'w2', user_id: 'u1', name: 'Criptoactivos', created_at: new Date(Date.now()-2*24*3600*1000).toISOString(),
    watchlist_assets: [
      { id:'wa4', watchlist_id:'w2', asset_id:'a3', assets: MOCK_ASSETS[2] },
      { id:'wa5', watchlist_id:'w2', asset_id:'a4', assets: MOCK_ASSETS[3] },
    ],
  },
];

export default function Watchlists() {
  const { roleName, user } = useAuth();
  const navigate = useNavigate();
  const [watchlists, setWatchlists] = useState<WatchlistFull[]>(MOCK_WATCHLISTS);
  const [usingMock, setUsingMock]   = useState(true);
  const [allAssets, setAllAssets]   = useState<Asset[]>(MOCK_ASSETS);
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ watchlistId: string, waId: string, symbol: string } | null>(null);
  const [confirmDeleteWl, setConfirmDeleteWl] = useState<{ id: string, name: string } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmCreateWl, setConfirmCreateWl] = useState(false);
  const [confirmBriefingWl, setConfirmBriefingWl] = useState<WatchlistFull | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const canCreate = roleName && roleName !== 'Invitado';
  const canBrief = roleName && ['Administrador', 'Analista', 'Supervisor'].includes(roleName);

  async function loadWatchlists() {
    let query = supabase.from('watchlists').select('*, watchlist_assets(*, assets(*))').order('created_at', { ascending: false });

    const [wRes, aRes] = await Promise.all([
      query,
      supabase.from('assets').select('*').order('symbol'),
    ]);
    if (!wRes.error && wRes.data) {
      if (wRes.data.length > 0) {
        setWatchlists(wRes.data as WatchlistFull[]);
        setUsingMock(false);
      }
    }
    if (!aRes.error && aRes.data?.length) setAllAssets(aRes.data as Asset[]);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadWatchlists();
    setRefreshing(false);
  }

  useEffect(() => { 
    if (roleName !== undefined) {
      loadWatchlists(); 
    }
  }, [user?.id, roleName]);

  async function createWatchlist() {
    setConfirmCreateWl(false);
    if (!newName.trim()) return;
    const { error } = await supabase.from('watchlists').insert({ user_id: user?.id, name: newName }).select().single();

    if (error) {
      setToast({ message: `No se pudo crear la watchlist. (${error.message})`, type: 'error' });
      return;
    }

    // Recargar TODAS las watchlists desde Supabase para que aparezcan nuevas + anteriores
    await loadWatchlists();
    setNewName(''); setCreating(false);
    setToast({ message: 'Watchlist creada correctamente.', type: 'info' });
  }

  async function executeDeleteWatchlist() {
    if (!confirmDeleteWl) return;
    const { id } = confirmDeleteWl;
    setConfirmDeleteWl(null);
    await supabase.from('watchlists').delete().eq('id', id);
    // Recargar lista completa en lugar de filtrar localmente
    await loadWatchlists();
    // Si no quedan watchlists reales, volver a mock
    setToast({ message: 'Watchlist eliminada.', type: 'info' });
  }

  async function removeAsset() {
    if (!confirmRemove) return;
    const { watchlistId, waId } = confirmRemove;
    setConfirmRemove(null);
    await supabase.from('watchlist_assets').delete().eq('id', waId);
    setWatchlists(prev => prev.map(w => w.id === watchlistId
      ? { ...w, watchlist_assets: (w.watchlist_assets ?? []).filter(wa => wa.id !== waId) }
      : w
    ));
  }

  function requestGenerateBriefing(watchlist: WatchlistFull) {
    if (usingMock) {
      setToast({ message: 'Esta watchlist es de demostración (no existe en la base de datos real). Crea una watchlist nueva con "Nueva watchlist" para poder generar un briefing.', type: 'info' });
      return;
    }

    const assetCount = (watchlist.watchlist_assets ?? []).length;
    if (assetCount === 0) {
      setToast({ message: 'Agrega al menos un activo a la watchlist antes de generar un briefing.', type: 'info' });
      return;
    }

    setConfirmBriefingWl(watchlist);
  }

  async function generateBriefing() {
    const watchlist = confirmBriefingWl;
    if (!watchlist) return;
    setConfirmBriefingWl(null);

    setGeneratingId(watchlist.id);
    const { error } = await supabase.from('briefings').insert({
      title: `Briefing — ${watchlist.name}`,
      watchlist_id: watchlist.id,
      status: 'Borrador',
      created_by: user?.id,
    });
    setGeneratingId(null);

    if (error) {
      setToast({ message: `No se pudo generar el briefing. (${error.message})`, type: 'error' });
      return;
    }

    navigate('/briefings');
  }

  async function addAsset(watchlistId: string, assetId: string) {
    const { data } = await supabase.from('watchlist_assets').insert({ watchlist_id: watchlistId, asset_id: assetId }).select('*, assets(*)').single();
    const asset = allAssets.find(a => a.id === assetId);
    const newWA: WatchlistAsset & { assets?: Asset } = data ?? { id: `wa-${Date.now()}`, watchlist_id: watchlistId, asset_id: assetId, assets: asset };
    setWatchlists(prev => prev.map(w => w.id === watchlistId
      ? { ...w, watchlist_assets: [...(w.watchlist_assets ?? []), newWA] }
      : w
    ));
  }

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <BookMarked size={24} style={{ color:'var(--accent-light)' }} />
            Watchlists
          </h1>
          <p className="page-subtitle">Listas de seguimiento de activos financieros (RF-016)</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Recargar watchlists"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            Actualizar
          </button>
          {canCreate && (
            <button id="create-watchlist" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={14} /> Nueva watchlist
            </button>
          )}
        </div>
      </div>

      {/* Crear watchlist */}
      {creating && (
        <div className="card" style={{ marginBottom:'16px' }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <input id="watchlist-name-input" className="form-input" placeholder="Nombre de la watchlist…"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && newName.trim() && setConfirmCreateWl(true)} style={{ flex:1 }} />
            <button id="watchlist-create-confirm" className="btn btn-primary" onClick={() => setConfirmCreateWl(true)} disabled={!newName.trim()}>
              Crear
            </button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Grid de watchlists */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'16px' }}>
        {watchlists.map(wl => {
          const assets = (wl.watchlist_assets ?? []).map(wa => wa.assets).filter(Boolean) as Asset[];
          const available = allAssets.filter(a => !assets.some(x => x.id === a.id));

          return (
            <WatchlistCard key={wl.id}
              watchlist={wl}
              assets={assets}
              availableAssets={available}
              canEdit={!!canCreate}
              canBrief={!!canBrief}
              isGenerating={generatingId === wl.id}
              onDelete={() => setConfirmDeleteWl({ id: wl.id, name: wl.name })}
              onRemoveAsset={(waId, symbol) => setConfirmRemove({ watchlistId: wl.id, waId, symbol })}
              onAddAsset={(assetId) => addAsset(wl.id, assetId)}
              onGenerateBriefing={() => requestGenerateBriefing(wl)}
            />
          );
        })}
      </div>

      {watchlists.length === 0 && (
        <div className="empty-state">
          <BookMarked size={36} />
          <h3>Sin watchlists</h3>
          <p>Crea tu primera lista de seguimiento para monitorear activos.</p>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmCreateWl}
        title="Confirmar nueva watchlist"
        message={`¿Confirmas crear la watchlist "${newName}"?`}
        confirmText="Crear watchlist"
        isDestructive={false}
        onConfirm={createWatchlist}
        onCancel={() => setConfirmCreateWl(false)}
      />

      <ConfirmModal
        isOpen={!!confirmBriefingWl}
        title="Confirmar generación de briefing"
        message={`¿Confirmas generar un briefing en borrador a partir de la watchlist "${confirmBriefingWl?.name}"?`}
        confirmText="Generar briefing"
        isDestructive={false}
        onConfirm={generateBriefing}
        onCancel={() => setConfirmBriefingWl(null)}
      />

      <ConfirmModal
        isOpen={!!confirmRemove}
        title="Confirmar eliminación"
        message={`¿Confirmas eliminar el activo ${confirmRemove?.symbol} de esta watchlist?`}
        confirmText="Eliminar activo"
        onConfirm={removeAsset}
        onCancel={() => setConfirmRemove(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteWl}
        title="Eliminar Watchlist"
        message={`¿Estás seguro de que deseas eliminar la watchlist "${confirmDeleteWl?.name}"? Esta acción no se puede deshacer y eliminará todos los activos dentro de ella.`}
        confirmText="Eliminar watchlist"
        onConfirm={executeDeleteWatchlist}
        onCancel={() => setConfirmDeleteWl(null)}
      />
    </div>
  );
}

function WatchlistCard({ watchlist, assets, availableAssets, canEdit, canBrief, isGenerating, onDelete, onRemoveAsset, onAddAsset, onGenerateBriefing }: {
  watchlist: WatchlistFull;
  assets: Asset[];
  availableAssets: Asset[];
  canEdit: boolean;
  canBrief: boolean;
  isGenerating: boolean;
  onDelete: () => void;
  onRemoveAsset: (waId: string, symbol: string) => void;
  onAddAsset: (assetId: string) => void;
  onGenerateBriefing: () => void;
}) {
  const [addingAsset, setAddingAsset] = useState('');

  return (
    <div className="card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
        <div style={{ fontWeight:700, fontSize:'15px' }}>{watchlist.name}</div>
        {canEdit && (
          <button className="btn btn-ghost btn-sm" onClick={onDelete} aria-label="Eliminar watchlist">
            <Trash2 size={14} style={{ color:'var(--negativo)' }} />
          </button>
        )}
      </div>

      {/* Activos */}
      <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px' }}>
        {assets.length === 0 && <div style={{ fontSize:'12.5px', color:'var(--text-muted)', fontStyle:'italic' }}>Sin activos aún.</div>}
        {assets.map(asset => {
          const wa = watchlist.watchlist_assets?.find(w => w.asset_id === asset.id);
          return (
            <div key={asset.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:'var(--bg-elevated)', borderRadius:'var(--radius)' }}>
              <TrendingUp size={13} style={{ color:'var(--accent-light)' }} />
              <span style={{ fontWeight:700, fontSize:'13px' }}>{asset.symbol}</span>
              <span style={{ fontSize:'11.5px', color:'var(--text-muted)', flex:1 }}>{asset.type}</span>
              {canEdit && wa && (
                <button className="btn btn-ghost btn-sm" onClick={() => onRemoveAsset(wa.id, asset.symbol)} style={{ padding:'2px 6px' }}>
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Agregar activo */}
      {canEdit && availableAssets.length > 0 && (
        <div style={{ display:'flex', gap:'6px' }}>
          <select className="filter-select" style={{ flex:1 }} value={addingAsset}
            onChange={e => setAddingAsset(e.target.value)}
            id={`watchlist-add-asset-${watchlist.id}`}>
            <option value="">Agregar activo…</option>
            {availableAssets.map(a => <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!addingAsset}
            onClick={() => { if (addingAsset) { onAddAsset(addingAsset); setAddingAsset(''); } }}>
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Generar briefing (RF-016) */}
      {canBrief && (
        <button
          id={`watchlist-briefing-${watchlist.id}`}
          className="btn btn-secondary btn-sm"
          style={{ width:'100%', justifyContent:'center', marginTop:'12px' }}
          onClick={onGenerateBriefing}
          disabled={isGenerating}
        >
          {isGenerating ? <span className="spinner" style={{ width:13, height:13 }} /> : <FileText size={13} />}
          {isGenerating ? 'Generando…' : 'Generar briefing'}
        </button>
      )}
    </div>
  );
}
