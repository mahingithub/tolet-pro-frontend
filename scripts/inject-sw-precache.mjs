/**
 * inject-sw-precache.mjs — teach the service worker what this build contains.
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs automatically after `vite build` (package.json "postbuild"), or by hand:
 *
 *     npm run build && npm run sw:precache
 *
 * ── The problem this solves ──
 * Every route in TO-LET PRO is a lazy() chunk (see App.jsx), so /living,
 * /host-dashboard and /tenant-dashboard are three separate files that are only
 * downloaded when somebody opens them. public/service-worker.js precached the
 * shell — index.html, the manifest, two icons — and nothing else, which meant a
 * route chunk entered the cache ONLY if the user had already opened that route
 * while online.
 *
 * The result was an app that looked offline-capable and wasn't. Open it with no
 * connection and the shell booted, React mounted, and then the route's
 * import() failed:
 *
 *     Failed to fetch dynamically imported module: /assets/Living-<hash>.js
 *
 * — which lands in the ErrorBoundary as "Something went wrong." It only ever
 * worked if you had loaded that page online first, in the same session, which
 * is exactly the report: "it works as long as I open the app with the net once".
 *
 * ── What it does ──
 * Writes dist/service-worker.js from the public/service-worker.js template:
 *   1. Replaces the '__BUILD_ID__' placeholder with a per-build id, so the
 *      cache name changes every deploy and activate() drops the old one. The
 *      version used to be a hand-edited constant, which is a release step
 *      nobody remembers — and index.html, the one precached file with no
 *      content hash, is the file that goes stale when it's forgotten.
 *   2. Fills in PRECACHE_CRITICAL (the entry script/stylesheet/modulepreloads,
 *      read out of the built index.html) and PRECACHE_ROUTES (every other
 *      emitted asset). The SW caches the first tier during install and warms
 *      the second in the background.
 *
 * Source maps are excluded on purpose: they are the largest files in dist/ and
 * are only ever fetched with devtools open.
 *
 * ── Keep in sync ──
 * The markers this script writes between — '__PRECACHE_START__' /
 * '__PRECACHE_END__' — and the '__BUILD_ID__' placeholder live in
 * public/service-worker.js. If you rename them there, rename them here.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '../dist');
// Read the TEMPLATE from public/, write the result to dist/. Reading dist/'s
// own copy would work exactly once — the second run would find a file whose
// placeholders this script had already replaced and bail. Sourcing from
// public/ keeps `npm run sw:precache` re-runnable on an existing build, which
// is how you check a change to the worker without a full rebuild.
const SW_SRC = resolve(HERE, '../public/service-worker.js');
const SW_OUT = join(DIST, 'service-worker.js');
const SHELL = join(DIST, 'index.html');

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (!existsSync(SW_SRC)) fail('public/service-worker.js not found.');
if (!existsSync(SHELL)) fail('dist/index.html not found — run `vite build` first.');

// ── Which files are worth caching ──────────────────────────────────────────
// Everything the app can request on its own. Media the USER uploaded (property
// photos, chat voice notes) lives on Cloudinary and is deliberately not here —
// it is cross-origin, unbounded in size, and the fetch handler never touches
// cross-origin requests.
const CACHEABLE = /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico|json)$/i;
const SKIP = /\.map$/i;

// Only these directories are walked. dist/ root holds the shell files
// (index.html, manifest.json, offline.html, the two extra workers), which the
// worker's own PRECACHE_URLS already covers, plus things with no offline value
// at all (sitemap.xml, robots.txt). dist/ also contains one prerendered
// index.html per SEO route (dist/to-let/, dist/properties/…, ~600 of them);
// caching those would multiply the precache by a hundred to store copies of a
// shell the SPA renders from '/index.html' anyway.
const ASSET_DIRS = ['assets', 'icons', 'splash'];

const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const toUrl = (file) => `/${relative(DIST, file).split(sep).join('/')}`;

const allAssets = ASSET_DIRS
  .flatMap((d) => walk(join(DIST, d)))
  .map(toUrl)
  .filter((u) => CACHEABLE.test(u) && !SKIP.test(u))
  .sort();

// ── Tier 1: what index.html itself pulls in ────────────────────────────────
// The entry chunk, its stylesheet and the vendor chunks Vite preloads. These
// have to be in the cache before the SW is allowed to activate: without them
// an offline boot has a shell and no application.
const shellHtml = readFileSync(SHELL, 'utf8');
const critical = [
  ...shellHtml.matchAll(/<script[^>]+src="(\/assets\/[^"]+)"/g),
  ...shellHtml.matchAll(/<link[^>]+href="(\/assets\/[^"]+)"/g),
].map((m) => m[1]);

const criticalSet = new Set(critical.filter((u) => !SKIP.test(u)));
if (criticalSet.size === 0) {
  fail('no /assets/* referenced by dist/index.html — did the build emit anything?');
}

const routes = allAssets.filter((u) => !criticalSet.has(u));

// ── Rewrite the worker ─────────────────────────────────────────────────────
let sw = readFileSync(SW_SRC, 'utf8');

// ── Build id ───────────────────────────────────────────────────────────────
// Derived from the asset names (which are content hashes) AND the worker's own
// source. An identical build keeps its cache, so redeploying unchanged code
// doesn't make every user re-download the app — but any change to what is
// cached, OR to the rules for caching it, gets a fresh cache and drops the old
// one. Leaving the worker out was a trap: fixing a caching bug would ship the
// fix while leaving every existing user on the cache the bug had filled.
const buildId = createHash('sha1')
  .update([...criticalSet, ...routes].join('\n'))
  .update(sw)
  .digest('hex')
  .slice(0, 12);

if (!sw.includes("'__BUILD_ID__'")) {
  fail("public/service-worker.js no longer contains the '__BUILD_ID__' placeholder.");
}
sw = sw.replace("'__BUILD_ID__'", JSON.stringify(buildId));

const START = '// __PRECACHE_START__';
const END = '// __PRECACHE_END__';
const from = sw.indexOf(START);
const to = sw.indexOf(END);
if (from === -1 || to === -1 || to < from) {
  fail(`public/service-worker.js is missing the ${START} / ${END} markers.`);
}

const list = (name, urls) =>
  `const ${name} = [\n${urls.map((u) => `  ${JSON.stringify(u)},`).join('\n')}\n];`;

sw =
  sw.slice(0, from + START.length) +
  '\n' +
  list('PRECACHE_CRITICAL', [...criticalSet]) +
  '\n' +
  list('PRECACHE_ROUTES', routes) +
  '\n' +
  sw.slice(to);

writeFileSync(SW_OUT, sw, 'utf8');

const bytes = [...criticalSet, ...routes]
  .map((u) => statSync(join(DIST, u.slice(1))).size)
  .reduce((a, b) => a + b, 0);

console.log(
  `✓ service worker precache: ${criticalSet.size} critical + ${routes.length} route assets ` +
    `(${(bytes / 1048576).toFixed(1)}MB raw), build ${buildId}`,
);
