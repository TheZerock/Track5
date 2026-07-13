/* ============================================================
 * Header.tsx — Topbar superior
 * Búsqueda de noticias, centro de notificaciones real (señales,
 * briefings, alertas y escalaciones), avatar de usuario con rol
 * y menú de sesión, alternador de tema.
 * ============================================================ */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import {
  Search, Bell, BellOff, Sun, Moon, LogOut, ChevronDown, BellRing, CheckCheck,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const navigate = useNavigate();
  const { user, roleName, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { items: notifications, unreadCount, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') { setMenuOpen(false); setNotifOpen(false); }
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/noticias?q=${encodeURIComponent(q)}` : '/noticias');
  }

  function handleNotifClick(id: string, link: string) {
    markRead(id);
    setNotifOpen(false);
    navigate(link);
  }

  const initials = (user?.full_name || user?.email || 'U')
    .split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="topbar">
      {/* Búsqueda */}
      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '420px', position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          id="header-search"
          type="text"
          placeholder="Buscar noticias, activos, sectores…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="header-search-input"
          aria-label="Buscar noticias"
        />
      </form>

      <div style={{ flex: 1 }} />

      {/* Notificaciones */}
      <div ref={notifRef} style={{ position: 'relative' }}>
        <button
          id="header-notifications"
          className="btn btn-ghost btn-sm header-icon-btn"
          title={`${unreadCount} notificación(es) sin leer`}
          onClick={() => setNotifOpen(o => !o)}
          aria-expanded={notifOpen}
          aria-haspopup="true"
        >
          {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
          {unreadCount > 0 && (
            <span className="header-badge-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {notifOpen && (
          <div className="notif-panel" role="dialog" aria-label="Notificaciones">
            <div className="notif-panel-header">
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Notificaciones</span>
              {notifications.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11.5px', gap: '4px', padding: '4px 8px' }}
                  onClick={markAllRead}
                >
                  <CheckCheck size={13} /> Marcar todas como leídas
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <BellOff size={26} style={{ marginBottom: '8px', opacity: 0.6 }} />
                <div style={{ fontSize: '12.5px' }}>No tienes notificaciones nuevas</div>
              </div>
            ) : (
              <div className="notif-panel-list">
                {notifications.map(n => {
                  const isUnread = !n.isRead;
                  return (
                    <button
                      key={n.id}
                      className={`notif-item${isUnread ? ' unread' : ''}`}
                      onClick={() => handleNotifClick(n.id, n.link)}
                    >
                      <div className="notif-icon" style={{ background: `${n.color}22`, color: n.color }}>
                        {n.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: isUnread ? 600 : 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {formatDistanceToNow(parseISO(n.date), { addSuffix: true, locale: es })}
                        </div>
                      </div>
                      {isUnread && <div className="notif-unread-dot" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tema */}
      <button
        className="btn btn-ghost btn-sm header-icon-btn"
        onClick={onToggleTheme}
        title="Alternar tema"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Avatar / menú de usuario */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          id="header-user-menu"
          onClick={() => setMenuOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: '20px', padding: '4px 10px 4px 4px', cursor: 'pointer',
          }}
        >
          <div className="header-avatar">{initials}</div>
          <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.full_name || user?.email || 'Usuario'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{roleName ?? 'Sin rol'}</div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {menuOpen && (
          <div className="header-user-dropdown">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{user?.full_name || 'Usuario'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
            <button
              id="header-logout"
              className="header-dropdown-item"
              onClick={() => { setMenuOpen(false); signOut(); }}
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
