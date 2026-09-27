import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { broadcast, readJson, subscribe, writeJson } from '../services/_storage.js';

/**
 * "Dismiss" on a dashboard notice means never again — on any device.
 *
 * The tenant's "You're verified" card used to have only an X, and the X was a
 * 7-day snooze kept in one browser's localStorage: it came back every week, on
 * the phone, and after every reinstall. Dismissals are now kept twice:
 *
 *   • on this device, per account — instant, works offline, and still hides
 *     the notice while the server is unreachable or running a build that
 *     doesn't know the field yet;
 *   • on the account (preferences.app.dismissedNotices) — so the phone and the
 *     website agree. The server merges rather than replaces, so two devices
 *     can't undo each other.
 *
 * A notice is hidden if EITHER copy has it. Ids only this device knows about
 * are pushed up once the account's settings have loaded.
 *
 * Ids are "<surface>.<notice>[.<state>]", e.g. 'tenant.verification.verified'.
 */

const CAP = 50; // matches NOTICE_CAP in the backend's privacy.controller
const localKey = (uid) => `dismissed-notices:${uid || 'guest'}`;
const readLocal = (uid) => {
  const v = readJson(localKey(uid), []);
  return Array.isArray(v) ? v : [];
};
const union = (...lists) => [...new Set(lists.flat())].slice(-CAP);

export default function useDismissedNotices() {
  const { user } = useAuth();
  const uid = user?.id || user?._id || null;
  const { settings, loading, update } = useSettings();
  const remoteRaw = settings?.app?.dismissedNotices;
  const remote = useMemo(() => (Array.isArray(remoteRaw) ? remoteRaw : []), [remoteRaw]);

  // This device's copy, read straight from storage so it follows an account
  // switch and a dismissal in another tab. The snapshot is a string, so React
  // can compare it by value.
  const key = localKey(uid);
  const subscribeLocal = useCallback((cb) => subscribe(key, cb), [key]);
  const localRaw = useSyncExternalStore(subscribeLocal, () => JSON.stringify(readLocal(uid)));
  const local = useMemo(() => JSON.parse(localRaw), [localRaw]);

  const dismissed = useMemo(() => new Set([...remote, ...local]), [remote, local]);

  // Always send the whole known list: settings' optimistic merge REPLACES
  // arrays, so sending only the new id would briefly un-hide the others.
  const push = useCallback((ids) => {
    if (!uid) return;
    update({ app: { dismissedNotices: ids } }).catch(() => {});
  }, [uid, update]);

  const dismiss = useCallback((...ids) => {
    const add = ids.filter((id) => typeof id === 'string' && id);
    if (!add.length) return;
    // Re-read storage rather than trusting `local`, so two dismissals in one
    // tick (the legacy-key migration does that) can't overwrite each other.
    const next = union(readLocal(uid), add);
    writeJson(key, next);
    broadcast(key);
    push(union(remote, next));
  }, [uid, key, remote, push]);

  // Push up whatever this device holds that the account doesn't — a dismissal
  // made offline, or before the server knew the field. Once per account per
  // mount: an older server echoes the list back without it, and retrying on
  // every render would loop.
  const synced = useRef(null);
  useEffect(() => {
    if (!uid || loading || synced.current === uid) return;
    synced.current = uid;
    const mine = readLocal(uid);
    if (mine.some((id) => !remote.includes(id))) push(union(remote, mine));
  }, [uid, loading, remote, push]);

  const isDismissed = useCallback((id) => dismissed.has(id), [dismissed]);

  // Logout wipes this device's copy (authService.clearAllAppData keeps only
  // device prefs), so right after sign-in only the account knows what was
  // dismissed. Until its settings arrive, `ready` is false and callers should
  // hold the notice back rather than flash it and snatch it away.
  const ready = !loading;

  return { isDismissed, dismiss, ready };
}
