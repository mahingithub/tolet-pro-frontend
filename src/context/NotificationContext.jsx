import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import notificationService from '../services/notificationService';
import chatService from '../services/chatService';
import callProvider from '../services/callProvider';
import { useAuth } from './AuthContext'; // Need to make sure AuthContext exists and can be imported

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
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

    const handleReceiveMessage = (data) => {
      if (cancelled) return;
      setUnreadCount((prev) => prev + 1);
      
      // Try to load new notifications if a new message comes in,
      // or we can just mock it if we don't want to hit the API every time.
      // Easiest is to reload:
      loadNotifications();
      lastConnectedTimeRef.current = new Date().toISOString();
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
      socket.on('RECEIVE_MESSAGE', handleReceiveMessage);
      socket.on('connect', handleConnect);
    }

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('RECEIVE_MESSAGE', handleReceiveMessage);
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

  return (
    <NotificationContext.Provider value={{
      items,
      unreadCount,
      loading,
      markAsRead,
      markAllRead,
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
