import { PLAY_STORE_URL, absoluteUrl } from '../seo/siteConfig';

/**
 * appUpdate — "is the installed app out of date, and how badly?"
 * ──────────────────────────────────────────────────────────────────────────
 * A Play Store update is SILENT. Nothing in the app tells a tester that a build
 * with their bug fixed is sitting one tap away, so they keep using the broken
 * one and reporting the same thing. This is the missing nudge.
 *
 * WHERE THE ANSWER COMES FROM: public/app-version.json, served by the website.
 *
 * Why a static file on Vercel rather than the backend: it deploys with the
 * frontend that is already redeployed every release, it needs no endpoint, no
 * auth and no Render restart, and it cannot take the API down with it. The one
 * thing it needs is a CORS header, because the installed app's origin is
 * `https://localhost` and a plain Vercel static file sends none — see the
 * /app-version.json rule in vercel.json.
 *
 * WHY NOT the Play In-App Updates API: its IMMEDIATE flow is Google's own
 * screen with Google's own wording. We want Bengali copy that says what was
 * fixed, which means our own UI.
 *
 * WHY NOT Capgo (@capgo/capacitor-updater, initialised in main.jsx): that
 * swaps the JS bundle over the air and never changes the native versionCode.
 * The two do not conflict — this one is strictly about the native build a user
 * has installed — but do not wire them together expecting one to report the
 * other.
 *
 * TWO LEVELS, because "always blocking" is a footgun:
 *   required     current < minSupportedVersionCode → a screen with no way out.
 *                Reserve it for builds that are genuinely unusable; a wrong
 *                number here locks every tester out until you redeploy.
 *   recommended  current < latestVersionCode → a sheet they can postpone, which
 *                comes back after SNOOZE_MS.
 */

const MANIFEST_URL = absoluteUrl('/app-version.json');
const SNOOZE_KEY = 'tlpUpdateSnoozedUntil';
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

/** Android versionCode of the running build, or null off native. */
async function currentVersionCode() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor?.isNativePlatform?.()) return null;
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    // AppInfo.build is the versionCode on Android, as a string.
    const code = Number.parseInt(info?.build, 10);
    return Number.isFinite(code) ? code : null;
  } catch {
    return null;
  }
}

async function fetchManifest() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // cache: 'no-store' so a phone that checked yesterday is not told yesterday's
    // answer by the service worker or the HTTP cache.
    const res = await fetch(MANIFEST_URL, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Offline, DNS down, malformed JSON — all mean "say nothing". An update
    // prompt is never worth breaking the app over.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function isSnoozed() {
  try {
    const until = Number.parseInt(window.localStorage.getItem(SNOOZE_KEY) || '0', 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function snooze() {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* private mode — the sheet simply shows again next launch */
  }
}

function clearSnooze() {
  try {
    window.localStorage.removeItem(SNOOZE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * @returns {Promise<{status:'none'|'recommended'|'required', currentCode:number|null,
 *                    latestCode:number|null, latestName:string, notes:{bn:string[],en:string[]}}>}
 */
export async function checkForUpdate() {
  const none = { status: 'none', currentCode: null, latestCode: null, latestName: '', notes: { bn: [], en: [] } };

  const currentCode = await currentVersionCode();
  if (currentCode == null) return none; // web build, or the bridge is missing

  const manifest = await fetchManifest();
  if (!manifest) return none;

  const latestCode = Number.parseInt(manifest.latestVersionCode, 10);
  const minCode = Number.parseInt(manifest.minSupportedVersionCode, 10);
  const notes = {
    bn: Array.isArray(manifest?.notes?.bn) ? manifest.notes.bn : [],
    en: Array.isArray(manifest?.notes?.en) ? manifest.notes.en : [],
  };
  const base = { currentCode, latestCode: Number.isFinite(latestCode) ? latestCode : null,
                 latestName: String(manifest.latestVersionName || ''), notes };

  if (Number.isFinite(minCode) && currentCode < minCode) {
    // A blocking update outranks any postponement the user made earlier.
    clearSnooze();
    return { ...base, status: 'required' };
  }
  if (Number.isFinite(latestCode) && currentCode < latestCode) {
    return { ...base, status: 'recommended' };
  }
  return none;
}

/**
 * Open this app's Play Store page. An https play.google.com link is itself an
 * Android App Link, so the Play app opens directly — no market:// scheme
 * needed, and it degrades to the browser if Play is unavailable. Same call
 * hooks/useAppInstall.js already uses.
 */
export function openStore() {
  window.open(PLAY_STORE_URL, '_blank', 'noopener');
}
