import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import notificationService from '../services/notificationService';
import callProvider from '../services/callProvider';
import useAudioChime from '../hooks/useAudioChime';
import { useAuth } from './AuthContext'; // Need to make sure AuthContext exists and can be imported
import { notificationDestination, isLandlordMode } from '../utils/notificationRoute';

const NotificationContext = createContext();

// Types allowed to interrupt with a toast. Chat is deliberately ABSENT —
// GlobalToaster renders a richer message toast off RECEIVE_MESSAGE, and both
// firing produces a duplicate. Read by the socket handler and by the
// foreground-push handler, which must agree or the exclusion above leaks.
const TOASTABLE = ['booking', 'payment', 'receipt', 'rent_receipt', 'rent_updated', 'marketing', 'tenant_onboarding'];

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const { user } = auth;
  const navigate = useNavigate();
  const isAuthed = !!user;
  // Recomputed on every role switch, so a toast that arrives after the user
  // flips the mode pill routes to the dashboard they are actually looking at.
  const isLandlord = isLandlordMode(auth);
  const myId = user?.id || user?._id || '';

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

  // ─── Toast de-duplication ────────────────────────────────────────────────
  // The SAME notification can now arrive twice on a native device: once over
  // the socket (the in-app channel) and once as an FCM push delivered to the
  // foreground (see services/nativePush.js). An admin blast that selects both
  // channels does exactly this, and two identical toasts stacked on top of each
  // other is worse than the silence it replaced.
  //
  // Keyed on CONTENT, not id: a marketing push carries no notificationId (the
  // blast calls firebaseAdmin directly rather than going through emit()), so
  // there is no shared identifier to join on. Whichever transport arrives first
  // toasts and claims the key; the other is dropped.
  const recentToastsRef = useRef(new Map());
  const TOAST_DEDUPE_MS = 15000;

  // A synchronous mirror of `items`, so a socket handler can ask "do I already
  // hold this row?" without reaching into a state updater to find out.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const claimToast = useCallback((data) => {
    const key = `${data?.type || ''}|${data?.title || ''}|${data?.body || ''}`;
    const now = Date.now();
    const seen = recentToastsRef.current;
    // Sweep on read — this map is touched a handful of times per session, so a
    // timer to prune it would cost more than it saves.
    for (const [k, at] of seen) if (now - at > TOAST_DEDUPE_MS) seen.delete(k);
    if (seen.has(key)) return false;
    seen.set(key, now);
    return true;
  }, []);

  // ─── The alert sound ─────────────────────────────────────────────────────
  // Every toast raised below is accompanied by the chime, because a toast on
  // its own is only a notification for someone who happens to be looking at the
  // screen. Until this existed, `playChime` had exactly ONE caller in the whole
  // app — GlobalToaster's chat handler — so a rent receipt, a booking, a tenant
  // onboarding request and an admin offer all arrived in total silence. That is
  // the "notifications don't make a sound" report: they were never meant to be
  // silent, nothing was ever wired up to make them audible.
  //
  // Read through a ref rather than added to the socket effect's deps: toggling
  // Sound in settings would otherwise tear down and re-bind the notification
  // listener, and the handler only ever reads this at fire time anyway.
  const playChime = useAudioChime();
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Quiet hours silence the SOUND for everything, not just promos. The toast
  // itself is governed separately below (transactional toasts still show during
  // DND — the information is wanted, the noise is not), which is the same split
  // the server makes when it downgrades a push to the silent channel rather
  // than dropping it. `soundEnabled` mirrors preferences.notifications.sound,
  // synced from the server by SharedSettings.
  const alertChime = useCallback(() => {
    if (!soundEnabledRef.current) return;
    if (isDNDActive()) return;
    playChime();
  }, [playChime, isDNDActive]);

  // Handle socket for real-time updates
  useEffect(() => {
    if (!isAuthed) return;

    let cancelled = false;
    const socket = callProvider.getSocket();

    const handleNewNotification = (data) => {
      if (cancelled) return;
      // Prepend only if the row isn't already held. Two things can insert the
      // same notification: this event, and a loadNotifications() refetch — from
      // the 'connect' handler below, or from the foreground-push effect. When a
      // refetch lands first, an unguarded prepend produced a duplicate row in
      // the bell and an unread count one too high, which never self-corrected
      // until a remount.
      //
      // Checked against a ref rather than inside the setItems updater: the
      // updater must stay a pure function of `prev` (React may invoke it twice),
      // so it is not somewhere to compute a flag that setUnreadCount then reads.
      if (data?.id && itemsRef.current.some((x) => String(x.id) === String(data.id))) return;
      setItems((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Chat messages already get a rich toast from GlobalToaster (via the
      // RECEIVE_MESSAGE event), so we must NOT toast them again here — that was
      // the duplicate. We still added the item + bumped unread above, so the
      // notification bell/list stays accurate.
      //
      // 'marketing' (admin Subscriptions → Send Offer) must be in this list: the
      // admin console advertises the in-app channel as a live pop-up, but
      // without it an offer only ever appeared silently in the bell list, which
      // read as "notifications aren't going through".
      //
      // 'rent_updated' too — the landlord changed this tenant's rent or lease
      // terms, which is at least as worth interrupting for as a receipt.
      //
      // 'tenant_onboarding' as well, in both directions: to the landlord it is
      // a person standing in a room waiting to be let in, and to the tenant it
      // is the answer to a form they filled in with their NID on it. Both are
      // as time-sensitive as anything else on this list, and neither was
      // surfacing at all until it was added here.
      //
      // Hoisted to module scope (TOASTABLE) because the foreground-push effect
      // below has to make the identical decision — most importantly the
      // exclusion of chat, which GlobalToaster owns and which would otherwise
      // toast twice on a native device.

      // DND applies to PROMOTIONAL traffic only. The rest of this list is
      // transactional — a rent receipt or an overdue notice is exactly what a
      // tenant wants to see the moment it happens, and silencing those on a
      // schedule meant for offers would be a regression. The row and unread
      // count are recorded above either way, so a held-back toast loses nothing.
      const isPromotional = data.type === 'marketing';
      if (TOASTABLE.includes(data.type) && !(isPromotional && isDNDActive()) && claimToast(data)) {
        alertChime();
        toast.info(data.title || 'New Notification', {
          description: data.body,
          action: {
            label: "দেখুন",
            onClick: () => {
              // One routing table, shared with the bell dropdown
              // (NotificationPanel). This switch used to be a second copy that
              // hardcoded /tenant-dashboard for every type — so a landlord who
              // tapped a payment toast was sent to the tenant dashboard — and
              // pointed at `?tab=bookings`, a tab the tenant dashboard does not
              // have, which useTabHistory silently resolved to `overview`.
              const { path, state } = notificationDestination(data, {
                isLandlord,
                userId: myId,
              });
              navigate(path, state ? { state } : undefined);
              // Mark read optimistically when clicked from toast
              setItems((prev) => prev.map((x) => x.id === data.id ? { ...x, read: true } : x));
              setUnreadCount((u) => Math.max(0, u - 1));
              notificationService.markRead(data.id).catch(() => {});
            }
          }
        });
      }
    };

    const handleConnect = () => {
      // Refetch unconditionally on reconnect. ANY notification delivered while
      // the socket was down was missed, not just chat messages — this used to
      // call chatService.getMissedMessagesCount() and refetch only when that
      // was > 0, so an admin offer (or a rent update) sent during a reconnect
      // window stayed invisible until a full remount.
      //
      // loadNotifications() reads both the list and the unread count from the
      // server, so it is the authoritative catch-up; the optimistic
      // setUnreadCount() that used to run here was overwritten by it anyway.
      if (cancelled) return;
      loadNotifications();
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
    // isDNDActive is a dependency because the toast gate above reads it; it only
    // changes when the user edits their DND schedule, so the listener churn is
    // negligible. `isLandlord` / `myId` are read by the toast's routing and
    // change only on a role switch or re-login, for the same reason. `alertChime`
    // is stable for the same reason isDNDActive is — note it deliberately does
    // NOT depend on `soundEnabled`, which is read through a ref.
  }, [isAuthed, loadNotifications, isDNDActive, isLandlord, myId, navigate, claimToast, alertChime]);

  // ─── Foreground push (native only) ───────────────────────────────────────
  // On Android the OS posts nothing while the app is open, so without this a
  // push aimed at an active user vanished entirely. Surfaced as a toast, which
  // is the same thing the socket path does — and deduped against it, because a
  // campaign that picks both in-app AND push delivers both to this device.
  //
  // The list is refetched rather than optimistically prepended: a push payload
  // is not a Notification row and a marketing one has no id at all, so pushing
  // it into `items` would seed a row that markAsRead and removeNotification
  // cannot act on. The server already holds the real row when the in-app
  // channel was used; when it wasn't, there is correctly nothing to add.
  useEffect(() => {
    if (!isAuthed) return undefined;
    let cancelled = false;
    let detach = null;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (cancelled || !Capacitor.isNativePlatform()) return;
      const { setPushForegroundHandler } = await import('../services/nativePush');
      if (cancelled) return;

      detach = setPushForegroundHandler((data) => {
        if (!TOASTABLE.includes(data.type)) return;
        const isPromotional = data.type === 'marketing';
        if (isPromotional && isDNDActive()) return;
        if (!claimToast(data)) return;

        loadNotifications();
        // A foreground push posts NOTHING to the Android shade, so this toast
        // and this chime are the entire notification. Without the sound the
        // user's only cue is a banner they have to already be looking at.
        alertChime();
        toast.info(data.title || 'New Notification', {
          description: data.body,
          action: {
            label: 'দেখুন',
            onClick: () => {
              const { path, state } = notificationDestination(data, { isLandlord, userId: myId });
              navigate(path, state ? { state } : undefined);
            },
          },
        });
      });
    })();

    return () => {
      cancelled = true;
      if (detach) detach();
    };
  }, [isAuthed, isDNDActive, claimToast, loadNotifications, isLandlord, myId, navigate, alertChime]);

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
