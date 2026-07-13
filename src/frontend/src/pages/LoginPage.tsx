import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Eye, EyeOff, TrendingUp, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  }

  async function autoLogin(demoEmail: string, demoPwd: string) {
    setError(null);
    setLoading(true);
    const { error } = await signIn(demoEmail, demoPwd);
    if (error) {
      setError(error);
      // Fill the fields so the user can see what failed
      setEmail(demoEmail);
      setPassword(demoPwd);
    }
    setLoading(false);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: 44, height: 44,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={22} color="white" />
            </div>
          </div>
          <h1 className="auth-title">Market Intelligence AI</h1>
          <p className="auth-sub">Sistema de análisis de mercado con agentes IA</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Correo electrónico</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="analista@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 'var(--radius)', padding: '10px 14px',
              color: '#ef4444', fontSize: '13px',
            }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          >
            {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Iniciando sesión…</> : (
              <><ShieldCheck size={16} /> Iniciar sesión</>
            )}
          </button>
        </form>

        {/* Acceso Rápido (Demo) */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
            Acceso rápido por roles (Demo)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => autoLogin('admin@local.ec', 'Lerma123#')} disabled={loading} style={{ justifyContent: 'center' }}>Administrador</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => autoLogin('analista@local.ec', 'Analista234#')} disabled={loading} style={{ justifyContent: 'center' }}>Analista</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => autoLogin('supervisor@local.ec', 'Supervisor432#')} disabled={loading} style={{ justifyContent: 'center' }}>Supervisor</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => autoLogin('invitado@local.ec', 'invitado123#')} disabled={loading} style={{ justifyContent: 'center' }}>Invitado</button>
          </div>
        </div>

        {/* Disclaimer legal (RN-01, RNF-011) */}
        <div className="disclaimer" style={{ marginTop: '24px' }}>
          <AlertTriangle size={14} />
          <span>
            Este sistema <strong>no ejecuta operaciones financieras</strong>, no recomienda
            compra/venta de instrumentos ni garantiza rendimientos. Toda señal es una propuesta
            sujeta a revisión humana. (RN-01)
          </span>
        </div>
      </div>
    </div>
  );
}
