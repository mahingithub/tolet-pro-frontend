/**
 * One-off asset tool: lift the baked-in white matte off the onboarding
 * illustrations so the welcome carousel has no white box in dark mode.
 *
 * Not part of the build. Run it by hand only when the source artwork changes:
 *
 *   node scripts/cutout-onboarding-art.mjs
 *
 * Reads the masters from design/onboarding-masters/*.jpg and writes the runtime
 * cut-outs to public/illustrations/onboarding/*.png.
 *
 * Requires macOS `sips` (JPEG → PNG decode) and `pngjs`, which arrives as a
 * transitive dependency — if it ever disappears, `npm i -D pngjs` first.
 *
 * How it works. The art is generated on a uniform #FFFFFF canvas with every
 * subject inside the middle 80% (see the prompts in the asset README), so the
 * matte is ONE region reachable from the canvas border. We flood only that
 * region, which is why white that belongs to the artwork survives: the phone
 * screens, the mug and the plant pot are all enclosed by their own outlines and
 * never touch the edge. The antialiased rim is then un-matted rather than cut,
 * so the cut-out has no white halo on a dark screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { PNG } = createRequire(import.meta.url)('pngjs');

// The JPEG masters are deliberately outside `public/`: everything under it is
// copied verbatim into the web bundle and the APK, and only the cut-outs are
// ever requested at runtime.
const SRC_DIR = path.join(fileURLToPath(new URL('../design/onboarding-masters', import.meta.url)));
const OUT_DIR = path.join(fileURLToPath(new URL('../public/illustrations/onboarding', import.meta.url)));

// A pixel this close to white, reachable from the border, is matte. Chosen
// just under the JPEG's noise floor for the flat background (253-255) and just
// over the faint edge shading that separates props from it.
const BG_MIN = 248;
// The rim ramp: opaque at RIM_LO, fully clear at 255. Kept well above the
// lightest colour the artwork actually uses (the cream building) so the ramp
// can never eat a light-coloured prop.
const RIM_LO = 236;
// Flat cartoon art survives 32 levels per channel with no visible banding, and
// it roughly halves the PNG — the JPEG noise in the flat areas is what makes an
// un-quantized export three times the size of the original.
const LEVELS = 32;

/**
 * Regions where white belongs to the artwork but touches the matte, so the
 * flood reaches it and has to be given back. Only the home-search scene needs
 * this: its floating listing card is pure white with no outline, and its left
 * edge sits in the open margin beside the woman.
 *
 * Rounded rect in source pixels, measured off the card's own faint edge shading.
 */
const KEEP_WHITE = {
  'find-home-v2': [{ x0: 504, y0: 222, x1: 638, y1: 384, r: 13 }],
};

const SOURCES = ['find-home-v2', 'collect-rent-v3', 'shared-ledger-v3'];

/** Signed distance from a rounded rect: negative inside, positive outside. */
function roundedRectSdf(x, y, { x0, y0, x1, y1, r }) {
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r; const hy = (y1 - y0) / 2 - r;
  const dx = Math.max(Math.abs(x - cx) - hx, 0);
  const dy = Math.max(Math.abs(y - cy) - hy, 0);
  return Math.hypot(dx, dy) - r;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tlp-art-'));

for (const name of SOURCES) {
  const jpg = path.join(SRC_DIR, `${name}.jpg`);
  const decoded = path.join(tmp, `${name}.png`);
  execFileSync('sips', ['-s', 'format', 'png', jpg, '--out', decoded], { stdio: 'ignore' });

  const png = PNG.sync.read(fs.readFileSync(decoded));
  const { width: w, height: h, data } = png;
  const n = w * h;

  const minCh = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    minCh[i] = Math.min(data[p], data[p + 1], data[p + 2]);
  }

  // ── Flood the border-connected matte ──────────────────────────────────────
  const BG = 1; const RIM = 2;
  const mark = new Uint8Array(n);
  const stack = [];
  const push = (i) => { if (!mark[i] && minCh[i] >= BG_MIN) { mark[i] = BG; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w; const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // ── Walk out from it into the antialiased rim ─────────────────────────────
  const rim = [];
  const pushRim = (i) => { if (!mark[i] && minCh[i] > RIM_LO) { mark[i] = RIM; rim.push(i); } };
  const spreadRim = (i) => {
    const x = i % w; const y = (i / w) | 0;
    if (x > 0) pushRim(i - 1);
    if (x < w - 1) pushRim(i + 1);
    if (y > 0) pushRim(i - w);
    if (y < h - 1) pushRim(i + w);
  };
  for (let i = 0; i < n; i++) if (mark[i] === BG) spreadRim(i);
  while (rim.length) spreadRim(rim.pop());

  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (mark[i] === BG) { data[p + 3] = 0; continue; }
    if (mark[i] !== RIM) continue;
    // Observed = a·C + (1−a)·255. Solve back for the artwork's own colour, so
    // the rim keeps its hue instead of becoming a white-tinted outline.
    const a = Math.max(0, Math.min(1, (255 - minCh[i]) / (255 - RIM_LO)));
    if (a <= 0) { data[p + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) {
      data[p + c] = Math.round(Math.max(0, Math.min(255, (data[p + c] - (1 - a) * 255) / a)));
    }
    data[p + 3] = Math.round(a * 255);
  }

  // ── Give back the white that was artwork, not matte ───────────────────────
  let restored = 0;
  for (const rect of KEEP_WHITE[name] || []) {
    for (let y = Math.floor(rect.y0) - 2; y <= Math.ceil(rect.y1) + 2; y++) {
      for (let x = Math.floor(rect.x0) - 2; x <= Math.ceil(rect.x1) + 2; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x; const p = i * 4;
        if (data[p + 3] === 255) continue;
        // Antialias the card's own edge so it doesn't re-introduce a hard step.
        const cover = Math.max(0, Math.min(1, 0.5 - roundedRectSdf(x + 0.5, y + 0.5, rect)));
        if (cover <= 0) continue;
        const alpha = Math.max(data[p + 3], Math.round(cover * 255));
        if (alpha === data[p + 3]) continue;
        // What was cut here was the card's white body; blend it back under
        // whatever partial artwork already survived.
        const was = data[p + 3] / 255;
        for (let c = 0; c < 3; c++) data[p + c] = Math.round(data[p + c] * was + 255 * (1 - was));
        data[p + 3] = alpha;
        restored++;
      }
    }
  }

  const step = 256 / LEVELS;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (!data[p + 3]) { data[p] = data[p + 1] = data[p + 2] = 255; continue; }
    for (let c = 0; c < 3; c++) {
      data[p + c] = Math.min(255, Math.round(data[p + c] / step) * step);
    }
  }

  const out = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(out, PNG.sync.write(png, { colorType: 6, deflateLevel: 9 }));
  const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;
  console.log(`${name}: ${kb(jpg)} jpg → ${kb(out)} png${restored ? `  (${restored}px given back)` : ''}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
