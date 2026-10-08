import { useEffect, useRef, useState } from 'react';
import { api } from '../data';
import { navigate } from '../router';
import { useQuery } from '../state/useQuery';
import { timeAgo } from '../lib/util';
import { Icon } from './ui';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const q = useQuery(() => api.listNotifications(), []);
  const list = q.data ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="bell" ref={box}>
      <button type="button" className="icon-btn" aria-label={unread ? `Notifiche: ${unread} da leggere` : 'Notifiche'} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bell" />
        {unread > 0 && <span className="count-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifiche">
          <header>
            <strong>Notifiche</strong>
            {unread > 0 && (
              <button type="button" className="link-btn" onClick={() => void api.markAllNotificationsRead()}>
                Segna tutte come lette
              </button>
            )}
          </header>
          {list.length === 0 ? (
            <p className="muted bell-empty">Nessuna notifica per ora.</p>
          ) : (
            <ul>
              {list.slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={n.read_at ? '' : 'unread'}
                    onClick={() => {
                      void api.markNotificationRead(n.id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                    <small>{timeAgo(n.created_at)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
