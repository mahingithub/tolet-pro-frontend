import React, {
  createContext, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState, useCallback,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { isInsideNativeApp } from '../hooks/useAppInstall';
import {
  DEFAULT_SETTINGS,
  getCachedSettings,
  getSettings,
  updateSettings as svcUpdateSettings,
  mergeSettings,
  onSettingsChanged,
} from '../services/settingsService.js';

/**
 * SettingsContext — the app-wide source of truth for the global settings hub.
 * ──────────────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Hydrate from the local cache instantly (no flash), then refresh from
 *      the backend once we know who the user is.
 *   2. Expose `settings` (fully-defaulted) + `update(patch)` to the whole app.
 *   3. Apply the *global* side-effects that a settings change implies —
 *      the colour theme (light/dark/system) and reduced-motion — at the
 *      document root so they take effect everywhere immediately.
 *
 * Per-scope consumption (e.g. tenant search defaults, landlord auto-reply)
 * is left to the individual feature that owns it; this provider just keeps
 * the values loaded, synced and persisted.
 */

const SettingsContext = createContext(null);

// ─── Global side-effect appliers ────────────────────────────────────────────

function resolveTheme(theme) {
  // AN EXPLICIT CHOICE IS HONOURED EVERYWHERE, app included. The switcher is
  // back in the app (App.jsx renders ThemeWidget on every screen but login),
  // and a control that reports a preference it quietly refuses to apply is
  // worse than no control at all.
  if (theme === 'light' || theme === 'dark') return theme;

  // 'system' IS THE DEFAULT, AND IN THE APP IT MEANS LIGHT — not the OS.
  //
  // Nineteen of the ~317 files under src/ carry any `dark:` styles. Resolving
  // 'system' against the phone would therefore hand every user whose Android
  // is in dark mode a half-converted app they never asked for, silently, on
  // first launch. Dark stays something you choose, not something you are given.
  //
  // Widen this to the OS once the screens are actually styled for it; nothing
  // else has to change.
  if (isInsideNativeApp()) return 'light';

  // The WEBSITE follows the OS as it always has: on a desktop browser the
  // theme is the reader's, not ours.
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effective = resolveTheme(theme);
  root.classList.toggle('dark', effective === 'dark');
  // Native form controls, scrollbars and the UA background follow this even
  // before any component ships `dark:` styles — so the toggle is never a
  // silent no-op.
  root.style.colorScheme = effective;
  root.setAttribute('data-theme', effective);
}

function applyMotion(reduce) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', !!reduce);
  document.documentElement.setAttribute('data-reduce-motion', reduce ? 'true' : 'false');
}

export const SettingsProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || user?._id || null;

  // Start from the cache so the first paint already reflects saved prefs.
  const [settings, setSettings] = useState(() => getCachedSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Load from backend whenever the signed-in identity changes ──────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getSettings();
      setSettings(fresh);
      return fresh;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fresh = await getSettings();
        if (!cancelled) setSettings(fresh);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Re-run on login/logout and on user switch.
  }, [isAuthenticated, userId]);

  // ── Cross-tab sync (another tab saved a setting) ───────────────────────
  useEffect(() => {
    return onSettingsChanged(() => setSettings(getCachedSettings()));
  }, []);

  // ── Persist a partial patch (optimistic) ───────────────────────────────
  const update = useCallback(async (patch) => {
    setSaving(true);
    // Optimistic: reflect immediately in the UI.
    setSettings((prev) => mergeSettings(prev, patch));
    try {
      const merged = await svcUpdateSettings(patch);
      setSettings(merged);
      return merged;
    } catch (err) {
      // Validation failure — resync to the authoritative state and rethrow
      // so the caller can surface the message.
      const fresh = getCachedSettings();
      setSettings(fresh);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Apply global side-effects (theme + motion) ─────────────────────────
  // useLayoutEffect so the class is on <html> before the browser paints,
  // avoiding a light→dark flash.
  useLayoutEffect(() => { applyTheme(settings.theme); }, [settings.theme]);
  useLayoutEffect(() => { applyMotion(settings.app?.reduceMotion); }, [settings.app?.reduceMotion]);

  // Keep 'system' theme reactive to OS changes while selected.
  useEffect(() => {
    if (settings.theme !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [settings.theme]);

  const value = useMemo(() => ({
    settings,
    defaults: DEFAULT_SETTINGS,
    loading,
    saving,
    update,
    reload,
  }), [settings, loading, saving, update, reload]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
};
