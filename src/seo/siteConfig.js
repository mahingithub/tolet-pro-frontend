/**
 * siteConfig.js — one place for everything a search engine, a social card
 * unfurler or a structured-data validator needs to know about TO-LET PRO.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  THE CANONICAL HOST IS `www.toletpro.rent`.
 *
 * `tolet-pro.vercel.app` is DEAD (404 — see DEEP_LINKS.md), and the apex
 * `toletpro.rent` 308-redirects to www. Every canonical URL, sitemap entry,
 * og:url and JSON-LD @id in this app is built from SITE_URL below, so this
 * constant is the single switch if the domain ever moves again.
 *
 * This module is imported by BOTH the React app and the Node build scripts
 * (scripts/generate-sitemap.mjs, scripts/prerender-seo.mjs), so it must stay
 * free of any browser or React import.
 */

export const SITE_URL = 'https://www.toletpro.rent';

export const BRAND = 'TO-LET PRO';
export const BRAND_BN = 'টু-লেট প্রো';

/** Legal/company name used in Organization structured data. */
export const ORG_NAME = 'TO-LET PRO';

/**
 * Social card image. 1024×500 is inside the 1.91:1 window Facebook/LinkedIn
 * want, so it renders as a large card rather than a thumbnail.
 * TODO(marketing): a purpose-built 1200×630 `/og-image.png` would look sharper.
 */
export const OG_IMAGE = `${SITE_URL}/feature_graphic.png`;
export const OG_IMAGE_WIDTH = 1024;
export const OG_IMAGE_HEIGHT = 500;

export const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;

/** Public contact + social profiles — these become Organization.sameAs. */
export const CONTACT_PHONE = '+8801742898206';
export const SOCIAL_PROFILES = [
  'https://www.facebook.com/profile.php?id=61593003425206',
  'https://www.youtube.com/channel/UC7mc__2GpSdoqUMglb7BS8g',
  'https://www.instagram.com/toletpro.rent/',
];

/** Play Store listing — used by the SoftwareApplication schema. */
export const ANDROID_APP_ID = 'com.toletpro.app';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;

export const DEFAULT_LOCALE = 'bn_BD';
export const ALTERNATE_LOCALE = 'en_US';

/** Join a path onto the canonical host, tolerating a missing leading slash. */
export const absoluteUrl = (path = '/') => {
  const p = String(path || '/');
  if (/^https?:\/\//i.test(p)) return p;
  return `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`;
};
