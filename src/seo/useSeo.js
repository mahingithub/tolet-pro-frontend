/**
 * useSeo.js — per-route <head> for a client-rendered SPA.
 * ─────────────────────────────────────────────────────────────────────────────
 * Before this hook every route in TO-LET PRO shipped the SAME title, the same
 * description and a canonical pointing at a dead domain. To a crawler that
 * reads as one page, so only one page could ever rank.
 *
 * `useSeo` rewrites title / description / keywords / canonical / robots /
 * Open Graph / Twitter / hreflang and injects JSON-LD for whatever route is
 * mounted, then puts the document back exactly as index.html left it when that
 * route unmounts. The baseline is snapshotted once at module load, so a
 * restore can never "restore" another route's values.
 *
 * Deliberately hand-rolled rather than react-helmet-async: this is ~120 lines,
 * has no provider to thread through the tree, and adds nothing to the bundle
 * that ships to a renter on a 3G connection.
 *
 * Usage:
 *   useSeo({
 *     title: 'Flat rent in Dhaka',
 *     description: '…',
 *     canonical: '/properties/dhaka',
 *     jsonLd: [breadcrumbSchema(…), faqSchema(…)],
 *   });
 */

import { useEffect } from 'react';
import {
  SITE_URL, BRAND, OG_IMAGE, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT,
  DEFAULT_LOCALE, ALTERNATE_LOCALE, absoluteUrl,
} from './siteConfig';

/** Tags this hook owns get stamped so cleanup never touches anything else. */
const OWNED = 'data-seo-managed';

/* ── low-level head helpers ──────────────────────────────────────────────── */

const head = () => document.head || document.getElementsByTagName('head')[0];

/**
 * Find (or create) a <meta>/<link> matched by one attribute, and set its
 * content. Passing `null` content removes a tag this hook created, and reverts
 * a tag that shipped in index.html to its original value.
 */
function upsert(tag, keyAttr, keyValue, valueAttr, value) {
  const selector = `${tag}[${keyAttr}="${keyValue}"]`;
  let el = document.querySelector(selector);
  if (value == null || value === '') {
    // Only remove tags we created ourselves; index.html's stay put.
    if (el && el.hasAttribute(OWNED)) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(keyAttr, keyValue);
    el.setAttribute(OWNED, '');
    head().appendChild(el);
  }
  el.setAttribute(valueAttr, value);
}

const setName = (name, content) => upsert('meta', 'name', name, 'content', content);
const setProp = (property, content) => upsert('meta', 'property', property, 'content', content);

function setCanonical(url) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!url) return;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    el.setAttribute(OWNED, '');
    head().appendChild(el);
  }
  el.setAttribute('href', url);
}

/**
 * hreflang. TO-LET PRO serves both languages from ONE URL (the language toggle
 * is client-side state, not a route), so the honest signal is a self-referential
 * pair plus x-default — it tells Google the page serves bn-BD and en-BD readers
 * without inventing /bn/ and /en/ URLs that do not exist.
 *
 * Clears EVERY hreflang link, not just the ones this hook created: index.html
 * (and each prerendered page) ships its own set pointing at that page's URL,
 * and leaving those in place alongside the new ones produced six alternates
 * per page, half of them naming the wrong URL. The baseline is restored on
 * cleanup, so the homepage's static tags survive an unmount.
 */
const clearAlternates = () =>
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());

function addAlternates(url) {
  if (!url) return;
  [['bn-BD', url], ['en-BD', url], ['x-default', url]].forEach(([lang, href]) => {
    const el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', lang);
    el.setAttribute('href', href);
    el.setAttribute(OWNED, '');
    head().appendChild(el);
  });
}

function setAlternates(url) {
  clearAlternates();
  addAlternates(url);
}

function setJsonLd(blocks) {
  document.querySelectorAll('script[data-seo-jsonld]').forEach((n) => n.remove());
  const list = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean);
  list.forEach((block, i) => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo-jsonld', String(i));
    // JSON.stringify escapes nothing dangerous on its own — close the </script>
    // hole the same way every serialiser does.
    el.textContent = JSON.stringify(block).replace(/</g, '\\u003c');
    head().appendChild(el);
  });
}

/* ── the baseline index.html shipped with ────────────────────────────────── */

const readMeta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';

const BASELINE = typeof document === 'undefined' ? null : {
  title: document.title,
  description: readMeta('meta[name="description"]'),
  keywords: readMeta('meta[name="keywords"]'),
  robots: readMeta('meta[name="robots"]') || 'index, follow',
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || SITE_URL,
  // The hreflang set the document loaded with — restored verbatim on cleanup.
  alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map((el) => ({ lang: el.getAttribute('hreflang'), href: el.getAttribute('href') })),
  ogTitle: readMeta('meta[property="og:title"]'),
  ogDescription: readMeta('meta[property="og:description"]'),
  ogUrl: readMeta('meta[property="og:url"]'),
  ogImage: readMeta('meta[property="og:image"]') || OG_IMAGE,
  ogType: readMeta('meta[property="og:type"]') || 'website',
};

/* ── public API ──────────────────────────────────────────────────────────── */

/**
 * @param {object}   seo
 * @param {string}   seo.title        Page title WITHOUT the brand suffix.
 * @param {string}   seo.description  140–160 chars reads best in a SERP.
 * @param {string[]|string} seo.keywords
 * @param {string}   seo.canonical    Path ('/properties/dhaka') or absolute URL.
 * @param {boolean}  seo.noindex      Private screens — keeps them out of the index.
 * @param {string}   seo.image        Absolute OG image URL.
 * @param {string}   seo.type         og:type ('website' | 'article' | 'product').
 * @param {object|object[]} seo.jsonLd  Structured-data block(s).
 * @param {boolean}  seo.appendBrand  Set false when the title already says TO-LET PRO.
 * @param {any[]}    deps             Extra deps (e.g. a listing that loads async).
 */
export default function useSeo(seo = {}, deps = []) {
  const {
    title, description, keywords, canonical, noindex = false,
    image, type = 'website', jsonLd = null, appendBrand = true,
  } = seo;

  useEffect(() => {
    if (!BASELINE) return undefined;

    const fullTitle = title
      ? (appendBrand ? `${title} | ${BRAND}` : title)
      : BASELINE.title;
    const desc = description || BASELINE.description;
    const url = canonical ? absoluteUrl(canonical) : absoluteUrl(window.location.pathname);
    const kw = Array.isArray(keywords) ? keywords.join(', ') : keywords;
    const img = image || BASELINE.ogImage;

    document.title = fullTitle;
    setName('description', desc);
    if (kw) setName('keywords', kw);
    // A noindex page is also a nofollow-the-link-equity dead end for crawlers,
    // but we keep `follow` so a crawler that lands on /living can still walk
    // back out to the public pages it links to.
    setName('robots', noindex ? 'noindex, follow' : 'index, follow');
    setName('googlebot', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1');

    // Canonical stays self-referential even on noindex pages. Leaving the
    // previous page's canonical in place would say "/services IS the homepage"
    // while the robots tag says "don't index /services" — two contradictory
    // instructions, and Google resolves those by guessing.
    setCanonical(url);
    setAlternates(noindex ? null : url);

    setProp('og:title', fullTitle);
    setProp('og:description', desc);
    setProp('og:url', url);
    setProp('og:type', type);
    setProp('og:image', img);
    setProp('og:image:width', String(OG_IMAGE_WIDTH));
    setProp('og:image:height', String(OG_IMAGE_HEIGHT));
    setProp('og:site_name', BRAND);
    setProp('og:locale', DEFAULT_LOCALE);
    setProp('og:locale:alternate', ALTERNATE_LOCALE);

    setName('twitter:card', 'summary_large_image');
    setName('twitter:title', fullTitle);
    setName('twitter:description', desc);
    setName('twitter:image', img);

    setJsonLd(jsonLd);

    return () => {
      // Restore index.html's values so the next route never inherits this one's.
      document.title = BASELINE.title;
      setName('description', BASELINE.description);
      setName('keywords', BASELINE.keywords);
      setName('robots', BASELINE.robots);
      setName('googlebot', null);
      setCanonical(BASELINE.canonical);
      clearAlternates();
      BASELINE.alternates.forEach(({ lang, href }) => {
        const el = document.createElement('link');
        el.setAttribute('rel', 'alternate');
        el.setAttribute('hreflang', lang);
        el.setAttribute('href', href);
        head().appendChild(el);
      });
      setProp('og:title', BASELINE.ogTitle);
      setProp('og:description', BASELINE.ogDescription);
      setProp('og:url', BASELINE.ogUrl);
      setProp('og:type', BASELINE.ogType);
      setProp('og:image', BASELINE.ogImage);
      setJsonLd(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, canonical, noindex, image, type, appendBrand,
      Array.isArray(keywords) ? keywords.join('|') : keywords,
      jsonLd ? JSON.stringify(jsonLd) : null,
      ...deps]);
}

/** Convenience wrapper for private screens: one call, no arguments to get wrong. */
export const useNoIndex = (title) => useSeo({ title, noindex: true });
