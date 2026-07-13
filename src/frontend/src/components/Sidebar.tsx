import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Newspaper, Zap, FileText,
  BookMarked, Bell, ClipboardList, Settings,
  TrendingUp, ChevronRight, LineChart,
} from 'lucide-react';

interface NavItemDef {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItemDef[] = [
  { to: '/dashboard',  icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/activos',    icon: <LineChart size={16} />,       label: 'Activos' },
  { to: '/noticias',   icon: <Newspaper size={16} />,       label: 'Radar de Noticias' },
  { to: '/senales',    icon: <Zap size={16} />,             label: 'Señales' },
  { to: '/briefings',  icon: <FileText size={16} />,        label: 'Briefings' },
  { to: '/watchlists', icon: <BookMarked size={16} />,      label: 'Watchlists' },
  { to: '/alertas',    icon: <Bell size={16} />,            label: 'Alertas' },
  { to: '/auditoria',  icon: <ClipboardList size={16} />,   label: 'Auditoría', roles: ['Administrador','Supervisor'] },
  { to: '/admin',      icon: <Settings size={16} />,        label: 'Administración', roles: ['Administrador'] },
];

export default function Sidebar() {
  const { roleName } = useAuth();

  const visibleItems = navItems.filter(item =>
    !item.roles || (roleName && item.roles.includes(roleName))
  );

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <TrendingUp size={17} color="white" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Principal</div>
        {visibleItems.slice(0, 3).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            <ChevronRight size={13} style={{ opacity: 0.3 }} />
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: '16px' }}>Análisis IA</div>
        {visibleItems.slice(3, 7).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            <span style={{ flex: 1 }}>{item.label}</span>
            <ChevronRight size={13} style={{ opacity: 0.3 }} />
          </NavLink>
        ))}

        {visibleItems.slice(7).length > 0 && (
          <>
            <div className="nav-section-label" style={{ marginTop: '16px' }}>Sistema</div>
            {visibleItems.slice(7).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={13} style={{ opacity: 0.3 }} />
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
