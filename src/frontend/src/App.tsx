import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Activos from './pages/Activos';
import RadarNoticias from './pages/RadarNoticias';
import Senales from './pages/Senales';
import Briefings from './pages/Briefings';
import Watchlists from './pages/Watchlists';
import Alertas from './pages/Alertas';
import Auditoria from './pages/Auditoria';
import Administracion from './pages/Administracion';

// ─── Custom Hook para Tema ────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return { theme, setTheme };
}

// ─── Layout autenticado ───────────────────────────────────────
// ─── Layout autenticado ───────────────────────────────────────
function AppLayout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        <main className="page-content" style={{ paddingTop: '0' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/activos"    element={<Activos />} />
            <Route path="/noticias"   element={<RadarNoticias />} />
            <Route path="/senales"    element={<Senales />} />
            <Route path="/briefings"  element={<Briefings />} />
            <Route path="/watchlists" element={<Watchlists />} />
            <Route path="/alertas"    element={<Alertas />} />
            <Route path="/auditoria"  element={<Auditoria />} />
            <Route path="/admin"      element={<Administracion />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Guard de autenticación ───────────────────────────────────
function AuthGuard() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cargando Market Intelligence AI…</div>
        </div>
      </div>
    );
  }

  return session ? <AppLayout /> : <LoginPage />;
}

// ─── App root ─────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthGuard />
      </AuthProvider>
    </BrowserRouter>
  );
}
