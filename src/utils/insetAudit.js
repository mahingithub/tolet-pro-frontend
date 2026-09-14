/**
 * insetAudit — layer 3: catch an overlap by MEASURING the rendered page.
 * ──────────────────────────────────────────────────────────────────────────
 * The static lint (src/test/safeArea.test.js) greps source for known shapes.
 * That is useful in CI and it is also, structurally, always one shape behind:
 * it missed HostDashboard's in-flow <header>, then it missed the map view's
 * `absolute top-0` bar, then it missed a launcher pinned 110 literal pixels up.
 * Each time the pattern grew after the bug shipped.
 *
 * This asks a different question, and one that has no patterns in it:
 *
 *     is anything a user can TAP currently sitting inside a system bar?
 *
 * That is the actual harm. Content under the status bar is not merely clipped —
 * the touch belongs to the OS, so the control is dead. And because this reads
 * getBoundingClientRect() on the live page, it sees everything the grep cannot:
 * fixed overlays, portals, framer-motion transforms, third-party widgets, and
 * whatever the CSS actually computed to on THIS device.
 *
 * USE IT THREE WAYS
 *
 *   1. Automatically in dev. App.jsx runs it on every route change, so a new
 *      screen reports itself in the console while you are building it.
 *
 *   2. To sweep the whole app for any device, from a desktop browser:
 *        tlpInsetAudit.simulate(48, 24)   // a phone with a notch + gesture bar
 *        …click around…
 *        tlpInsetAudit.simulate(0, 0)     // back to normal
 *      This is how every violation found on 2026-09-14 could have been caught
 *      in one pass instead of one screenshot at a time.
 *
 *   3. On a real device, in a debug build over chrome://inspect:
 *        tlpInsetAudit.run()
 *      The numbers it prints are the ground truth for whether the native
 *      measurement in MainActivity.java is working.
 *
 * It never runs in a normal production build and it changes no layout — it
 * only reads, and optionally draws outlines you asked for.
 */

const INTERACTIVE = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Resolve a CSS length token to pixels by letting the browser compute it. */
function resolvePx(expression) {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${expression}`;
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).height) || 0;
  probe.remove();
  return px;
}

/** Current insets, as the page actually resolved them. */
export function readInsets() {
  return {
    top: resolvePx('var(--sat)'),
    bottom: resolvePx('var(--sab)'),
    rail: resolvePx('var(--bottom-nav-h)'),
  };
}

function isVisible(el, rect) {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
  if (parseFloat(cs.opacity) < 0.05) return false;
  // An ancestor may be the thing that is hidden or non-interactive.
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const pcs = getComputedStyle(p);
    if (pcs.visibility === 'hidden' || pcs.display === 'none') return false;
    if (parseFloat(pcs.opacity) < 0.05) return false;
    if (p.getAttribute('aria-hidden') === 'true') return false;
  }
  return true;
}

/**
 * Does this element LIVE in the strip, or is it just passing through?
 *
 * The first run of this audit reported fourteen problems on the home page,
 * eight of which were the division cards — ordinary page content that happens
 * to be under the gesture bar at this scroll position and will be somewhere
 * else a second later. Reporting those is worse than reporting nothing,
 * because it trains you to skim the list.
 *
 * What actually cannot be tapped is something PINNED there: a fixed or sticky
 * bar, or anything inside a fixed overlay. So walk up to the nearest positioned
 * ancestor and only count the element if it is anchored — and not if it sits
 * inside a scroller on the way up, since that content can move out too.
 */
function anchoring(el) {
  let insideScroller = false;
  for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
    const cs = getComputedStyle(node);

    // Overflow BEFORE position, because the pinned element is often also the
    // scroller — Navbar's mobile drawer is `fixed inset-x-0 top-0` AND
    // `overflow-y-auto`. Checking position first returned on that same node and
    // reported its ordinary scrolling content (the language buttons, halfway
    // down the menu) as if it were pinned in the gesture bar.
    const oy = cs.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
      insideScroller = true;
    }

    if (cs.position === 'fixed' || cs.position === 'sticky') {
      return { anchored: true, insideScroller };
    }
  }
  return { anchored: false, insideScroller };
}

function describe(el) {
  const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
  const label =
    el.getAttribute('aria-label') ||
    (el.textContent || '').trim().slice(0, 30) ||
    el.getAttribute('placeholder') ||
    '';
  return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}>${label ? ` "${label}"` : ''}`;
}

/**
 * Find every tappable thing currently inside a system bar.
 *
 * @param {{ outline?: boolean, log?: boolean }} [options]
 *   outline — draw a red ring on each offender (default: true when logging)
 * @returns {{insets: object, violations: Array}}
 */
export function runInsetAudit(options = {}) {
  const { log = true, outline = log } = options;
  const insets = readInsets();
  const viewportH = window.innerHeight;
  const violations = [];

  // Nothing is reserved, so nothing can be intruding on it. This is the normal
  // state on desktop and on a phone whose WebView is already inset natively —
  // use simulate() to audit against a device that does have insets.
  if (insets.top <= 0 && insets.bottom <= 0) {
    if (log) {
      console.info(
        '[inset-audit] --sat and --sab are both 0, nothing to check. ' +
          'On a desktop browser use tlpInsetAudit.simulate(48, 24) to audit ' +
          'against a phone with a notch and a gesture bar.',
      );
    }
    return { insets, violations };
  }

  document.querySelectorAll(INTERACTIVE).forEach((el) => {
    if (el.dataset.insetAuditMark) return;
    const rect = el.getBoundingClientRect();
    if (!isVisible(el, rect)) return;

    // Ignore anything scrolled off-screen; only what is on screen can be tapped.
    if (rect.bottom <= 0 || rect.top >= viewportH) return;

    // Only things PINNED in the strip are broken. Page content that scrolls
    // through it is fine and reporting it drowns out the real finds.
    const { anchored, insideScroller } = anchoring(el);
    if (!anchored || insideScroller) return;

    const inTop = insets.top > 0 && rect.top < insets.top;
    const inBottom = insets.bottom > 0 && rect.bottom > viewportH - insets.bottom;
    if (!inTop && !inBottom) return;

    const bar = inTop ? 'status bar' : 'gesture bar';
    const overlap = inTop
      ? Math.round(Math.min(insets.top, rect.bottom) - Math.max(0, rect.top))
      : Math.round(rect.bottom - Math.max(viewportH - insets.bottom, rect.top));

    violations.push({ element: el, bar, overlapPx: overlap, description: describe(el) });

    if (outline) {
      el.style.outline = '2px solid #ff0040';
      el.style.outlineOffset = '1px';
      el.dataset.insetAuditMark = '1';
    }
  });

  if (log) {
    if (violations.length === 0) {
      console.info(
        `[inset-audit] clean — nothing tappable inside the system bars ` +
          `(top ${insets.top}px, bottom ${insets.bottom}px).`,
      );
    } else {
      console.warn(
        `[inset-audit] ${violations.length} tappable element(s) inside a system bar ` +
          `(top ${insets.top}px, bottom ${insets.bottom}px). These are not just ` +
          `clipped — the OS takes the touch, so they do nothing.`,
      );
      console.table(
        violations.map((v) => ({ element: v.description, bar: v.bar, overlap: `${v.overlapPx}px` })),
      );
      violations.forEach((v) => console.warn('[inset-audit]', v.description, v.element));
    }
  }

  return { insets, violations };
}

/** Remove the outlines a previous run drew. */
export function clearInsetAuditMarks() {
  document.querySelectorAll('[data-inset-audit-mark]').forEach((el) => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    delete el.dataset.insetAuditMark;
  });
}

/**
 * Pretend to be a phone with these insets, so the whole app can be audited from
 * a desktop browser. Writes the same variables the native publisher writes, so
 * every token downstream behaves exactly as it would on the device.
 */
export function simulateInsets(top = 48, bottom = 24) {
  const root = document.documentElement;
  if (top === 0 && bottom === 0) {
    root.style.removeProperty('--tp-inset-top');
    root.style.removeProperty('--tp-inset-bottom');
  } else {
    root.style.setProperty('--tp-inset-top', `${top}px`);
    root.style.setProperty('--tp-inset-bottom', `${bottom}px`);
  }
  clearInsetAuditMarks();
  return runInsetAudit();
}

let installed = false;

/**
 * Expose the helpers on `window.tlpInsetAudit`. Called by App.jsx in dev, or in
 * any build when localStorage.tlpInsetAudit === '1' (so a debug build on a real
 * phone can be inspected without shipping this to users).
 */
export function installInsetAudit() {
  if (installed || typeof window === 'undefined') return false;
  const enabled =
    import.meta.env?.DEV === true || window.localStorage?.getItem('tlpInsetAudit') === '1';
  if (!enabled) return false;

  installed = true;
  window.tlpInsetAudit = {
    run: runInsetAudit,
    simulate: simulateInsets,
    clear: clearInsetAuditMarks,
    insets: readInsets,
  };
  console.info(
    '[inset-audit] ready. tlpInsetAudit.run() to check this screen, ' +
      'tlpInsetAudit.simulate(48, 24) to audit as a phone with insets.',
  );
  return true;
}
