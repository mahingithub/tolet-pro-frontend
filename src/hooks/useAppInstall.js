/**
 * useAppInstall.js
 * ──────────────────────────────────────────────────────────────────────────
 * Single source of truth for the "get the app" flow, shared by
 * AppDownloadBanner and HeroSection so the smart download logic is never
 * duplicated.
 *
 * Behaviour matrix (final product requirements):
 *   • Android           → Google Play Store listing. No PWA flow at all.
 *   • iPhone            → App Store if APP_STORE_URL is set, else iOS
 *                         Add-to-Home-Screen guide.
 *   • iPad (incl. iPadOS reporting as "Macintosh" — detected via
 *     maxTouchPoints) → same as iPhone; never the Mac guide.
 *   • Mac               → App Store if MAC_APP_URL is set, else PWA install
 *                         prompt (Chrome/Edge) or Safari Add-to-Dock guide.
 *   • Windows/desktop   → PWA install prompt when supported, otherwise an
 *                         honest "not supported" fallback (no misleading
 *                         instructions).
 *
 * The `beforeinstallprompt` event is captured at module load (not inside a
 * React effect) so it is never lost when Chrome fires it before mount.
 */

import { useCallback, useEffect, useState } from 'react';
import { isStandalonePwa } from '../utils/platform';

// ── Store URLs ─────────────────────────────────────────────────────────────
// When the iOS / macOS apps are published, set these URLs and every Apple
// device automatically switches from the PWA guide to the store link.
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tolet.pro';
export const APP_STORE_URL = null;  // e.g. 'https://apps.apple.com/app/id…'
export const MAC_APP_URL = null;    // macOS download / Mac App Store, if ever

// ── Safe localStorage helpers ──────────────────────────────────────────────
// localStorage can throw (private browsing, storage disabled).
export function safeStorageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function safeStorageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

// ── Module-level beforeinstallprompt capture ───────────────────────────────
// Chrome may fire the event before React mounts; a listener registered at
// import time never misses it. Subscribers (the hook) are notified so state
// stays in sync.
let capturedPrompt = null;
const promptSubscribers = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // On Android we only ever send users to the Play Store — let Chrome keep
    // its default behaviour there and don't capture/suppress anything.
    if (/android/i.test(navigator.userAgent || '')) return;
    e.preventDefault(); // stop the default mini-infobar
    capturedPrompt = e;
    promptSubscribers.forEach((fn) => fn(e));
  });
}

// ── Platform detection ─────────────────────────────────────────────────────
/** @returns {'android'|'ios'|'ipad'|'mac'|'desktop'} */
export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipod/i.test(ua)) return 'ios';
  if (/ipad/i.test(ua)) return 'ipad';
  // iPadOS 13+ masquerades as Macintosh; real Macs have no touch points.
  if (/macintosh/i.test(ua)) {
    return (navigator.maxTouchPoints || 0) > 1 ? 'ipad' : 'mac';
  }
  return 'desktop';
}

/** True inside the native app (Android WebView wrapper or Capacitor shell). */
export function isInsideNativeApp() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/ToLetProApp/i.test(ua)) return true;
  try {
    const cap = window.Capacitor;
    return !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative));
  } catch {
    return false;
  }
}

/** True when the banner should never appear: native app or installed PWA. */
export function isAppAlreadyInstalled() {
  return isInsideNativeApp() || isStandalonePwa();
}

// ── Shared guide modal event ───────────────────────────────────────────────
// AppDownloadBanner owns the install-guide modal and is always mounted. Other
// callers (HeroSection) ask it to open via this event instead of duplicating
// the modal UI.
export const INSTALL_GUIDE_EVENT = 'toletpro:show-install-guide';

/** @param {'guide-ios'|'guide-mac'|'unsupported'} result */
export function requestInstallGuide(result) {
  const guide = result === 'guide-ios' ? 'ios' : result === 'guide-mac' ? 'mac' : 'unsupported';
  window.dispatchEvent(new CustomEvent(INSTALL_GUIDE_EVENT, { detail: guide }));
}

// ── The hook ───────────────────────────────────────────────────────────────
/**
 * @returns {{
 *   platform: 'android'|'ios'|'ipad'|'mac'|'desktop',
 *   canPromptInstall: boolean,
 *   installed: boolean,
 *   triggerDownload: () => Promise<'store'|'prompted-accepted'|'prompted-cancelled'|'guide-ios'|'guide-mac'|'unsupported'>,
 * }}
 *
 * `triggerDownload()` performs the store redirect / install prompt itself and
 * returns what happened so callers can render the right follow-up UI
 * (guides, fallback message, hide-on-success…).
 */
export function useAppInstall() {
  const [platform] = useState(detectPlatform);
  const [deferredPrompt, setDeferredPrompt] = useState(() => capturedPrompt);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => setDeferredPrompt(e);
    promptSubscribers.add(onPrompt);

    const onInstalled = () => {
      capturedPrompt = null;
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      promptSubscribers.delete(onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const triggerDownload = useCallback(async () => {
    // Native store links win whenever available.
    if (platform === 'android') {
      window.open(PLAY_STORE_URL, '_blank', 'noopener');
      return 'store';
    }
    if ((platform === 'ios' || platform === 'ipad') && APP_STORE_URL) {
      window.open(APP_STORE_URL, '_blank', 'noopener');
      return 'store';
    }
    if (platform === 'mac' && MAC_APP_URL) {
      window.open(MAC_APP_URL, '_blank', 'noopener');
      return 'store';
    }

    // Real PWA install prompt (Chrome/Edge on desktop or Mac).
    if (deferredPrompt) {
      deferredPrompt.prompt();
      let outcome = 'dismissed';
      try { outcome = (await deferredPrompt.userChoice)?.outcome; } catch { /* ignore */ }
      capturedPrompt = null;
      setDeferredPrompt(null);
      return outcome === 'accepted' ? 'prompted-accepted' : 'prompted-cancelled';
    }

    // Manual guides — iOS/iPadOS never fire beforeinstallprompt; neither does
    // Safari on Mac (which does support Add to Dock).
    if (platform === 'ios' || platform === 'ipad') return 'guide-ios';
    if (platform === 'mac') {
      const ua = navigator.userAgent || '';
      const isSafari = /safari/i.test(ua) && !/chrome|crios|edg|firefox|fxios/i.test(ua);
      return isSafari ? 'guide-mac' : 'unsupported';
    }

    // Desktop browser with no install support (e.g. Firefox) — be honest.
    return 'unsupported';
  }, [platform, deferredPrompt]);

  return {
    platform,
    canPromptInstall: !!deferredPrompt,
    installed,
    triggerDownload,
  };
}
