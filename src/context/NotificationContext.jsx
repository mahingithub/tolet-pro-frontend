import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import notificationService from '../services/notificationService';
import chatService from '../services/chatService';
import callProvider from '../services/callProvider';
import { useAuth } from './AuthContext'; // Need to make sure AuthContext exists and can be imported

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAuthed = !!user;

  // Items and Unread Count
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('notif_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [dndSchedule, setDndSchedule] = useState(() => {
    const saved = localStorage.getItem('notif_dnd_schedule');
    return saved !== null ? JSON.parse(saved) : { enabled: false, from: '22:00', until: '08:00' };
  });

  const lastConnectedTimeRef = useRef(new Date().toISOString());

  useEffect(() => {
    localStorage.setItem('notif_sound_enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('notif_dnd_schedule', JSON.stringify(dndSchedule));
  }, [dndSchedule]);

  const isDNDActive = useCallback(() => {
    if (!dndSchedule.enabled) return false;
    if (!dndSchedule.from || !dndSchedule.until) return false;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [fromH, fromM] = dndSchedule.from.split(':').map(Number);
    const [untilH, untilM] = dndSchedule.until.split(':').map(Number);
    const fromMins = fromH * 60 + fromM;
    const untilMins = untilH * 60 + untilM;

    if (fromMins <= untilMins) {
      return currentMins >= fromMins && currentMins <= untilMins;
    } else {
      // Overnight (e.g. 22:00 to 08:00)
      return currentMins >= fromMins || currentMins <= untilMins;
    }
  }, [dndSchedule]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!isAuthed) return;
    setLoading(true);
    try {
      const { items: rows, unread: u } = await notificationService.listNotifications({ limit: 50 });
      setItems(rows);
      setUnreadCount(u);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      loadNotifications();
    } else {
      setItems([]);
      setUnreadCount(0);
    }
  }, [isAuthed, loadNotifications]);

  // Handle socket for real-time updates
  useEffect(() => {
    if (!isAuthed) return;
    
    let cancelled = false;
    const socket = callProvider.getSocket();

    const handleNewNotification = (data) => {
      if (cancelled) return;
      setItems((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Chat messages already get a rich toast from GlobalToaster (via the
      // RECEIVE_MESSAGE event), so we must NOT toast them again here — that was
      // the duplicate. We still added the item + bumped unread above, so the
      // notification bell/list stays accurate.
      if (['booking', 'payment', 'receipt', 'rent_receipt'].includes(data.type)) {
        toast.info(data.title || 'New Notification', {
          description: data.body,
          action: {
            label: "দেখুন",
            onClick: () => {
              const { targetId, peerId, peerName, peerAvatar } = data.data || {};
              switch (data.type) {
                case 'message':
                case 'message_new':
                  navigate('/messages', {
                    state: {
                      peerUserId: peerId,
                      peerName: peerName,
                      peerAvatar: peerAvatar,
                      conversationId: targetId || data.data?.conversationId,
                      autoOpen: true
                    }
                  });
                  break;
                case 'booking':
                  navigate('/tenant-dashboard?tab=bookings', { 
                    state: { highlightId: targetId, autoOpen: true, scrollTo: true } 
                  });
                  break;
                case 'payment':
                case 'receipt':
                case 'rent_receipt':
                case 'rent_invoice':
                case 'rent_overdue':
                  navigate('/tenant-dashboard?tab=payments', { 
                    state: { highlightId: targetId, autoOpen: true, scrollTo: true } 
                  });
                  break;
                default:
                  navigate('/notifications');
              }
              // Mark read optimistically when clicked from toast
              setItems((prev) => prev.map((x) => x.id === data.id ? { ...x, read: true } : x));
              setUnreadCount((u) => Math.max(0, u - 1));
              notificationService.markRead(data.id).catch(() => {});
            }
          }
        });
      }
    };

    const handleConnect = async () => {
      try {
        const missed = await chatService.getMissedMessagesCount(lastConnectedTimeRef.current);
        if (!cancelled && missed > 0) {
          setUnreadCount((prev) => prev + missed);
          loadNotifications();
        }
        lastConnectedTimeRef.current = new Date().toISOString();
      } catch { /* silent */ }
    };

    if (socket) {
      // RECEIVE_MESSAGE is owned by GlobalToaster (the message toast). Listening
      // to it here too was double-counting unread on every message, so we only
      // track generic 'new_notification' events for the bell + unread count.
      socket.on('new_notification', handleNewNotification);
      socket.on('connect', handleConnect);
    }

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('new_notification', handleNewNotification);
        socket.off('connect', handleConnect);
      }
    };
  }, [isAuthed, loadNotifications]);

  const markAsRead = async (id) => {
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, read: true } : x));
    setUnreadCount((u) => Math.max(0, u - 1));
    try {
      await notificationService.markRead(id);
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllRead();
    } catch { /* silent */ }
  };

  const shouldPlayChimeOrToast = useCallback(() => {
    if (isDNDActive()) return false;
    return true;
  }, [isDNDActive]);

  const removeNotification = useCallback(async (id) => {
    if (!isAuthed || id == null) return;
    const key = String(id);

    // Optimistic remove FIRST so the row disappears instantly (this is the
    // "it doesn't disappear" fix — we no longer wait on the network, and we
    // compare ids as strings so socket-delivered ObjectId-ish ids still match).
    let removed = null;
    let removedIdx = -1;
    setItems((prev) => {
      removedIdx = prev.findIndex((i) => String(i.id) === key);
      if (removedIdx === -1) return prev;
      removed = prev[removedIdx];
      return prev.filter((i) => String(i.id) !== key);
    });
    if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await notificationService.deleteNotification(key);
    } catch (err) {
      // 404 → already gone on the server; treat as success (stay removed).
      if (err?.status === 404) return;
      // Anything else → roll the row back so nothing is silently lost.
      if (removed) {
        setItems((prev) => {
          if (prev.some((i) => String(i.id) === key)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(removedIdx, 0), next.length), 0, removed);
          return next;
        });
        if (removed && !removed.read) setUnreadCount((c) => c + 1);
      }
      toast.error('Failed to remove notification');
    }
  }, [isAuthed]);

  // Clear every notification for the user (used by the panel's "Clear all").
  const clearAllNotifications = useCallback(async () => {
    if (!isAuthed) return;
    const snapshot = items;
    setItems([]);
    setUnreadCount(0);
    try {
      await Promise.allSettled(snapshot.map((n) => notificationService.deleteNotification(n.id)));
    } catch { /* best-effort */ }
  }, [isAuthed, items]);

  return (
    <NotificationContext.Provider value={{
      items,
      unreadCount,
      loading,
      markAsRead,
      markAllRead,
      removeNotification,
      clearAllNotifications,
      soundEnabled,
      setSoundEnabled,
      dndSchedule,
      setDndSchedule,
      isDNDActive,
      shouldPlayChimeOrToast,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function useNotificationSettings() {
  const { soundEnabled, setSoundEnabled, dndSchedule, setDndSchedule, isDNDActive, shouldPlayChimeOrToast } = useContext(NotificationContext);
  return { soundEnabled, setSoundEnabled, dndSchedule, setDndSchedule, isDNDActive, shouldPlayChimeOrToast };
}
