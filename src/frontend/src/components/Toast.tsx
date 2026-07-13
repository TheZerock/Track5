/* ============================================================
 * Toast.tsx — Notificación no bloqueante (reemplazo de alert())
 * ============================================================ */
import React, { useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ToastData {
  message: string;
  type?: 'error' | 'info';
}

interface ToastProps extends ToastData {
  onClose: () => void;
  durationMs?: number;
}

export default function Toast({ message, type = 'info', onClose, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onClose]);

  const isError = type === 'error';

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        maxWidth: '360px',
        padding: '14px 16px',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-elevated)',
        border: `1px solid ${isError ? 'rgba(239,68,68,.35)' : 'var(--border)'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        animation: 'toast-in 0.2s ease',
      }}
    >
      {isError
        ? <AlertTriangle size={17} style={{ color: 'var(--negativo)', flexShrink: 0, marginTop: '1px' }} />
        : <Info size={17} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: '1px' }} />
      }
      <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {message}
      </div>
      <button
        onClick={onClose}
        aria-label="Cerrar notificación"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, flexShrink: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
