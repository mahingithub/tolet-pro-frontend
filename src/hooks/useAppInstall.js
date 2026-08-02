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

/**
 * Event-driven grace period for the install prompt. Resolves IMMEDIATELY when
 * `beforeinstallprompt` has already been captured or the moment it arrives —
 * the timeout is only an upper bound for the "event never comes" case, so a
 * click can never be delayed longer than the event actually takes.
 * @returns {Promise<Event|null>}
 */
function waitForInstallPrompt(maxWaitMs = 400) {
  if (capturedPrompt) return Promise.resolve(capturedPrompt);
  return new Promise((resolve) => {
    let timer = null;
    const onPrompt = (e) => {
      clearTimeout(timer);
      promptSubscribers.delete(onPrompt);
      resolve(e); // event-driven: fires the instant the browser delivers it
    };
    promptSubscribers.add(onPrompt);
    timer = setTimeout(() => {
      promptSubscribers.delete(onPrompt);
      resolve(null);
    }, maxWaitMs);
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

/**
 * Chromium-based browser (Chrome, Edge, Brave, Opera…)? These DO support PWA
 * install, so a missing `beforeinstallprompt` there means "already installed
 * or not offered right now" — never "unsupported".
 */
export function isChromiumBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // CriOS/EdgiOS are iOS shells over WebKit — not real Chromium.
  if (/crios|edgios|fxios/i.test(ua)) return false;
  return /chrome|chromium|edg\/|opr\//i.test(ua);
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

/** @param {'guide-ios'|'guide-mac'|'chromium-menu'|'unsupported'} result */
export function requestInstallGuide(result) {
  const guide =
    result === 'guide-ios' ? 'ios' :
    result === 'guide-mac' ? 'mac' :
    result === 'chromium-menu' ? 'chromium' : 'unsupported';
  window.dispatchEvent(new CustomEvent(INSTALL_GUIDE_EVENT, { detail: guide }));
}

// ── The hook ───────────────────────────────────────────────────────────────
/**
 * @returns {{
 *   platform: 'android'|'ios'|'ipad'|'mac'|'desktop',
 *   canPromptInstall: boolean,
 *   installed: boolean,
 *   triggerDownload: () => Promise<'store'|'prompted-accepted'|'prompted-cancelled'|'guide-ios'|'guide-mac'|'chromium-menu'|'unsupported'>,
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

    // Real PWA install prompt (Chrome/Edge on desktop or Mac). If the event
    // hasn't arrived yet, wait for it event-driven with a short upper bound —
    // resolves the instant the browser delivers it, never a fixed delay.
    const prompt = deferredPrompt || await waitForInstallPrompt();
    if (prompt) {
      prompt.prompt();
      let outcome = 'dismissed';
      try { outcome = (await prompt.userChoice)?.outcome; } catch { /* ignore */ }
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
      if (isSafari) return 'guide-mac';
    }

    // Chromium without a prompt ≠ unsupported: Chrome suppresses the event
    // when it considers the app already installed (e.g. added via Safari on
    // this Mac) or chooses not to offer it. Point to the Dock/menu instead of
    // claiming — falsely — that the browser can't install.
    if (isChromiumBrowser()) return 'chromium-menu';

    // Genuinely non-installing browser (e.g. Firefox) — be honest.
    return 'unsupported';
  }, [platform, deferredPrompt]);

  return {
    platform,
    canPromptInstall: !!deferredPrompt,
    installed,
    triggerDownload,
  };
}
