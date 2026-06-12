/**
 * NotificationBell.jsx
 * ──────────────────────────────────────────────────────────────────────────
 * Header-mounted bell with an unread badge. Polls /api/notifications/unread-count
 * every 15s while the user is logged in. Click opens a dropdown that loads
 * the latest 20 notifications and lets the user mark them read or jump to
 * the referenced surface (inquiry / conversation).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationPanel from './NotificationPanel';
import { useNotificationContext } from '../context/NotificationContext';
import { subscribeToPushNotifications } from '../utils/pushSubscription';

export default function NotificationBell({ isAuthed, className = '' }) {
  const navigate = useNavigate();
  const { unreadCount } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpen = async () => {
    if (!isAuthed) {
      navigate('/login?next=%2Fsmart-alerts');
      return;
    }
    setOpen((o) => !o);

    // Prompt for push notifications if we haven't already
    if ('Notification' in window && Notification.permission !== 'denied') {
      await subscribeToPushNotifications();
    }
  };

  useEffect(() => {
    if (isAuthed && 'Notification' in window && Notification.permission === 'granted') {
      subscribeToPushNotifications();
    }
  }, [isAuthed]);

  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className={`relative p-2 rounded-xl text-gray-700 bg-white/70 backdrop-blur-md border border-white/60 shadow-sm hover:text-[#ba0036] hover:bg-red-50 hover:border-red-100 transition-all ${className}`}
      >
        <Bell size={18} strokeWidth={2.4} />
      </button>
    );
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative p-2 rounded-xl text-gray-700 bg-white/70 backdrop-blur-md border border-white/60 shadow-sm hover:text-[#ba0036] hover:bg-red-50 hover:border-red-100 transition-all"
      >
        <Bell size={18} strokeWidth={2.4} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ba0036] text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white animate-[bounce_0.3s_ease-out]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}