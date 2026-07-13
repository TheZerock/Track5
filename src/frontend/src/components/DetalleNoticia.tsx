/* ============================================================
 * DetalleNoticia.tsx
 * Vista de detalle de una noticia (SRS §24.2)
 * Incluye activos relacionados, visualización de señal de análisis (HU-02, §24.3)
 * y botón para volver a analizar (re-análisis Gemini).
 * ============================================================ */
import React, { useState } from 'react';
import type { News, Asset, Signal } from '../types/database';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  X, ExternalLink, Calendar, Building2, TrendingUp,
  Zap, AlertTriangle, RefreshCw, History
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from './ConfirmModal';

export type NewsWithAssets = News & { assets?: Asset[], signals?: (Signal & { assets?: Asset })[] };

interface Props {
  noticia: NewsWithAssets;
  onClose: () => void;
  onReanalyze?: (noticia: NewsWithAssets) => void;
  isAnalyzing?: boolean;
}

export default function DetalleNoticia({ noticia, onClose, onReanalyze, isAnalyzing }: Props) {
  const { roleName } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  const [confirmAnalyze, setConfirmAnalyze] = useState(false);

  // Ordenamos las señales por fecha de creación descendente (la [0] es la vigente)
  const signals = [...(noticia.signals || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  const currentSignal = signals.length > 0 ? signals[0] : null;
  const historySignals = signals.slice(1);

  // Invitados no pueden re-analizar (RN-05 / §22.1)
  const canReanalyze = roleName !== 'Invitado';

  function formatFull(iso: string): string {
    try {
      return format(parseISO(iso), "d 'de' MMMM yyyy, HH:mm 'h'", { locale: es });
    } catch {
      return iso;
    }
  }

  function getImpactColor(impact: string) {
    switch (impact) {
      case 'Positivo': return 'var(--positivo)';
      case 'Negativo': return 'var(--negativo)';
      case 'Neutral': return 'var(--text-secondary)';
      case 'Incierto': return '#eab308'; // Amarillo
      default: return 'var(--text-muted)';
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }} role="dialog" aria-modal="true" aria-label="Detalle de noticia">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ flex: 1, paddingRight: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.4, color: 'var(--text-primary)' }}>
              {noticia.title}
            </h2>
          </div>
          <button
            id="detalle-noticia-close"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ flexShrink: 0 }}
            aria-label="Cerrar detalle"
          >
            <X size={16} />
          </button>
        </div>

        {/* Meta Noticia */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--accent-light)', fontWeight: 600 }}>
            <ExternalLink size={14} />
            {noticia.source}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <Calendar size={14} />
            {formatFull(noticia.published_at)}
          </span>
          {noticia.sector && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Building2 size={14} />
              {noticia.sector}
            </span>
          )}
        </div>

        {/* Contenido Noticia */}
        <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Contenido de la Noticia
          </div>
          <p style={{ fontSize: '14.5px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            {noticia.content}
          </p>
          
          {/* Activos relacionados */}
          {(noticia.assets ?? []).length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(noticia.assets ?? []).map(asset => (
                <div key={asset.symbol} className="chip chip-asset" style={{ padding: '6px 12px', fontSize: '13px' }}>
                  <TrendingUp size={14} style={{ color: 'var(--accent-light)' }} />
                  <span style={{ fontWeight: 700 }}>{asset.symbol}</span>
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>· {asset.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── DETALLE DE SEÑAL VIGENTE (SRS §24.3) ─── */}
        {currentSignal ? (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} style={{ color: 'var(--accent-light)' }} />
                Análisis de IA Vigente
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Analizado el: {formatFull(currentSignal.created_at)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Impacto */}
              <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Impacto Proyectado</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: getImpactColor(currentSignal.impact) }}>
                  {currentSignal.impact}
                </div>
              </div>
              
              {/* Confianza */}
              <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Nivel de Confianza</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, background: 'var(--bg-base)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${currentSignal.confidence}%`, 
                      background: currentSignal.confidence > 70 ? 'var(--positivo)' : currentSignal.confidence > 40 ? '#eab308' : 'var(--negativo)' 
                    }} />
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{currentSignal.confidence}%</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Explicación y Evidencia</div>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                {currentSignal.explanation}
              </p>

              {currentSignal.risks && (
                <>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Riesgos y Factores Mitigantes</div>
                  <p style={{ fontSize: '13.5px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '16px', paddingLeft: '12px', borderLeft: '3px solid #eab308' }}>
                    {currentSignal.risks}
                  </p>
                </>
              )}

              {currentSignal.suggested_research && (
                <>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Investigación Sugerida</div>
                  <p style={{ fontSize: '13.5px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                    {currentSignal.suggested_research}
                  </p>
                </>
              )}
            </div>

            {/* Acciones de Señal */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              {historySignals.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)} style={{ marginRight: 'auto' }}>
                  <History size={14} /> 
                  {showHistory ? 'Ocultar historial' : `Ver historial (${historySignals.length})`}
                </button>
              )}

              {canReanalyze && onReanalyze && (
                <button className="btn btn-secondary" onClick={() => setConfirmReanalyze(true)} disabled={isAnalyzing}>
                  {isAnalyzing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <RefreshCw size={14} />}
                  {isAnalyzing ? 'Analizando...' : 'Volver a analizar'}
                </button>
              )}
            </div>

            {/* Historial de Análisis Anteriores */}
            {showHistory && historySignals.length > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-base)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} /> Historial de análisis anteriores
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historySignals.map(hs => (
                    <div key={hs.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatFull(hs.created_at)}</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: getImpactColor(hs.impact) }}>{hs.impact} (Confianza: {hs.confidence}%)</div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID: {hs.id.split('-')[0]}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '30px 20px', marginBottom: '24px' }}>
            <Zap size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Noticia sin analizar</h3>
            <p style={{ fontSize: '13.5px' }}>Esta noticia aún no ha sido procesada por nuestros agentes IA.</p>
            {onReanalyze && canReanalyze && (
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setConfirmAnalyze(true)} disabled={isAnalyzing}>
                {isAnalyzing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Zap size={14} />}
                {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
              </button>
            )}
          </div>
        )}

        {/* Acciones Generales */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar detalle
          </button>
        </div>

        {/* Disclaimer (RF-008, RNF-011) */}
        <div className="disclaimer" style={{ marginTop: '20px' }}>
          <AlertTriangle size={13} />
          <span>
            Este sistema no ejecuta operaciones financieras ni garantiza rendimientos. 
            Toda señal es una propuesta sujeta a revisión humana. (RN-01)
          </span>
        </div>
      </div>

      {/* Modal de confirmación para re-análisis */}
      <ConfirmModal
        isOpen={confirmReanalyze}
        title="Confirmar nuevo análisis"
        message="¿Confirmas volver a analizar esta noticia? Esto generará una nueva señal vigente; el resultado del análisis actual se guardará en el historial para trazabilidad."
        confirmText="Sí, volver a analizar"
        onConfirm={() => {
          setConfirmReanalyze(false);
          if (onReanalyze) onReanalyze(noticia);
        }}
        onCancel={() => setConfirmReanalyze(false)}
      />

      {/* Modal de confirmación para el primer análisis */}
      <ConfirmModal
        isOpen={confirmAnalyze}
        title="Confirmar análisis con IA"
        message="¿Confirmas analizar esta noticia? Esto generará una nueva señal a partir de su contenido."
        confirmText="Analizar con IA"
        isDestructive={false}
        onConfirm={() => {
          setConfirmAnalyze(false);
          if (onReanalyze) onReanalyze(noticia);
        }}
        onCancel={() => setConfirmAnalyze(false)}
      />
    </div>
  );
}
