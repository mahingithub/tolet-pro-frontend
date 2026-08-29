/**
 * prerender-seo.mjs — static HTML for the public pages, written after the build.
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs automatically after `vite build` (package.json "postbuild"), or by hand:
 *
 *     npm run build && npm run seo:prerender
 *
 * ── The problem this solves ──
 * TO-LET PRO is a client-rendered SPA. Every URL serves the same index.html and
 * the real page only exists after React runs. Google will usually run it —
 * eventually, on a delay, and not always well. Everything else will not:
 * Facebook, Messenger, WhatsApp and LinkedIn read the raw HTML for link
 * previews, and Bing's renderer is far less patient. Before this script, a
 * district page shared to a Facebook group showed the generic homepage title,
 * and Bing saw 71 identical pages.
 *
 * ── What it does ──
 * For each public route it writes `dist/<route>/index.html`: the built shell,
 * with that route's title, description, canonical, hreflang, Open Graph tags
 * and JSON-LD substituted in, plus a real content block inside #root. Vercel
 * serves files before it applies the SPA rewrite, so `/properties/gazipur`
 * gets the district file and everything else still falls through to the SPA.
 *
 * React replaces the content block when it mounts (createRoot clears its
 * container), and the boot splash covers the swap, so nobody sees it. The block
 * is not a trick for crawlers — it says the same thing the React page says,
 * which is the whole rule about prerendering.
 *
 * ── What it deliberately does NOT do ──
 * Listing pages (/property/:id) are not prerendered: there are thousands, they
 * change daily, and the data lives behind the API. Those rely on useSeo() at
 * runtime, which is enough for Google. If link previews for individual listings
 * matter later, that needs a serverless function on the listing route, not this
 * script.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_URL, BRAND, OG_IMAGE } from '../src/seo/siteConfig.js';
import {
  ALL_LOCATION_PAGES, ALL_DISTRICTS, districtPath, HUB_SECTIONS,
} from '../src/seo/locationSeo.js';
import { FEATURE_PAGES } from '../src/seo/featurePages.js';
import {
  breadcrumbSchema, faqSchema, serviceSchema, webPageSchema,
} from '../src/seo/schema.js';
import { PILLARS, BODY_SECTIONS, FREE_LIST } from '../src/seo/homeContent.js';
import { ALL_AREA_PAGES, ALL_DHAKA_AREAS, areaPath } from '../src/seo/areaSeo.js';
// Sub-area names are lazy-loaded in the browser but free to read here, so the
// prerendered HTML carries the full long tail for crawlers that run no JS.
import { DHAKA_SUB_AREAS } from '../src/seo/dhakaSubAreas.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../dist');
const SHELL = join(DIST, 'index.html');

if (!existsSync(SHELL)) {
  console.error('✗ dist/index.html not found — run `vite build` first.');
  process.exit(1);
}

const shell = readFileSync(SHELL, 'utf8');

/* ── escaping ────────────────────────────────────────────────────────────── */

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Text going into an attribute value. */
const attr = (s = '') => esc(s).replace(/'/g, '&#39;');

/* ── head rewriting ──────────────────────────────────────────────────────── */

/**
 * Replace a tag matched by one attribute, or append it before </head> when the
 * shell doesn't already carry it.
 */
function setTag(html, matcher, replacement) {
  return matcher.test(html)
    ? html.replace(matcher, replacement)
    : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function buildHead(html, { title, description, keywords, path, image = OG_IMAGE, jsonLd = [] }) {
  const url = SITE_URL + path;
  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);

  out = setTag(out, /<meta name="description"[^>]*>/,
    `<meta name="description" content="${attr(description)}" />`);
  if (keywords) {
    out = setTag(out, /<meta name="keywords"[^>]*>/,
      `<meta name="keywords" content="${attr(keywords)}" />`);
  }

  out = setTag(out, /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${attr(url)}" />`);

  // hreflang: three self-referential tags per page (one URL serves both
  // languages), so all three point at this route, not at the homepage.
  out = out.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>/g, '');
  out = out.replace('</head>', [
    `  <link rel="alternate" hreflang="bn-BD" href="${attr(url)}" />`,
    `  <link rel="alternate" hreflang="en-BD" href="${attr(url)}" />`,
    `  <link rel="alternate" hreflang="x-default" href="${attr(url)}" />`,
    '  </head>',
  ].join('\n'));

  out = setTag(out, /<meta property="og:title"[^>]*>/,
    `<meta property="og:title" content="${attr(title)}" />`);
  out = setTag(out, /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${attr(description)}" />`);
  out = setTag(out, /<meta property="og:url"[^>]*>/,
    `<meta property="og:url" content="${attr(url)}" />`);
  out = setTag(out, /<meta property="og:image" [^>]*>/,
    `<meta property="og:image" content="${attr(image)}" />`);
  out = setTag(out, /<meta name="twitter:title"[^>]*>/,
    `<meta name="twitter:title" content="${attr(title)}" />`);
  out = setTag(out, /<meta name="twitter:description"[^>]*>/,
    `<meta name="twitter:description" content="${attr(description)}" />`);
  out = setTag(out, /<meta name="twitter:image"[^>]*>/,
    `<meta name="twitter:image" content="${attr(image)}" />`);

  const blocks = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);
  if (blocks.length) {
    const scripts = blocks
      .map((b) => `  <script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`)
      .join('\n');
    out = out.replace('</head>', `${scripts}\n  </head>`);
  }

  return out;
}

/** Swap the empty SPA container for one holding the prerendered copy. */
const injectBody = (html, content) =>
  html.replace(/<div id="root"><\/div>/, `<div id="root">${content}</div>`);

/* ── content blocks ──────────────────────────────────────────────────────── */

const faqHtml = (faq = []) => (faq.length ? `
      <section>
        <h2>সাধারণ প্রশ্ন / Frequently asked questions</h2>
        ${faq.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n        ')}
      </section>` : '');

const linksHtml = (heading, links) => (links.length ? `
      <nav aria-label="${attr(heading)}">
        <h2>${esc(heading)}</h2>
        <ul>
          ${links.map((l) => `<li><a href="${attr(l.href)}">${esc(l.label)}</a></li>`).join('\n          ')}
        </ul>
      </nav>` : '');

/**
 * Long-form sections, both languages. The React page shows the reader's
 * language first and the other beneath; a crawler reading raw HTML gets both,
 * which is the same content in the same order.
 */
const sectionsHtml = (sections = []) => sections.map((sec) => `
      <section>
        <h2>${esc(sec.h2.bn)} / ${esc(sec.h2.en)}</h2>
        ${sec.paragraphs
    .flatMap((p) => [p.bn, p.en])
    .filter(Boolean)
    .map((text) => `<p>${esc(text)}</p>`)
    .join('\n        ')}
      </section>`).join('\n');

/** The free/paid split, stated as plainly in the HTML as it is on the page. */
const pricingHtml = (pricing) => (pricing ? `
      <section>
        <h2>${esc(pricing.h2.bn)} / ${esc(pricing.h2.en)}</h2>
        <h3>সম্পূর্ণ ফ্রি / Free forever</h3>
        <ul>
          ${pricing.free.bn.map((item, i) => `<li>${esc(item)}${pricing.free.en[i] ? ` — ${esc(pricing.free.en[i])}` : ''}</li>`).join('\n          ')}
        </ul>
        <h3>Plus ও Pro প্ল্যানে / On the Plus &amp; Pro plans</h3>
        <ul>
          ${pricing.paid.bn.map((item, i) => `<li>${esc(item)}${pricing.paid.en[i] ? ` — ${esc(pricing.paid.en[i])}` : ''}</li>`).join('\n          ')}
        </ul>
        <p>${esc(pricing.note.bn)}</p>
        <p>${esc(pricing.note.en)}</p>
      </section>` : '');

/** Shared trailer: the crawl path off every prerendered page. */
const siteLinks = () => linksHtml('TO-LET PRO', [
  { href: '/', label: 'বাসা ভাড়া ও টু-লেট — Home' },
  { href: '/to-let', label: 'সব জেলার টু-লেট — All 64 districts' },
  { href: '/properties/all', label: 'সব বিজ্ঞাপন — All listings' },
  ...FEATURE_PAGES.map((p) => ({ href: p.slug, label: `${p.h1.bn} / ${p.h1.en}` })),
  { href: '/how-it-works', label: 'কিভাবে কাজ করে — How it works' },
]);

function locationBody(seo) {
  const isArea = seo.kind === 'area';

  // Sibling links, matching what LocationSeoBlock renders: other areas of the
  // city for an area page, other districts of the division for a district,
  // own districts for a division.
  const neighbours = isArea
    ? [
      ...ALL_DHAKA_AREAS.filter((a) => a.slug !== seo.id && a.thana && a.thana === seo.thana),
      ...ALL_DHAKA_AREAS.filter((a) => a.slug !== seo.id && a.thana !== seo.thana),
    ].slice(0, 14).map((a) => ({
      href: areaPath(a.slug),
      label: `${a.bn} (${a.en}) বাসা ভাড়া`,
    }))
    : (seo.kind === 'district'
      ? ALL_DISTRICTS.filter((d) => d.divisionId === seo.divisionId && d.id !== seo.id)
      : (seo.districts || [])
    ).slice(0, 12).map((d) => ({
      href: districtPath(d.id),
      label: `${d.en} (${d.bn}) বাসা ভাড়া`,
    }));

  const neighbourHeading = isArea
    ? 'ঢাকার আশপাশের এলাকা / Other areas of Dhaka'
    : seo.kind === 'district'
      ? `${seo.divisionEn} বিভাগের অন্য জেলা / Other districts`
      : `${seo.en} বিভাগের জেলা / Districts`;

  const subs = isArea ? (DHAKA_SUB_AREAS[seo.id] || []) : [];
  const areas = (isArea ? subs.map((s) => s.en) : (seo.areas || [])).slice(0, 24);
  const areasBn = (isArea ? subs.map((s) => s.bn || s.en) : (seo.areasBn || [])).slice(0, 24);
  const areasHeading = isArea
    ? `${seo.bn} এর ভেতরের এলাকা / Inside ${seo.en}`
    : `${seo.en} এর জনপ্রিয় এলাকা / Popular areas`;

  // Dhaka's own page is the crawl path into all 129 area pages.
  const dhakaAreaIndex = seo.id === 'dhaka'
    ? linksHtml('ঢাকা শহরের সব এলাকা / Every area of Dhaka city',
      ALL_DHAKA_AREAS.map((a) => ({
        href: areaPath(a.slug),
        label: `${a.bn} (${a.en}) বাসা ভাড়া`,
      })))
    : '';

  // Campus / office context — the two reasons anyone picks a Dhaka area.
  const nearby = [];
  if (seo.campuses?.length) {
    nearby.push(`<p>কাছাকাছি ক্যাম্পাস / Nearby campuses: ${esc(seo.campuses.join(', '))}</p>`);
  }
  if (seo.offices?.length) {
    nearby.push(`<p>কাছাকাছি অফিস এলাকা / Nearby workplaces: ${esc(seo.offices.join(', '))}</p>`);
  }

  return `
    <main>
      <h1>${esc(seo.h1)}</h1>
      <p>${esc(seo.description)}</p>
      ${nearby.join('\n      ')}
      ${areas.length ? `<section><h2>${esc(areasHeading)}</h2><p>${esc(areas.join(' · '))}</p><p>${esc(areasBn.join(' · '))}</p></section>` : ''}
      ${sectionsHtml(seo.sections)}
      ${faqHtml(seo.faq)}
      ${dhakaAreaIndex}
      ${linksHtml(neighbourHeading, neighbours)}
      ${siteLinks()}
    </main>`;
}

function featureBody(page) {
  return `
    <main>
      <h1>${esc(page.h1.bn)}</h1>
      <p><strong>${esc(page.h1.en)}</strong></p>
      <p>${esc(page.intro.bn)}</p>
      <p>${esc(page.intro.en)}</p>
      <section>
        <h2>কী কী আছে / What you get</h2>
        <ul>
          ${page.features.map((f) => `<li><strong>${esc(f.bn.t)} / ${esc(f.en.t)}</strong> — ${esc(f.bn.d)}</li>`).join('\n          ')}
        </ul>
      </section>
      <section>
        <h2>কিভাবে কাজ করে / How it works</h2>
        <ol>
          ${page.steps.map((s) => `<li>${esc(s.bn)} — ${esc(s.en)}</li>`).join('\n          ')}
        </ol>
      </section>
      ${sectionsHtml(page.sections)}
      ${pricingHtml(page.pricing)}
      ${faqHtml(page.faq)}
      ${linksHtml('আরও দেখুন / Explore more', page.related.map((slug) => {
    const rel = FEATURE_PAGES.find((p) => p.slug === slug);
    return { href: slug, label: rel ? `${rel.h1.bn} / ${rel.h1.en}` : 'সব জেলার টু-লেট / All districts' };
  }))}
      ${siteLinks()}
    </main>`;
}

/* ── the page list ───────────────────────────────────────────────────────── */

const HUB_TITLE = `সারা বাংলাদেশে টু-লেট — To-Let & House Rent in All 64 Districts | ${BRAND}`;
const HUB_DESCRIPTION =
  'বাংলাদেশের ৮ বিভাগ ও ৬৪ জেলার বাসা ভাড়া, ফ্ল্যাট, রুম, সিট, মেস ও সাবলেটের টু-লেট '
  + 'বিজ্ঞাপন — জেলা ধরে খুঁজুন। Browse to-let listings across all 8 divisions and 64 '
  + 'districts of Bangladesh.';

const HIW_TITLE = 'কিভাবে কাজ করে — How TO-LET PRO Works for Tenants & Landlords';
const HIW_DESCRIPTION =
  'ভাড়াটিয়া হিসেবে বাসা খোঁজা থেকে চাবি হাতে পাওয়া, আর বাড়িওয়ালা হিসেবে ফ্রি টু-লেট '
  + 'বিজ্ঞাপন থেকে ভাড়া আদায় — TO-LET PRO ধাপে ধাপে কিভাবে কাজ করে, দালাল ফি কেন নেই এবং '
  + 'ভেরিফিকেশন কিভাবে হয়। How renting and listing works on TO-LET PRO, with pricing.';

const pages = [
  /* ── /how-it-works ──────────────────────────────────────────────────────
     This is the page that carries the "what is TO-LET PRO" explainer in the
     search index. The same copy also renders on the DESKTOP homepage, but that
     copy sits inside `hidden md:flex` — display:none at the ~375px viewport
     Google crawls with — so the two can never compete with each other.

     No FAQPage schema here: the FAQ on this route is rendered by the React
     component from its own `faqs` array and is not in this prerendered HTML.
     Emitting FAQ markup for content a crawler cannot see is exactly the
     mismatch Google issues manual actions for. useSeo() adds it at runtime,
     where the questions really are on screen. */
  {
    path: '/how-it-works',
    title: HIW_TITLE,
    description: HIW_DESCRIPTION,
    body: `
    <main>
      <h1>কিভাবে কাজ করে / How TO-LET PRO works</h1>
      <p>${esc(HIW_DESCRIPTION)}</p>
      <section>
        <h2>বাসা ভাড়া, বাড়ি ম্যানেজমেন্ট আর মেসের হিসাব — তিনটাই এক অ্যাপে
            / House rent, property management and mess accounts — all in one app</h2>
        <ul>
          ${PILLARS.map((p) => `<li><a href="${attr(p.to)}"><strong>${esc(p.bn.t)} / ${esc(p.en.t)}</strong></a> — ${esc(p.bn.d)} ${esc(p.en.d)}</li>`).join('\n          ')}
        </ul>
      </section>
      ${sectionsHtml(BODY_SECTIONS)}
      <section>
        <h2>যা সবসময় ফ্রি / Always free</h2>
        <ul>
          ${FREE_LIST.bn.map((item, i) => `<li>${esc(item)}${FREE_LIST.en[i] ? ` — ${esc(FREE_LIST.en[i])}` : ''}</li>`).join('\n          ')}
        </ul>
      </section>
      ${siteLinks()}
    </main>`,
    jsonLd: [
      webPageSchema({ name: HIW_TITLE, description: HIW_DESCRIPTION, url: '/how-it-works' }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'How it works', path: '/how-it-works' },
      ]),
    ],
  },

  // The hub.
  {
    path: '/to-let',
    title: HUB_TITLE,
    description: HUB_DESCRIPTION,
    body: `
    <main>
      <h1>সারা বাংলাদেশে বাসা ভাড়া ও টু-লেট / To-let and house rent across Bangladesh</h1>
      <p>${esc(HUB_DESCRIPTION)}</p>
      ${sectionsHtml(HUB_SECTIONS)}
      ${linksHtml('সব বিভাগ ও জেলা / All divisions and districts',
    ALL_LOCATION_PAGES.map((p) => ({ href: p.path, label: `${p.en} (${p.bn}) — ${p.kind === 'division' ? 'বিভাগ' : 'জেলা'} বাসা ভাড়া` })))}
      ${siteLinks()}
    </main>`,
    jsonLd: [
      webPageSchema({ name: HUB_TITLE, description: HUB_DESCRIPTION, url: '/to-let' }),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'To-Let', path: '/to-let' }]),
    ],
  },

  // Every division and district.
  ...ALL_LOCATION_PAGES.map((seo) => ({
    path: seo.path,
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    body: locationBody(seo),
    jsonLd: [
      breadcrumbSchema(seo.breadcrumb),
      faqSchema(seo.faq),
      webPageSchema({ name: seo.title, description: seo.description, url: seo.path }),
    ],
  })),

  /* ── Every area of Dhaka city ────────────────────────────────────────────
     129 pages. These are the ones that answer "মিরপুর বাসা ভাড়া" — the search
     people actually run. Same body generator as a district page, so a campus
     area and an office area do not read like the same page with the name
     swapped (see src/seo/areaSeo.js). */
  ...ALL_AREA_PAGES.map((seo) => ({
    path: seo.path,
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    body: locationBody(seo),
    jsonLd: [
      breadcrumbSchema(seo.breadcrumb),
      faqSchema(seo.faq),
      webPageSchema({ name: seo.title, description: seo.description, url: seo.path }),
    ],
  })),

  // Feature landing pages.
  ...FEATURE_PAGES.map((page) => ({
    path: page.slug,
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    body: featureBody(page),
    jsonLd: [
      serviceSchema({
        name: page.title,
        description: page.description,
        url: page.slug,
        serviceType: page.serviceType,
      }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: page.h1.en, path: page.slug },
      ]),
      faqSchema(page.faq),
    ],
  })),
];

/* ── write ───────────────────────────────────────────────────────────────── */

let written = 0;
for (const page of pages) {
  const html = injectBody(buildHead(shell, page), page.body);
  const dir = join(DIST, page.path.replace(/^\//, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  written += 1;
}

console.log(`✓ prerendered ${written} pages → dist/**/index.html`);
