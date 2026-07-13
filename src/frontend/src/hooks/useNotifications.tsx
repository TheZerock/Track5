/* ============================================================
 * useNotifications.tsx
 * Centro de notificaciones — lee de la tabla `notifications`
 * (supabase/migrations/006_notifications.sql), poblada por
 * triggers de Postgres cuando se crea una señal (para dueños de
 * watchlists con ese activo y para alertas que coincidan) o un
 * briefing (para Supervisores/Administradores). El estado
 * leído/no leído se persiste en la base de datos (columna
 * is_read), no en localStorage.
 *
 * Fallback: si la tabla `notifications` todavía no existe en el
 * proyecto de Supabase (migración 006 no aplicada), se degrada a
 * una lista vacía sin romper el header.
 * ============================================================ */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp, TrendingDown, Minus, HelpCircle, FileText, Bell, AlertTriangle,
} from 'lucide-react';

export type NotificationType = 'signal' | 'briefing' | 'alert' | 'escalation';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  date: string;
  link: string;
  color: string;
  icon: React.ReactNode;
  isRead: boolean;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  link: string;
  entity: string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

const MAX_ITEMS = 30;

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  signal: <TrendingUp size={14} />,
  briefing: <FileText size={14} />,
  alert: <Bell size={14} />,
  escalation: <AlertTriangle size={14} />,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  signal: 'var(--positivo)',
  briefing: 'var(--en-revision)',
  alert: 'var(--accent-light)',
  escalation: '#8b5cf6',
};

// Refina el ícono/color de señales según el impacto mencionado en el título
// (la tabla no guarda el impacto por separado, así que lo inferimos del texto).
function iconFor(row: NotificationRow): React.ReactNode {
  if (row.type === 'signal') {
    if (row.title.includes('Negativo')) return <TrendingDown size={14} />;
    if (row.title.includes('Neutral')) return <Minus size={14} />;
    if (row.title.includes('Incierto')) return <HelpCircle size={14} />;
    return <TrendingUp size={14} />;
  }
  return TYPE_ICON[row.type];
}

function colorFor(row: NotificationRow): string {
  if (row.type === 'signal') {
    if (row.title.includes('Negativo')) return 'var(--negativo)';
    if (row.title.includes('Neutral')) return 'var(--neutral)';
    if (row.title.includes('Incierto')) return 'var(--incierto)';
    return 'var(--positivo)';
  }
  return TYPE_COLOR[row.type];
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS);

    if (error) {
      // La tabla probablemente no existe todavía (migración 006 no aplicada)
      setAvailable(false);
      setItems([]);
      setLoading(false);
      return;
    }

    setAvailable(true);
    const rows = (data ?? []) as NotificationRow[];
    setItems(rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      date: row.created_at,
      link: row.link,
      color: colorFor(row),
      icon: iconFor(row),
      isRead: row.is_read,
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function markAllRead() {
    if (!user?.id) return;
    setItems(prev => prev.map(i => ({ ...i, isRead: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  }

  const unreadCount = items.filter(i => !i.isRead).length;

  return { items, unreadCount, markRead, markAllRead, reload: load, loading, available };
}
