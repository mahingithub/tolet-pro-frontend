import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import useLivingStore from '../store/useLivingStore';

const TourContext = createContext();

/* ══════════════════════════════════════════════════════════════════════════
   1. WHERE "I HAVE ALREADY SEEN THIS TOUR" LIVES
   ──────────────────────────────────────────────────────────────────────────
   One bucket per account, plus one for anonymous visitors:

       tolet_pro::tours_completed::<userId>
       tolet_pro::tours_completed::guest

   Two separate bugs used to make the tour restart on EVERY login, and both are
   fixed by this layout:

   • The record was a single un-scoped key, and `clearAllAppData()` in
     authService wipes every localStorage key that isn't explicitly marked
     device-level. Logout therefore erased it and the next login replayed every
     tour from step 1. The prefix above is now listed in that file's
     DEVICE_KEEP_PREFIXES, so the record survives a logout — which is the whole
     point of a "show this once" flag.

   • Because it was un-scoped, the alternative fix (just keep the key) would
     have leaked across accounts: hand the laptop to a second landlord and they
     would never be offered the tour. Keying by account id fixes both at once —
     the record outlives a logout AND a different user still gets their own
     first-run experience.
   ══════════════════════════════════════════════════════════════════════════ */

const TOUR_STORAGE_PREFIX = 'tolet_pro::tours_completed';
// The pre-fix un-scoped slot. Read once, folded into the active bucket, deleted.
const LEGACY_TOUR_STORAGE_KEY = TOUR_STORAGE_PREFIX;
const GUEST_BUCKET = 'guest';

const bucketKey = (accountId) => `${TOUR_STORAGE_PREFIX}::${accountId || GUEST_BUCKET}`;

// Tolerant read: anything that isn't a plain object (old formats, hand-edited
// storage, a half-written value) is treated as "nothing completed yet" rather
// than throwing on every single tour check.
const readBucket = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeBucket = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota. The tour just repeats; nothing else breaks.
  }
};

// Fold `from` into `into` without ever un-completing something already there.
const mergeInto = (intoKey, source) => {
  const ids = Object.keys(source || {}).filter((id) => source[id]);
  if (!ids.length) return;
  const target = readBucket(intoKey);
  let changed = false;
  ids.forEach((id) => {
    if (!target[id]) {
      target[id] = true;
      changed = true;
    }
  });
  if (changed) writeBucket(intoKey, target);
};

// Run once per account, at the moment we learn who is signed in.
//
//  • legacy  → the un-scoped key from before this file was per-account. Anyone
//              mid-upgrade keeps their progress instead of being shown every
//              tour a second time.
//  • guest   → tours finished before signing in (the search tour on /properties
//              is public). Carried forward so signing up doesn't replay them.
const adoptEarlierProgress = (accountId) => {
  if (!accountId) return;
  const key = bucketKey(accountId);

  const legacy = readBucket(LEGACY_TOUR_STORAGE_KEY);
  if (Object.keys(legacy).length) {
    mergeInto(key, legacy);
    try { window.localStorage.removeItem(LEGACY_TOUR_STORAGE_KEY); } catch { /* ignore */ }
  }

  mergeInto(key, readBucket(bucketKey(null)));
};

/* ══════════════════════════════════════════════════════════════════════════
   2. FINDING THE THING A STEP POINTS AT
   ══════════════════════════════════════════════════════════════════════════ */

// Responsive layouts here keep both variants mounted and hide one with CSS
// (HomePage renders MobileHome *and* HeroSection; HeroSection itself ships a
// `flex lg:hidden` bar and a `hidden lg:flex` bar). A plain querySelector would
// return whichever comes first in the DOM even when it is display:none, and
// driver.js would spotlight a zero-size invisible box. Always pick the anchor
// the user can actually see.
const visibleAnchor = (selector) => {
  const matches = document.querySelectorAll(selector);
  for (const el of matches) {
    const rects = el.getClientRects();
    if (rects.length && rects[0].width > 0 && rects[0].height > 0) return el;
  }
  return null;
};

// Every step resolves its anchor LAZILY, at the moment driver.js highlights it,
// never once at build time. Two things used to break because the element was
// captured up front:
//   • the wrong variant was frozen in on a resize (mobile rail vs desktop rail);
//   • a re-render between build and highlight left driver.js holding a detached
//     node, which it happily spotlights as an empty box off-screen.
const lazyAnchor = (selector) =>
  typeof selector === 'function' ? selector : () => visibleAnchor(selector);

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// driver.js has no built-in "wait for the page to be ready" — a tour started
// against a half-mounted page renders as a centred popover with nothing
// highlighted. Tours here start right after a route change, so poll for the
// first anchor before driving, and give up (rather than drive blind) if the
// page never shows it. `shouldAbort` lets a route change cut the wait short.
const waitForAnchor = (selector, shouldAbort, timeout = 5000) =>
  new Promise((resolve) => {
    const found = visibleAnchor(selector);
    if (found) {
      resolve(found);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (shouldAbort?.()) {
        window.clearInterval(timer);
        resolve(null);
        return;
      }
      const el = visibleAnchor(selector);
      if (el) {
        window.clearInterval(timer);
        resolve(el);
      } else if (Date.now() - started >= timeout) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 120);
  });

/* ══════════════════════════════════════════════════════════════════════════
   3. NEVER OPEN ON TOP OF ANOTHER POPUP
   ──────────────────────────────────────────────────────────────────────────
   The reported symptom was the tour spotlighting the page from *behind* the
   welcome popup, and several popovers stacking up at once. Three causes:

   • The welcome robot announces `welcomeRobotFinished` at the START of its
     dismissal, while its full-screen card is still animating out. The tour
     waited a flat 500ms and opened straight into it.
   • Only ONE of the tours bothered to look for `#welcome-robot-overlay`; the
     rest checked for `[role="dialog"]` alone and sailed past the robot.
   • Every check ran ONCE, up front, before an async `navigate()` and up to five
     seconds of anchor polling. Whatever opened during that window was missed.

   So the check is no longer a check — it is a wait, repeated after the anchor
   poll, and a blocked tour is left un-started (never marked "seen") so it can
   still be offered once the screen is free.
   ══════════════════════════════════════════════════════════════════════════ */

// Anything here means "the user is busy with something else". Add
// `data-tour-blocker` to any future overlay that must hold the tour off.
//
// The :not() matters — driver.js gives its OWN popover role="dialog" and
// id="driver-popover-content", so a bare [role="dialog"] would make a running
// tour look like a blocker to the next one and stall it for the full timeout.
const BLOCKING_UI = [
  '#welcome-robot-overlay',                        // the full-screen welcome card
  '[role="dialog"]:not(#driver-popover-content)',  // modals, sheets, the map view
  '[data-tour-blocker]',                           // opt-in escape hatch
].join(', ');

// Only *visible* blockers count. A dialog left in the DOM in a hidden state
// would otherwise hold every tour off forever.
//
// And an overlay the RUNNING tour is itself pointing into is not in the way —
// it is the step. The host dashboard tour opens the logo's "where to?" modal
// (a real role="dialog") to explain the two options inside it, so without this
// the tour would treat its own step as a popup barging in and shut itself down.
// driver.js marks whatever it is highlighting with `.driver-active-element`,
// which is the one dependable signal for "this overlay belongs to the tour".
// Before anything is driving there is no active element, so the pre-flight
// gates below behave exactly as they always did.
const blockingUi = () => {
  const active = document.querySelector('.driver-active-element');
  for (const el of document.querySelectorAll(BLOCKING_UI)) {
    const rects = el.getClientRects();
    if (!rects.length || rects[0].width <= 0 || rects[0].height <= 0) continue;
    if (active && el.contains(active)) continue;
    return el;
  }
  return null;
};

// Generous on purpose. The welcome popup a tour usually queues behind can hold
// a guide VIDEO, so "the user is still reading" is easily a minute. The wait is
// a 150ms poll that bails the moment the route changes, so a long ceiling costs
// nothing and avoids throwing the tour away on someone who was simply taking
// their time.
const CLEAR_SCREEN_TIMEOUT_MS = 45000;
const CLEAR_RECHECK_MS = 1500;         // shorter re-check after the anchor wait
const OPENING_BEAT_MS = 400;           // so the tour reads as "after" the popup
const START_SETTLE_MS = 150;           // let a same-commit navigate() land first
const BLOCKER_WATCH_MS = 200;          // how often a RUNNING tour re-checks
// A tour that opens a modal itself needs the watch held across the gap between
// "the modal is on screen" and "driver.js has moved onto the step inside it",
// or its own reveal would read as a popup interrupting. Comfortably longer than
// the 400ms reveal delays the tours use.
const REVEAL_HOLD_MS = 1200;

const waitForClearScreen = (shouldAbort, timeout = CLEAR_SCREEN_TIMEOUT_MS) =>
  new Promise((resolve) => {
    if (!blockingUi()) {
      resolve(true);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (shouldAbort?.()) {
        window.clearInterval(timer);
        resolve(false);
      } else if (!blockingUi()) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started >= timeout) {
        // Still busy. Do NOT drive — that is the bug we are fixing.
        window.clearInterval(timer);
        resolve(false);
      }
    }, 150);
  });

/* Every check above happens BEFORE driver.js is told to drive, and that is not
   enough. Some popups cannot open until their data arrives: SmartAlertsPopup
   only appears once the bookings fetch resolves and yields an urgent alert,
   PaymentSettingsPopup once bookings prove a tenant exists. The pre-flight gate
   costs about half a second, so any network round-trip slower than that lands
   the popup ON TOP of a tour that had already, correctly, seen a clear screen —
   the reported "tour is on step 2 of 19 behind the rent-overdue popup".

   So the gate keeps watching for as long as the tour is running. The instant a
   blocker shows up the tour gets out of the way, and because it stands down
   rather than finishing, the retry puts it back on offer once the user has
   dealt with the popup. Polling rather than a MutationObserver on purpose: a
   popup can also become visible through a pure CSS/class change that mutates
   nothing inside the subtree we would be observing. */
const watchForBlocker = (isHeld, onBlocked) => {
  const timer = window.setInterval(() => {
    if (isHeld()) return;
    if (blockingUi()) {
      window.clearInterval(timer);
      onBlocked();
    }
  }, BLOCKER_WATCH_MS);
  return () => window.clearInterval(timer);
};

/* ══════════════════════════════════════════════════════════════════════════
   4. SHARED DRIVER.JS CONFIG
   ══════════════════════════════════════════════════════════════════════════ */

// Ceiling for driver.js's own per-step `waitForElement`. It watches the DOM with
// a MutationObserver and proceeds the instant the anchor appears, so a generous
// ceiling costs nothing on the happy path and only bounds the pathological case.
const ANCHOR_WAIT_MS = 3000;
// A Sheet leaves on a spring; give it a beat to clear the anchor sitting behind
// it before the next step spotlights that anchor.
const SHEET_EXIT_MS = 260;
// Living's module swap runs a 0.22s framer-motion enter transition.
const MODULE_SETTLE_MS = 320;

// A click on the dimmed backdrop used to tear the tour down, and since every
// onDestroyed writes the tour id into localStorage, one stray click outside the
// popover retired that tour for good — the user never saw it again. driver.js
// only closes on a backdrop click when `overlayClickBehavior` is the literal
// string 'close'; handing it a no-op function instead leaves the overlay inert.
// A tour now ends only when the user says so: the Done button, or the popover's
// × (skip).
//
// `allowClose` has to stay true for that ×: driver.js drops the button from the
// footer entirely when it is false. It also gates Esc, which is a deliberate
// keypress rather than a slip, so that stays as the keyboard equivalent of skip.
const TOUR_EXIT_CONFIG = {
  allowClose: true,
  overlayClickBehavior: () => {},
};

// Applies to every tour. `waitForElement` + `skipMissingElement` together mean a
// step whose anchor is late gets waited for, and a step whose anchor never turns
// up is dropped instead of parking a detached, centred popover over the page.
// The host dashboard tour in particular used to hand driver.js a dozen raw,
// unresolved steps (the logo modal, the drawer, every sidebar tab) with neither
// setting, so any drawer that failed to open produced popovers pointing at air.
const TOUR_BASE_CONFIG = {
  ...TOUR_EXIT_CONFIG,
  waitForElement: ANCHOR_WAIT_MS,
  skipMissingElement: true,
};

// How many times a tour may be turned away by a popup before we stop offering
// it for this session. Without a ceiling, a modal the user never closes would
// have the retry below re-arming itself indefinitely.
const MAX_START_ATTEMPTS = 4;

// Drop steps whose anchor is not on the page at all, so the progress counter
// ("3 of 9") reflects what the user will actually be shown. Steps the tour
// itself reveals (a sheet, the profile drawer, the logo modal) are marked
// `reveal: true` and always survive — they are *supposed* to be absent now, and
// driver.js's own waitForElement picks them up. Steps with no anchor are
// deliberate centred cards and always survive.
const REVEAL_FLAG = '__revealedByTour';

const pruneSteps = (steps) =>
  steps
    .filter(Boolean)
    .filter((s) => !s.element || s[REVEAL_FLAG] || !!s.element())
    .map(({ [REVEAL_FLAG]: _ignored, ...step }) => step);

/* ══════════════════════════════════════════════════════════════════════════
   5. THE COPY
   ──────────────────────────────────────────────────────────────────────────
   Most landlords on TO-LET PRO are not young, and plenty are using an app like
   this for the first time. So every step follows the same shape:

       title   — a plain-language question or promise, not a feature name
       body    — what this is FOR, in one or two short sentences
       action  — the single concrete thing to do next, visually separated

   driver.js assigns `description` with innerHTML, which is what lets the action
   line render as its own highlighted row. Every string below is authored here
   in source — none of it is user input — so there is nothing to escape.
   ══════════════════════════════════════════════════════════════════════════ */

const describe = (body, action, actionLabel) => {
  const main = `<span class="tp-tour-body">${body}</span>`;
  return action
    ? `${main}<span class="tp-tour-do"><b class="tp-tour-do-label">${actionLabel}</b>${action}</span>`
    : main;
};

export const TourProvider = ({ children }) => {
  const { user, activeRole } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTour, setActiveTour] = useState(null);

  const isBn = language === 'বাংলা';
  const accountId = user?.id || user?._id || null;

  /* ── storage, scoped to whoever is signed in ─────────────────────────── */

  // Read through a ref so `isTourDone` can stay referentially stable: it sits in
  // the dependency list of every auto-start effect in this file (and of one in
  // AddProperty), and a new identity on each render would re-run all of them.
  const bucketRef = useRef(bucketKey(accountId));
  bucketRef.current = bucketKey(accountId);

  useEffect(() => {
    adoptEarlierProgress(accountId);
  }, [accountId]);

  const isTourDone = useCallback((tourId) => !!readBucket(bucketRef.current)[tourId], []);
  const markTourDone = useCallback((tourId) => {
    const bucket = readBucket(bucketRef.current);
    if (bucket[tourId]) return;
    bucket[tourId] = true;
    writeBucket(bucketRef.current, bucket);
  }, []);

  /* ── one tour at a time, and only one ───────────────────────────────────
     `activeTour` is React state, set only AFTER an await chain that can span
     several seconds, so it cannot guard the gap between "a tour was asked for"
     and "a tour exists". `lockRef` flips synchronously and is the real mutual
     exclusion. `startHostTour` used to READ this guard but never SET it, which
     is how the welcome-robot handoff and the route effect could both build a
     driver for the same tour and leave two popovers on screen.               */
  const lockRef = useRef(null);
  const liveDriverRef = useRef(null);
  const unmountingRef = useRef(false);

  // A start attempt that is turned away for a recoverable reason (a popup was
  // up, the route changed under us) must be retried, otherwise the tour is lost
  // for the whole session — the auto-start effects below only re-run when their
  // dependencies change, and "the modal closed" is not one of them. Bumping
  // this re-drives them; the per-tour attempt cap stops it from spinning.
  const [retryTick, setRetryTick] = useState(0);
  const attemptsRef = useRef({});

  const claimAttempt = (tourId) => {
    const used = attemptsRef.current[tourId] || 0;
    if (used >= MAX_START_ATTEMPTS) return false;
    attemptsRef.current[tourId] = used + 1;
    return true;
  };

  // Walking away from a page is not a failed attempt. Only a genuinely blocked
  // start (a popup that never closed, an anchor that never appeared) should
  // count against the cap, or simply browsing around would quietly use it up.
  const refundAttempt = (tourId) => {
    attemptsRef.current[tourId] = Math.max(0, (attemptsRef.current[tourId] || 1) - 1);
  };

  // Tear the overlay down on unmount only, and flag it so `onDestroyed` does not
  // record a tour the user was still in the middle of as "seen". The live driver
  // is held in a ref rather than state on purpose: as state, this cleanup would
  // re-run when a finished tour set it back to null and call destroy() a second
  // time on an instance driver.js had already destroyed.
  useEffect(() => {
    return () => {
      unmountingRef.current = true;
      liveDriverRef.current?.destroy();
    };
  }, []);

  /* ── step builder ───────────────────────────────────────────────────── */

  const L = useCallback((en, bn) => (isBn ? bn : en), [isBn]);

  const step = useCallback(
    ({
      element,
      side = 'bottom',
      align = 'center',
      title,
      body,
      action,
      reveal = false,
      onNext,
      onPrev,
      onDone,
      onHighlighted,
    }) => {
      const built = {
        popover: {
          title: L(title[0], title[1]),
          description: describe(
            L(body[0], body[1]),
            action ? L(action[0], action[1]) : null,
            L('Do this', 'করণীয়'),
          ),
          side,
          align,
        },
      };
      if (element) {
        built.element = lazyAnchor(element);
        built[REVEAL_FLAG] = reveal;
      }
      if (onNext) built.popover.onNextClick = onNext;
      if (onPrev) built.popover.onPrevClick = onPrev;
      if (onDone) built.popover.onDoneClick = onDone;
      if (onHighlighted) built.onHighlighted = onHighlighted;
      return built;
    },
    [L],
  );

  // The opening and closing cards. Older users told us the tour felt like it
  // "grabbed" the screen with no warning, so it now says up front how long it
  // takes and how to leave.
  const openingStep = useCallback(
    (bodyEn, bodyBn) =>
      step({
        title: ['A quick guided tour', 'ছোট্ট একটি গাইডেড টুর'],
        body: [bodyEn, bodyBn],
        action: [
          'Press Next to begin. You can stop any time with the × in the corner.',
          'শুরু করতে পরবর্তী চাপুন। কোণার × চেপে যেকোনো সময় থামাতে পারবেন।',
        ],
      }),
    [step],
  );

  const closingStep = useCallback(
    () =>
      step({
        title: ['That is everything', 'এইটুকুই ছিল'],
        body: [
          'You are set up. Nothing here is permanent — you can change or undo anything later.',
          'আপনি এখন তৈরি। এখানে কিছুই স্থায়ী নয় — পরে যেকোনো কিছু বদলাতে বা বাতিল করতে পারবেন।',
        ],
        action: [
          'Need this again, or stuck somewhere? Open the robot button and ask.',
          'আবার দেখতে চাইলে বা কোথাও আটকে গেলে রোবট বাটনটি খুলে জিজ্ঞেস করুন।',
        ],
      }),
    [step],
  );

  /* ══════════════════════════════════════════════════════════════════════
     6. THE RUNNER
     Every tour goes through here, so the guards can never again be applied to
     some tours and forgotten on others.
     ══════════════════════════════════════════════════════════════════════ */

  const runTour = useCallback(
    async (tourId, buildSteps, options = {}) => {
      const { ensurePath, anchor, alsoWaitFor, stillValid, driverOptions = {} } = options;

      if (isTourDone(tourId)) return;
      if (lockRef.current) return;
      if (!claimAttempt(tourId)) return;

      lockRef.current = tourId;
      let handedOff = false;

      // Recoverable exit: release the lock (in `finally`) and let the effects
      // have another go once whatever was in the way has cleared. Deliberately
      // does NOT record the tour as seen — a tour nobody saw is not a tour the
      // user is done with.
      const standDown = (reason) => {
        if (reason === 'route') refundAttempt(tourId);
        setRetryTick((n) => n + 1);
      };

      try {
        // Some tours teach a page the user is not on yet. Signup drops a new
        // tenant on /tenant-dashboard, but the search bar their tour is about
        // only exists on the public home page.
        if (ensurePath && window.location.pathname !== ensurePath) navigate(ensurePath);

        // A navigate() issued in the same commit as this call (App.jsx sends
        // landlords from "/" to the dashboard on boot) updates the history
        // synchronously but React has not re-rendered yet. Settle first — which
        // also lets the line above land — then read the route, so we validate
        // against where we are actually going rather than where we came from.
        await sleep(START_SETTLE_MS);

        const route = window.location.pathname;
        const abort = () => window.location.pathname !== route;

        if (abort()) return standDown('route');
        if (!(await waitForClearScreen(abort))) return standDown(abort() ? 'route' : 'blocked');
        if (anchor && !(await waitForAnchor(anchor, abort))) {
          return standDown(abort() ? 'route' : 'blocked');
        }

        // Anchors that are nice to have but not worth failing over. The search
        // tour needs this: its filter sidebar renders synchronously while the
        // property cards behind two of its three steps arrive from a fetch. It
        // used to start the moment the sidebar appeared, so pruning threw both
        // card steps away and left a one-step "tour" whose only button read
        // Done. Waiting is best-effort — an empty result set still gets the
        // filter step, which is better than nothing.
        if (alsoWaitFor) await waitForAnchor(alsoWaitFor, abort);

        // The waits above can span seconds. Re-verify BOTH conditions: a modal
        // may have opened, or the router may have moved on.
        if (abort() || (stillValid && !stillValid(route))) return standDown('route');
        if (!(await waitForClearScreen(abort, CLEAR_RECHECK_MS))) {
          return standDown(abort() ? 'route' : 'blocked');
        }

        await sleep(OPENING_BEAT_MS);
        if (abort()) return standDown('route');
        if (blockingUi()) return standDown('blocked');

        // Handed to step callbacks so they can drive the very instance they
        // belong to. Populated before drive(), so every handler sees it.
        //
        // `holdBlockerWatch` is the escape hatch for a tour that opens UI on
        // purpose: call it right before dispatching the reveal and the running
        // blocker watch below looks away until driver.js has caught up.
        let watchHeldUntil = 0;
        const box = {
          driver: null,
          holdBlockerWatch: (ms = REVEAL_HOLD_MS) => {
            watchHeldUntil = Date.now() + ms;
          },
        };
        const steps = pruneSteps(buildSteps(box) || []);
        if (!steps.length) return standDown('blocked');

        // Set by driver.js's global onPopoverRender the first time a step is
        // actually painted. Without it, a tour torn down before it ever showed
        // anything (provider unmount, a race) still burned its one-and-only
        // chance to run.
        let shown = false;
        // Flipped when a popup turned up mid-tour and we bowed out. The tour was
        // NOT completed, so it must not be recorded as seen and must be offered
        // again once the screen is free.
        let yieldedToPopup = false;
        let stopBlockerWatch = null;

        const driverObj = driver({
          ...TOUR_BASE_CONFIG,
          steps,
          // "1 of 1" on a single-step tour reads like something failed to load.
          showProgress: steps.length > 1,
          nextBtnText: L('Next', 'পরবর্তী'),
          prevBtnText: L('Back', 'পূর্ববর্তী'),
          doneBtnText: L('Finish', 'শেষ'),
          progressText: L('{{current}} of {{total}}', '{{current}} / {{total}}'),
          ...driverOptions,
          onPopoverRender: () => {
            shown = true;
          },
          onDestroyed: () => {
            stopBlockerWatch?.();
            stopBlockerWatch = null;
            // Let the tour put the page back the way it found it (Living closes
            // any sheet it opened) before we touch shared state.
            try {
              driverOptions.onDestroyed?.();
            } catch (err) {
              console.error(`Tour "${tourId}" cleanup failed:`, err);
            }
            // `yieldedToPopup` matters here: by the time a popup interrupts, a
            // step HAS painted, so the `shown` test alone would retire a tour
            // the user never got to finish.
            if (shown && !yieldedToPopup && !unmountingRef.current) markTourDone(tourId);
            // Everything below is guarded on identity: only the instance that is
            // actually live may release the lock or clear the shared state. A
            // stale instance being cleaned up must never disturb the tour that
            // replaced it.
            if (liveDriverRef.current !== driverObj) return;
            liveDriverRef.current = null;
            lockRef.current = null;
            setActiveTour(null);
            // Destroyed without ever painting a step, or stood aside for a
            // popup — either way the one chance to run was not used, so let the
            // auto-start effects offer it again. The per-tour attempt cap keeps
            // a popup nobody ever closes from re-arming this forever, and the
            // pre-flight `waitForClearScreen` means the retry waits rather than
            // spins.
            if ((!shown || yieldedToPopup) && !unmountingRef.current) {
              setRetryTick((n) => n + 1);
            }
          },
        });

        box.driver = driverObj;

        // Belt and braces. The lock should make this impossible, but a second
        // overlay is exactly the reported bug, and a leaked instance would keep
        // its popover on screen forever with no way to reach it.
        const stale = liveDriverRef.current;
        if (stale) {
          liveDriverRef.current = null;
          stale.destroy();
        }

        liveDriverRef.current = driverObj;
        lockRef.current = tourId;
        handedOff = true;
        setActiveTour(tourId);
        driverObj.drive();

        // The gate stays on duty for as long as the tour runs — see
        // watchForBlocker. Armed AFTER drive() so the first poll can already see
        // driver.js's own popover and active element.
        stopBlockerWatch = watchForBlocker(
          () => Date.now() < watchHeldUntil,
          () => {
            yieldedToPopup = true;
            driverObj.destroy(); // → onDestroyed above stands the tour down
          },
        );
      } catch (error) {
        console.error(`Failed to start the "${tourId}" tour:`, error);
        setActiveTour(null);
      } finally {
        // Held for the lifetime of a running tour (released in onDestroyed);
        // released here on every abort path.
        if (!handedOff) lockRef.current = null;
      }
    },
    [isTourDone, markTourDone, L, navigate],
  );

  /* ══════════════════════════════════════════════════════════════════════
     7. THE TOURS
     ══════════════════════════════════════════════════════════════════════ */

  /* ── Tenant: how to find a place ─────────────────────────────────────── */
  const startTenantTour = useCallback(
    () =>
      runTour(
        'tenant',
        () => [
          openingStep(
            'We will show you how to find a place to live, one step at a time. It takes about a minute.',
            'কীভাবে থাকার জায়গা খুঁজে পাবেন, ধাপে ধাপে দেখিয়ে দিচ্ছি। প্রায় এক মিনিট লাগবে।',
          ),
          step({
            element: '[data-tour="mode-switcher"]',
            side: 'bottom',
            title: ['First, what kind of place?', 'প্রথমে বলুন, কেমন জায়গা?'],
            body: [
              'Residential means somewhere to live — a flat, a single room, or a seat in a mess. Commercial means a shop, an office, or a restaurant space.',
              'আবাসিক মানে থাকার জায়গা — ফ্ল্যাট, একক রুম বা মেসের সিট। বাণিজ্যিক মানে দোকান, অফিস বা রেস্টুরেন্টের জায়গা।',
            ],
            action: [
              'Tap whichever one matches what you need.',
              'আপনার প্রয়োজনের সাথে যেটি মেলে, সেটিতে চাপ দিন।',
            ],
          }),
          step({
            element: '[data-tour="location"]',
            side: 'bottom',
            align: 'start',
            title: ['Where do you want to live?', 'কোথায় থাকতে চান?'],
            body: [
              'Start typing an area name and a list of suggestions will appear below the box.',
              'এলাকার নাম লিখতে শুরু করুন, বাক্সের নিচে সাজেশনের তালিকা আসবে।',
            ],
            action: [
              'Type a name like "Mirpur", then tap it in the list.',
              'যেমন "মিরপুর" লিখুন, তারপর তালিকা থেকে সেটিতে চাপ দিন।',
            ],
          }),
          step({
            element: '[data-tour="property-type"]',
            side: 'bottom',
            align: 'start',
            title: ['What exactly are you after?', 'ঠিক কী খুঁজছেন?'],
            body: [
              'A whole flat, one room, a mess seat, a sublet, an office, a shop — each choice shows a different set of listings.',
              'পুরো ফ্ল্যাট, একটি রুম, মেসের সিট, সাবলেট, অফিস, দোকান — প্রতিটি বাছাইয়ে আলাদা তালিকা দেখাবে।',
            ],
            action: [
              'Not sure yet? Leave it untouched and you will see everything.',
              'এখনও নিশ্চিত নন? হাত না দিয়ে রেখে দিন, তাহলে সবগুলোই দেখবেন।',
            ],
          }),
          step({
            element: '[data-tour="budget"]',
            side: 'bottom',
            align: 'end',
            title: ['How much rent is comfortable?', 'কত ভাড়া আপনার জন্য আরামদায়ক?'],
            body: [
              'Set the least and the most you are willing to pay each month. Anything outside that range is hidden.',
              'প্রতি মাসে সবচেয়ে কম আর সবচেয়ে বেশি কত দিতে পারবেন ঠিক করুন। এর বাইরের বাসা দেখানো হবে না।',
            ],
            action: [
              'Keep the range a little wide — you will see more options that way.',
              'পরিসরটা একটু বড় রাখুন — তাহলে বেশি অপশন পাবেন।',
            ],
          }),
          step({
            element: '[data-tour="search-button"]',
            side: 'bottom',
            title: ['Now see what matches', 'এবার মিল থাকা বাসাগুলো দেখুন'],
            body: [
              'This brings up every listing that fits what you chose. Nothing is locked in — you can change any of it on the results page.',
              'আপনার বাছাইয়ের সাথে মেলে এমন সব বাসা চলে আসবে। কিছুই চূড়ান্ত নয় — ফলাফলের পেজে সব বদলাতে পারবেন।',
            ],
            action: ['Tap the Search button.', 'খুঁজুন বাটনে চাপ দিন।'],
          }),
          step({
            element: '[data-tour="explore-divisions"]',
            side: 'bottom',
            align: 'start',
            title: ['Or just look around', 'অথবা শুধু ঘুরে দেখুন'],
            body: [
              'If you would rather browse than search, open any division and see what is on offer there.',
              'খোঁজার বদলে ঘুরে দেখতে চাইলে যেকোনো বিভাগ খুলে দেখুন সেখানে কী আছে।',
            ],
            action: [
              'Tap a city to open its listings.',
              'কোনো শহরে চাপ দিলে সেখানের তালিকা খুলবে।',
            ],
          }),
          step({
            element: '[data-tour="popular-areas"]',
            side: 'top',
            title: ['The areas people ask for most', 'সবচেয়ে বেশি খোঁজা এলাকাগুলো'],
            body: [
              'These neighbourhoods get the most requests, so fresh listings turn up here often.',
              'এই এলাকাগুলোতে চাহিদা সবচেয়ে বেশি, তাই নতুন বাসা এখানে ঘন ঘন আসে।',
            ],
            action: [
              'Tap an area to go straight to its listings.',
              'কোনো এলাকায় চাপ দিলে সরাসরি সেখানের তালিকায় চলে যাবেন।',
            ],
          }),
          closingStep(),
        ],
        {
          // The search bar only exists on the public home page, and signup drops
          // a new tenant on /tenant-dashboard. Go there first, then confirm we
          // actually arrived before spotlighting anything.
          ensurePath: '/',
          anchor: '[data-tour="mode-switcher"]',
          stillValid: () => window.location.pathname === '/',
        },
      ),
    [runTour, step, openingStep, closingStep],
  );

  /* ── Landlord: the dashboard, end to end ─────────────────────────────── */
  const startHostDashboardTour = useCallback(
    () =>
      runTour(
        'host-dashboard',
        (box) => {
          // Ask the app to open a piece of UI, then advance. No guessed delay
          // for the anchor itself — the step we move TO carries the tour-wide
          // `waitForElement`, so driver.js holds it until the anchor lands.
          //
          // The hold is what keeps the running blocker watch from mistaking our
          // own reveal for a popup interrupting: the logo's "where to?" modal is
          // a real role="dialog", and for the few hundred ms between it opening
          // and driver.js highlighting the option inside it there is nothing in
          // the DOM to tell the two cases apart.
          const emit = (type, detail) => {
            box.holdBlockerWatch?.();
            window.dispatchEvent(detail === undefined ? new Event(type) : new CustomEvent(type, { detail }));
          };
          const actThenNext = (type, detail, delay = 250) => {
            emit(type, detail);
            window.setTimeout(() => box.driver?.moveNext(), delay);
          };

          return [
            openingStep(
              'This is where you run everything — your properties, your tenants, and the rent. Let us walk through it together.',
              'এখান থেকেই আপনি সবকিছু চালাবেন — আপনার প্রপার্টি, ভাড়াটিয়া আর ভাড়া। চলুন একসাথে দেখে নিই।',
            ),
            step({
              element: '[data-tour="host-stats-grid"]',
              side: 'bottom',
              align: 'start',
              title: ['Your numbers at a glance', 'এক নজরে আপনার হিসাব'],
              body: [
                'How many properties you have listed, and how many people have asked about them. These update on their own.',
                'আপনি কতগুলো প্রপার্টি দিয়েছেন, আর কতজন সেগুলোর খোঁজ করেছেন। এগুলো নিজে থেকেই আপডেট হয়।',
              ],
            }),
            step({
              element: '[data-tour="host-quick-actions"]',
              side: 'top',
              align: 'start',
              title: ['Everyday jobs, one tap away', 'রোজের কাজ, এক চাপে'],
              body: [
                'Add a tenant, record a rent payment, or message someone — the things you will do most often are kept here so you never have to hunt for them.',
                'ভাড়াটিয়া যোগ করা, ভাড়া জমা লেখা, কাউকে মেসেজ দেওয়া — যে কাজগুলো সবচেয়ে বেশি করবেন সেগুলো এখানেই রাখা, যাতে খুঁজতে না হয়।',
              ],
            }),
            step({
              element: '[data-tour="host-shared-ledger"]',
              side: 'top',
              align: 'start',
              title: ['Who has paid, who has not', 'কে দিয়েছে, কে দেয়নি'],
              body: [
                'Your total rent collected and what is still outstanding, kept in one running record. No notebook needed.',
                'কত ভাড়া উঠেছে আর কত বাকি আছে, সব একটি চলমান হিসাবে। আলাদা খাতার দরকার নেই।',
              ],
              onNext: () => {
                const btn = document.getElementById('host-more-actions-btn');
                const dropdown = document.getElementById('host-more-actions-dropdown');
                if (btn && !dropdown) btn.click();
                window.setTimeout(() => box.driver?.moveNext(), 300);
              },
            }),
            step({
              element: '[data-tour="host-more-actions"]',
              side: 'top',
              align: 'start',
              reveal: true,
              title: ['The less common jobs', 'কম দরকারি কাজগুলো'],
              body: [
                'Reports, a new rent agreement, or a message to every tenant at once. Tucked in here so the main screen stays simple.',
                'রিপোর্ট, নতুন ভাড়ার চুক্তি, অথবা একবারে সব ভাড়াটিয়াকে মেসেজ। মূল পর্দা সহজ রাখতে এগুলো এখানে রাখা।',
              ],
            }),
            step({
              element: '[data-tour="host-header-add-property"]',
              side: 'bottom',
              align: 'end',
              title: ['Putting up a new property', 'নতুন প্রপার্টি দিতে চাইলে'],
              body: [
                'This starts a short form for a new listing. You can save it half-finished and come back — nothing goes public until you publish it.',
                'এটি নতুন বিজ্ঞাপনের একটি ছোট ফর্ম শুরু করে। অর্ধেক করে রেখে পরে ফিরে আসতে পারবেন — প্রকাশ না করা পর্যন্ত কিছুই কেউ দেখবে না।',
              ],
            }),
            // The phone equivalent of the step above. The header's "List
            // Property" button is `hidden sm:inline-flex`, so on a phone it gets
            // pruned and the raised "+ List" button in the bottom rail is the
            // only way in — it previously had no anchor and no step, so a mobile
            // landlord was never shown how to start a listing from the rail.
            //
            // Resolving to null while the header button is visible keeps the two
            // from BOTH appearing in the 640–767px band, where the header button
            // has already come back but the rail has not gone away yet.
            step({
              element: () =>
                (visibleAnchor('[data-tour="host-header-add-property"]')
                  ? null
                  : visibleAnchor('[data-tour="mobile-nav-list"]')),
              side: 'top',
              align: 'center',
              title: ['Putting up a new property', 'নতুন প্রপার্টি দিতে চাইলে'],
              body: [
                'The red + button at the bottom of the screen starts a short form for a new listing. You can save it half-finished and come back — nothing goes public until you publish it.',
                'পর্দার নিচের লাল + বাটনটি নতুন বিজ্ঞাপনের একটি ছোট ফর্ম শুরু করে। অর্ধেক করে রেখে পরে ফিরে আসতে পারবেন — প্রকাশ না করা পর্যন্ত কিছুই কেউ দেখবে না।',
              ],
            }),
            step({
              element: '[data-tour="host-logo"]',
              side: 'bottom',
              align: 'start',
              title: ['Getting back out', 'বাইরে ফিরতে চাইলে'],
              body: [
                'Tapping the logo asks where you want to go: the public website, or back to this dashboard.',
                'লোগোতে চাপ দিলে জিজ্ঞেস করবে কোথায় যেতে চান: পাবলিক ওয়েবসাইটে, নাকি এই ড্যাশবোর্ডেই।',
              ],
              onNext: () => actThenNext('open-home-choice-modal', undefined, 400),
            }),
            step({
              element: '[data-tour="host-home-option"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['To the public website', 'পাবলিক ওয়েবসাইটে'],
              body: [
                'This is the site your tenants see. Handy for checking how your own listing looks to them.',
                'এটি সেই সাইট যা আপনার ভাড়াটিয়ারা দেখে। আপনার নিজের বিজ্ঞাপন তাদের কেমন দেখায় তা যাচাই করতে সুবিধা।',
              ],
            }),
            step({
              element: '[data-tour="host-dashboard-option"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Or stay right here', 'অথবা এখানেই থাকুন'],
              body: [
                'Closes the question and leaves you on the dashboard.',
                'প্রশ্নটি বন্ধ করে আপনাকে ড্যাশবোর্ডেই রেখে দেবে।',
              ],
              onNext: () => actThenNext('close-home-choice-modal', undefined, 400),
            }),
            step({
              element: '[data-tour="host-profile-menu"]',
              side: 'bottom',
              align: 'end',
              title: ['Everything else is in the menu', 'বাকি সবকিছু মেনুতে'],
              body: [
                'Your profile, your settings, and every section of the dashboard live behind this one button.',
                'আপনার প্রোফাইল, সেটিংস আর ড্যাশবোর্ডের প্রতিটি অংশ এই একটি বাটনের ভেতরে।',
              ],
              onNext: () => actThenNext('open-host-drawer', undefined, 400),
            }),
            step({
              element: '[data-tour="dashboard-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Dashboard', 'ড্যাশবোর্ড'],
              body: [
                'The summary screen we just went through. This is your starting point.',
                'এইমাত্র আমরা যে সারসংক্ষেপ দেখলাম। এটিই আপনার শুরুর জায়গা।',
              ],
            }),
            step({
              element: '[data-tour="documents-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Documents and earnings', 'ডকুমেন্ট ও আয়'],
              body: [
                'Keep agreements and papers safe here, and see how your income has moved month to month.',
                'চুক্তি আর কাগজপত্র এখানে নিরাপদে রাখুন, আর মাসে মাসে আপনার আয় কেমন বেড়েছে-কমেছে দেখুন।',
              ],
            }),
            step({
              element: '[data-tour="inquiries-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['People asking about your property', 'যারা আপনার প্রপার্টির খোঁজ করছে'],
              body: [
                'Every enquiry lands here. Replying quickly is the single biggest thing you can do to rent a place faster.',
                'সব খোঁজখবর এখানে আসে। দ্রুত উত্তর দেওয়াই বাসা তাড়াতাড়ি ভাড়া হওয়ার সবচেয়ে বড় উপায়।',
              ],
            }),
            step({
              element: '[data-tour="bookings-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Your tenants and their rent', 'আপনার ভাড়াটিয়া ও তাদের ভাড়া'],
              body: [
                'Who is living where, what they owe, and what they have paid. This is your rent register.',
                'কে কোথায় আছে, কার কত বাকি, কে কত দিয়েছে। এটিই আপনার ভাড়ার খাতা।',
              ],
            }),
            step({
              element: '[data-tour="payments-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Getting paid without cash', 'নগদ ছাড়া ভাড়া পাওয়া'],
              body: [
                'Add bKash, Nagad, or a bank account once, and tenants can send rent straight to you.',
                'একবার বিকাশ, নগদ বা ব্যাংক অ্যাকাউন্ট যোগ করে দিন, ভাড়াটিয়ারা সরাসরি আপনাকে ভাড়া পাঠাতে পারবে।',
              ],
            }),
            step({
              element: '[data-tour="smart-alerts-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Things you should not miss', 'যা মিস করা চলবে না'],
              body: [
                'Rent falling due, an agreement about to end, a tenant waiting on you — the important reminders collect here.',
                'ভাড়ার সময় হয়েছে, চুক্তি শেষ হতে চলেছে, ভাড়াটিয়া আপনার উত্তরের অপেক্ষায় — গুরুত্বপূর্ণ মনে করিয়ে দেওয়াগুলো এখানে জমা হয়।',
              ],
            }),
            step({
              element: '[data-tour="ai-insights-tab"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['A second opinion', 'একটি পরামর্শ'],
              body: [
                'Suggestions on what to charge and how your listing compares with similar places nearby. Advice only — you decide.',
                'কত ভাড়া চাওয়া উচিত আর আশেপাশের একই রকম বাসার সাথে আপনার বিজ্ঞাপনের তুলনা। শুধু পরামর্শ — সিদ্ধান্ত আপনারই।',
              ],
            }),
            step({
              element: '[data-tour="add-property-button"]',
              side: 'right',
              align: 'start',
              reveal: true,
              title: ['Add a property from anywhere', 'যেকোনো জায়গা থেকে প্রপার্টি যোগ করুন'],
              body: [
                'The same new-listing form, reachable from inside the menu too.',
                'একই নতুন বিজ্ঞাপনের ফর্ম, মেনুর ভেতর থেকেও পাওয়া যায়।',
              ],
            }),
            closingStep(),
          ];
        },
        {
          anchor: '[data-tour="host-stats-grid"]',
          stillValid: () => window.location.pathname === '/host-dashboard',
          driverOptions: {
            // This tour opens the logo modal and the profile drawer to talk
            // about what is inside them, and the sidebar steps are the LAST
            // thing it does — so left alone it finished with the drawer still
            // covering the dashboard. Whether the user reaches the end or hits
            // × on step 12, put the page back the way we found it. Both events
            // are no-ops if the thing is already closed.
            onDestroyed: () => {
              window.dispatchEvent(new Event('close-home-choice-modal'));
              window.dispatchEvent(new Event('close-host-drawer'));
            },
          },
        },
      ),
    [runTour, step, openingStep, closingStep],
  );

  /* ── Landlord on the public home page: get them to the dashboard ─────── */
  const startHostTour = useCallback(async () => {
    // Not the home page? The dashboard tour is the one that matters.
    if (window.location.pathname !== '/') {
      if (window.location.pathname !== '/host-dashboard') navigate('/host-dashboard');
      await startHostDashboardTour();
      return;
    }

    const isMobile = window.innerWidth < 768;

    await runTour(
      'host',
      (box) =>
        isMobile
          ? [
              step({
                element: '[data-tour="mobile-nav-home"]',
                side: 'top',
                title: ['Your dashboard is the control room', 'ড্যাশবোর্ডই আপনার নিয়ন্ত্রণ কক্ষ'],
                body: [
                  'Everything to do with your properties — tenants, rent, messages, papers — is kept together in one place.',
                  'আপনার প্রপার্টির সব কিছু — ভাড়াটিয়া, ভাড়া, মেসেজ, কাগজপত্র — এক জায়গায় একসাথে রাখা।',
                ],
                action: ['Press Next and we will open it.', 'পরবর্তী চাপুন, আমরা খুলে দিচ্ছি।'],
                onNext: () => {
                  box.driver?.destroy();
                  navigate('/host-dashboard');
                },
              }),
            ]
          : [
              step({
                element: '[data-tour="navbar-profile"]',
                side: 'bottom',
                align: 'end',
                title: ['Your menu lives here', 'আপনার মেনু এখানে'],
                body: [
                  'This button opens everything to do with your account, including your dashboard.',
                  'এই বাটনটি আপনার অ্যাকাউন্টের সব কিছু খোলে, ড্যাশবোর্ডসহ।',
                ],
                action: ['Press Next to open it.', 'খুলতে পরবর্তী চাপুন।'],
                onNext: () => {
                  window.dispatchEvent(new Event('open-navbar-profile'));
                  window.setTimeout(() => box.driver?.moveNext(), 300);
                },
              }),
              step({
                element: '[data-tour="host-dashboard-link"]',
                side: 'left',
                align: 'start',
                reveal: true,
                title: ['Your dashboard is the control room', 'ড্যাশবোর্ডই আপনার নিয়ন্ত্রণ কক্ষ'],
                body: [
                  'Everything to do with your properties — tenants, rent, messages, papers — is kept together in one place.',
                  'আপনার প্রপার্টির সব কিছু — ভাড়াটিয়া, ভাড়া, মেসেজ, কাগজপত্র — এক জায়গায় একসাথে রাখা।',
                ],
                action: ['Press Next and we will open it.', 'পরবর্তী চাপুন, আমরা খুলে দিচ্ছি।'],
                onNext: () => {
                  box.driver?.destroy();
                  navigate('/host-dashboard');
                },
              }),
            ],
      {
        anchor: isMobile ? '[data-tour="mobile-nav-home"]' : '[data-tour="navbar-profile"]',
        // App.jsx sends an authenticated landlord from "/" to /host-dashboard on
        // boot. This tour anchors to the public navbar, so if that redirect is in
        // flight we must NOT drive — the old code did, and left an orphaned
        // popover pointing at a navbar that had already unmounted, which then
        // blocked the dashboard tour behind it.
        stillValid: () => window.location.pathname === '/',
      },
    );
  }, [runTour, step, navigate, startHostDashboardTour]);

  /* ── The new-listing wizard, one tour per page ───────────────────────── */
  const startAddPropertyTour = useCallback(
    (stepIndex = 1) => {
      const pages = {
        1: {
          anchor: '[data-tour="property-intent"]',
          build: () => [
            step({
              element: '[data-tour="property-intent"]',
              side: 'top',
              align: 'start',
              title: ['What do you want to do with it?', 'এটি নিয়ে আপনি কী করতে চান?'],
              body: [
                'Rent it out, sell it, or offer it as a commercial space. This decides which questions we ask you next.',
                'ভাড়া দেবেন, বিক্রি করবেন, নাকি বাণিজ্যিক জায়গা হিসেবে দেবেন। এর উপরই ঠিক হবে পরে আমরা কী কী জিজ্ঞেস করব।',
              ],
              action: ['Pick one to begin.', 'শুরু করতে একটি বেছে নিন।'],
            }),
            step({
              element: '[data-tour="property-title"]',
              side: 'top',
              align: 'start',
              title: ['Give it a clear name', 'একটি পরিষ্কার নাম দিন'],
              body: [
                'This is the line people read first. Plain and specific works best — something like "3 bedroom flat in Mirpur 10, gas line".',
                'মানুষ সবার আগে এই লাইনটাই পড়ে। সহজ আর নির্দিষ্ট হলে সবচেয়ে ভালো কাজ করে — যেমন "মিরপুর ১০-এ ৩ বেডরুমের ফ্ল্যাট, গ্যাস লাইন আছে"।',
              ],
              action: [
                'Avoid words like "best" — say what the place actually is.',
                '"সেরা" জাতীয় শব্দ এড়িয়ে যান — জায়গাটি আসলে কী তা লিখুন।',
              ],
            }),
            step({
              element: '[data-tour="property-location"]',
              side: 'top',
              align: 'start',
              title: ['Where is it?', 'এটি কোথায়?'],
              body: [
                'Division, district, thana, then the full address. The more exact you are, the more of the right people find it.',
                'বিভাগ, জেলা, থানা, তারপর সম্পূর্ণ ঠিকানা। যত নির্দিষ্ট লিখবেন, তত বেশি সঠিক মানুষ এটি খুঁজে পাবে।',
              ],
              action: [
                'Fill the boxes from the top down — each one narrows the next.',
                'উপর থেকে নিচে বাক্সগুলো পূরণ করুন — প্রতিটি পরেরটিকে ছোট করে আনে।',
              ],
            }),
            step({
              element: '[data-tour="property-gps"]',
              side: 'top',
              align: 'start',
              title: ['Put a pin on the map', 'ম্যাপে একটি পিন বসান'],
              body: [
                'This is optional, but it helps a lot: press the GPS button while you are at the property and it marks the exact spot on the map for visitors.',
                'এটি ঐচ্ছিক, তবে অনেক কাজে দেয়: প্রপার্টিতে থাকা অবস্থায় GPS বাটনে চাপ দিলে ম্যাপে ঠিক জায়গাটি চিহ্নিত হয়ে যায়, যা দেখতে আসা মানুষ দেখতে পায়।',
              ],
              action: [
                'Somewhere else right now? Skip it and add it later.',
                'এখন অন্য কোথাও আছেন? বাদ দিয়ে পরে যোগ করুন।',
              ],
            }),
          ],
        },
        2: {
          anchor: '[data-tour="property-details"]',
          build: () => [
            step({
              element: '[data-tour="property-details"]',
              side: 'top',
              align: 'start',
              title: ['The basic facts', 'মূল তথ্যগুলো'],
              body: [
                'Bedrooms, bathrooms, floor, size. People filter their search on exactly these numbers, so getting them right matters more than it looks.',
                'বেডরুম, বাথরুম, তলা, আয়তন। মানুষ ঠিক এই সংখ্যাগুলো দিয়েই খোঁজে, তাই এগুলো সঠিক দেওয়া যতটা মনে হয় তার চেয়ে বেশি জরুরি।',
              ],
              action: [
                'Not sure of the size? A close estimate is better than leaving it blank.',
                'আয়তন জানা নেই? খালি রাখার চেয়ে কাছাকাছি একটি অনুমান লেখা ভালো।',
              ],
            }),
          ],
        },
        3: {
          anchor: '[data-tour="property-amenities"]',
          build: () => [
            step({
              element: '[data-tour="property-amenities"]',
              side: 'top',
              align: 'start',
              title: ['What comes with the place?', 'জায়গার সাথে কী কী আছে?'],
              body: [
                'Lift, generator, parking, gas line, water supply. These are usually the first things a tenant asks about on the phone — answering them here saves you the call.',
                'লিফট, জেনারেটর, পার্কিং, গ্যাস লাইন, পানির ব্যবস্থা। ফোনে ভাড়াটিয়ারা সাধারণত এগুলোই প্রথমে জিজ্ঞেস করে — এখানে উত্তর দিয়ে রাখলে সেই ফোনটাই বাঁচে।',
              ],
              action: [
                'Tick only what the property really has.',
                'যা সত্যিই আছে শুধু সেগুলোতেই টিক দিন।',
              ],
            }),
          ],
        },
        4: {
          anchor: '[data-tour="property-media"]',
          build: () => [
            step({
              element: '[data-tour="property-media"]',
              side: 'top',
              align: 'start',
              title: ['Photos do most of the work', 'ছবিই বেশিরভাগ কাজ করে'],
              body: [
                'Listings with clear photos get far more enquiries than ones without. Daylight, windows open, and one picture of each room is plenty.',
                'পরিষ্কার ছবি থাকা বিজ্ঞাপনে ছবি না থাকার চেয়ে অনেক বেশি খোঁজ আসে। দিনের আলোয়, জানালা খুলে, প্রতিটি রুমের একটি করে ছবি হলেই যথেষ্ট।',
              ],
              action: [
                'Put your best photo first — it becomes the cover picture.',
                'সবচেয়ে ভালো ছবিটি প্রথমে দিন — সেটিই কভার ছবি হবে।',
              ],
            }),
          ],
        },
        5: {
          anchor: '[data-tour="property-pricing"]',
          build: () => [
            step({
              element: '[data-tour="property-pricing"]',
              side: 'top',
              align: 'start',
              title: ['Rent, advance, and service charge', 'ভাড়া, অ্যাডভান্স ও সার্ভিস চার্জ'],
              body: [
                'Write down every amount you will actually ask for. Surprises at the end are the most common reason a deal falls through.',
                'আপনি সত্যিই যত টাকা চাইবেন, প্রতিটি এখানে লিখে দিন। শেষ মুহূর্তে অপ্রত্যাশিত খরচই চুক্তি ভেঙে যাওয়ার সবচেয়ে সাধারণ কারণ।',
              ],
              action: [
                'Unsure what to charge? The dashboard suggests a range for your area.',
                'কত চাইবেন বুঝতে পারছেন না? ড্যাশবোর্ড আপনার এলাকার জন্য একটি পরিসর জানিয়ে দেয়।',
              ],
            }),
            step({
              element: '[data-tour="property-description"]',
              side: 'top',
              align: 'start',
              title: ['Tell them about it', 'জায়গাটি সম্পর্কে বলুন'],
              body: [
                'Who the place suits, what is nearby, any house rules. If writing is a chore, press the AI button and it drafts this from what you have already filled in.',
                'কাদের জন্য জায়গাটি উপযুক্ত, আশেপাশে কী আছে, কোনো নিয়ম থাকলে তা। লিখতে ঝামেলা লাগলে AI বাটনে চাপ দিন — আপনি যা যা দিয়েছেন তা থেকেই এটি লিখে দেবে।',
              ],
              action: [
                'You can edit whatever the AI writes before you publish.',
                'AI যা লিখবে, প্রকাশ করার আগে আপনি তা বদলে নিতে পারবেন।',
              ],
            }),
          ],
        },
      };

      const page = pages[stepIndex];
      if (!page) return Promise.resolve();

      return runTour(`add-property-step-${stepIndex}`, page.build, {
        anchor: page.anchor,
        stillValid: () => window.location.pathname.startsWith('/list-property'),
      });
    },
    [runTour, step],
  );

  /* ── Roommate wallet ────────────────────────────────────────────────── */
  const startLivingTour = useCallback(
    () =>
      runTour(
        'living',
        (box) => {
          // Both tab rails are always mounted — the breakpoint only hides one —
          // so resolve lazily and pick whichever one the user can actually see,
          // even after a resize.
          const tabAnchor = (id) => () =>
            visibleAnchor(`[data-tour="living-mobile-nav"] [data-tour="living-tab-${id}"]`) ||
            visibleAnchor(`[data-tour="living-desktop-nav"] [data-tour="living-tab-${id}"]`);
          const tabSide = () => (window.innerWidth < 1024 ? 'bottom' : 'right');

          // Held for the same reason as the host tour's emit — a sheet this tour
          // opens itself must not read as a popup barging in.
          const emit = (type, detail) => {
            box.holdBlockerWatch?.();
            window.dispatchEvent(new CustomEvent(type, { detail }));
          };
          const actThenNext = (type, detail, delay = 0) => {
            emit(type, detail);
            window.setTimeout(() => box.driver?.moveNext(), delay);
          };
          const actThenPrev = (type, detail) => {
            emit(type, detail);
            window.setTimeout(() => box.driver?.movePrevious(), 0);
          };

          // A module swap mounts behind a framer-motion enter transition, so the
          // rect driver.js measured at highlight time is a few px stale.
          // Re-measure once that transition has settled.
          const settle = () => {
            window.setTimeout(() => {
              if (box.driver?.isActive()) box.driver.refresh();
            }, MODULE_SETTLE_MS);
          };

          const steps = [
            step({
              element: '[data-tour="living-header"]',
              side: 'bottom',
              align: 'start',
              title: ['Sharing costs, without the arguments', 'খরচ ভাগাভাগি, ঝগড়া ছাড়াই'],
              body: [
                'Meals, groceries, bills, rent — everything you split with the people you live with is added up here, so nobody has to remember who paid for what.',
                'মিল, বাজার, বিল, বাড়িভাড়া — যাদের সাথে থাকেন তাদের সাথে যা যা ভাগ করেন সব এখানে যোগ হয়, তাই কে কী দিয়েছে কারও মনে রাখতে হয় না।',
              ],
            }),
          ];

          if (visibleAnchor('[data-tour="living-connect-roommates"]')) {
            steps.push(
              step({
                element: '[data-tour="living-connect-roommates"]',
                side: 'top',
                title: ['Start by making a wallet', 'শুরু হোক একটি ওয়ালেট বানিয়ে'],
                body: [
                  'One shared wallet holds the accounts for your whole flat or mess. Make a new one, or join an existing one with the code a roommate gives you.',
                  'একটি শেয়ার্ড ওয়ালেটেই আপনার পুরো ফ্ল্যাট বা মেসের হিসাব থাকে। নতুন একটি বানান, অথবা রুমমেটের দেওয়া কোড দিয়ে আগের একটিতে যুক্ত হোন।',
                ],
                onNext: () => actThenNext('tour:action', 'open-connect'),
              }),
              step({
                element: '[data-tour="connect-sheet"]',
                side: 'top',
                reveal: true,
                title: ['Then invite the others', 'তারপর বাকিদের ডাকুন'],
                body: [
                  'Once it is made you get a short invite code. Anyone who enters that code joins the same accounts and sees the same totals as you.',
                  'বানানো হয়ে গেলে আপনি একটি ছোট ইনভাইট কোড পাবেন। যে কেউ সেই কোড দিলে একই হিসাবে যুক্ত হবে এবং আপনার মতো একই মোট অঙ্ক দেখবে।',
                ],
                onNext: () => actThenNext('tour:action', 'close-connect', SHEET_EXIT_MS),
                onPrev: () => actThenPrev('tour:action', 'close-connect'),
              }),
            );
          } else if (visibleAnchor('[data-tour="living-invite-code"]')) {
            steps.push(
              step({
                element: '[data-tour="living-invite-code"]',
                side: 'top',
                title: ['Your invite code', 'আপনার ইনভাইট কোড'],
                body: [
                  'Send this code to your roommates. Entering it puts them into the same accounts as you, seeing the same totals.',
                  'এই কোডটি আপনার রুমমেটদের পাঠান। কোডটি দিলে তারা আপনার একই হিসাবে যুক্ত হবে এবং একই মোট অঙ্ক দেখবে।',
                ],
              }),
            );
          }

          if (visibleAnchor('[data-tour="living-add-roommate"]')) {
            steps.push(
              step({
                element: '[data-tour="living-add-roommate"]',
                side: 'top',
                align: 'end',
                title: ['Roommates who are not on the app', 'যে রুমমেটরা অ্যাপে নেই'],
                body: [
                  'Not everyone will install this, and that is fine. Add them by name and their share is still counted properly.',
                  'সবাই এটি ইনস্টল করবে না, তাতে অসুবিধা নেই। নাম দিয়ে যোগ করে দিন, তাদের ভাগও ঠিকঠাক হিসাবে আসবে।',
                ],
                onNext: () => actThenNext('tour:action', 'open-add-roommate'),
              }),
              step({
                element: '[data-tour="add-roommate-sheet"]',
                side: 'top',
                reveal: true,
                title: ['Just a name and a colour', 'শুধু একটি নাম আর একটি রঙ'],
                body: [
                  'The colour is what makes each person easy to pick out in the lists later.',
                  'রঙটি পরে তালিকায় প্রত্যেককে সহজে আলাদা করে চিনতে সাহায্য করে।',
                ],
                onNext: () => actThenNext('tour:action', 'close-add-roommate', SHEET_EXIT_MS),
                onPrev: () => actThenPrev('tour:action', 'close-add-roommate'),
              }),
            );
          }

          steps.push(
            step({
              element: tabAnchor('meals'),
              side: tabSide(),
              title: ['Meals', 'মিল'],
              body: [
                'The meal accounts for your mess: who ate how many, what the bazar cost, and what each person owes at month end.',
                'আপনার মেসের মিলের হিসাব: কে কত মিল খেয়েছে, বাজারে কত গেছে, আর মাস শেষে কার কত হয়েছে।',
              ],
              action: ['Let us look inside.', 'চলুন ভেতরে দেখি।'],
              onNext: () => actThenNext('tour:tab', 'meals'),
            }),
            step({
              element: '[data-tour="add-deposit-btn"]',
              side: 'top',
              reveal: true,
              onHighlighted: settle,
              title: ['Money going into the fund', 'ফান্ডে টাকা জমা'],
              body: [
                'When someone hands over their share for the month, record it here. The fund balance goes up by that much.',
                'কেউ মাসের ভাগের টাকা দিলে সেটি এখানে লিখে রাখুন। ফান্ডের ব্যালেন্স ততটাই বাড়বে।',
              ],
              onNext: () => actThenNext('tour:action', 'open-deposit'),
            }),
            step({
              element: '[data-tour="deposit-sheet"]',
              side: 'top',
              reveal: true,
              title: ['Who paid, and how much', 'কে দিয়েছে, কত দিয়েছে'],
              body: [
                'Pick the person, put in the amount, and add a note if you want to remember the details.',
                'ব্যক্তিকে বেছে নিন, পরিমাণ লিখুন, আর বিস্তারিত মনে রাখতে চাইলে একটি নোট যোগ করুন।',
              ],
              onNext: () => actThenNext('tour:action', 'close-deposit', SHEET_EXIT_MS),
              onPrev: () => actThenPrev('tour:action', 'close-deposit'),
            }),
            step({
              element: '[data-tour="add-bazar-btn"]',
              side: 'top',
              reveal: true,
              title: ['Money going out for bazar', 'বাজারে খরচ হওয়া টাকা'],
              body: [
                'Each day\'s market spend goes in here. This is what the meal rate is worked out from, so try to enter it the same day.',
                'প্রতিদিনের বাজার খরচ এখানে যোগ হয়। এর উপরই মিল রেট হিসাব হয়, তাই একই দিনে লিখে ফেলার চেষ্টা করুন।',
              ],
              onNext: () => actThenNext('tour:action', 'open-bazar'),
            }),
            step({
              element: '[data-tour="grocery-sheet"]',
              side: 'top',
              reveal: true,
              title: ['What the bazar cost', 'বাজারে কত গেল'],
              body: [
                'The amount, who went, and a note if you like. It comes straight out of the shared fund.',
                'পরিমাণ, কে গিয়েছিল, আর চাইলে একটি নোট। এটি সরাসরি শেয়ার্ড ফান্ড থেকে কাটা হয়।',
              ],
              onNext: () => actThenNext('tour:action', 'close-bazar', SHEET_EXIT_MS),
              onPrev: () => actThenPrev('tour:action', 'close-bazar'),
            }),
            step({
              element: '[data-tour="set-rate-btn"]',
              side: 'bottom',
              align: 'start',
              reveal: true,
              title: ['How the meal rate is decided', 'মিল রেট কীভাবে ঠিক হবে'],
              body: [
                'Leave it automatic and we divide the bazar total by the meals eaten. Or fix your own rate if your mess has always done it that way.',
                'অটোমেটিক রেখে দিলে আমরা মোট বাজারকে মোট মিল দিয়ে ভাগ করে দিই। অথবা আপনার মেসে যেভাবে চলে আসছে, সেভাবে নিজের রেট বসিয়ে দিন।',
              ],
              onNext: () => actThenNext('tour:action', 'open-rate'),
            }),
            step({
              element: '[data-tour="rate-sheet"]',
              side: 'top',
              reveal: true,
              title: ['Pick the way you prefer', 'আপনার পছন্দের নিয়মটি বেছে নিন'],
              body: [
                'You can change this whenever you like — the totals recalculate on their own.',
                'যখন খুশি এটি বদলাতে পারবেন — মোট হিসাব নিজে থেকেই আবার হয়ে যাবে।',
              ],
              onNext: () => actThenNext('tour:action', 'close-rate', SHEET_EXIT_MS),
              onPrev: () => actThenPrev('tour:action', 'close-rate'),
            }),
            step({
              element: tabAnchor('expenses'),
              side: tabSide(),
              title: ['Shared expenses', 'শেয়ার্ড খরচ'],
              body: [
                'The costs that are not food: the cleaner, the internet, a repair. Split evenly, or only among the people it applies to.',
                'খাবার ছাড়া বাকি খরচ: বুয়া, ইন্টারনেট, কোনো মেরামত। সমানভাবে ভাগ করুন, অথবা যাদের জন্য প্রযোজ্য শুধু তাদের মধ্যেই।',
              ],
              onNext: () => actThenNext('tour:tab', 'expenses'),
            }),
            step({
              element: tabAnchor('bills'),
              side: tabSide(),
              title: ['Monthly bills', 'মাসিক বিল'],
              body: [
                'Rent, gas, electricity, water — the ones that come every month. Mark them paid as you go and you will always know what is still owed.',
                'বাড়িভাড়া, গ্যাস, বিদ্যুৎ, পানি — যেগুলো প্রতি মাসে আসে। দেওয়ার সাথে সাথে পরিশোধিত চিহ্ন দিয়ে রাখলে কী বাকি আছে সবসময় জানা থাকবে।',
              ],
              onNext: () => actThenNext('tour:tab', 'bills'),
              // Last step. driver.js prefers onDoneClick here, and any popover
              // click handler *replaces* the built-in advance — so this one has
              // to land the user on Bills and tear the tour down itself.
              onDone: () => {
                emit('tour:tab', 'bills');
                box.driver?.destroy();
              },
            }),
          );

          return steps;
        },
        {
          anchor: '[data-tour="living-header"]',
          // Re-checked after the anchor wait: a user who flips to the solo
          // wallet in those few seconds should not get the roommate tour.
          stillValid: () =>
            window.location.pathname === '/living' && useLivingStore.getState().mode === 'joint',
          driverOptions: {
            onDestroyed: () => {
              // The tour can end mid-sheet (Finish, Esc, ×), so never leave a
              // Sheet open over the page on the way out.
              window.dispatchEvent(new CustomEvent('tour:action', { detail: 'close-all' }));
            },
          },
        },
      ),
    [runTour, step],
  );

  /* ── Search results ─────────────────────────────────────────────────── */
  const startSearchTour = useCallback(
    () =>
      runTour(
        'search',
        () => [
          step({
            element: '[data-tour="desktop-filter-sidebar"], [data-tour="mobile-filter-btn"]',
            side: 'right',
            align: 'start',
            title: ['Too many results? Narrow them down', 'অনেক বেশি ফলাফল? কমিয়ে আনুন'],
            body: [
              'Rather than scrolling through everything, cut the list down by area, type, rent, or the facilities you need.',
              'সবকিছু স্ক্রল করার বদলে এলাকা, ধরন, ভাড়া বা আপনার দরকারি সুবিধা অনুযায়ী তালিকা ছোট করে নিন।',
            ],
            action: [
              'Change one filter at a time so you can see what it did.',
              'একবারে একটি ফিল্টার বদলান, তাহলে বুঝতে পারবেন কী হলো।',
            ],
          }),
          step({
            element: '[data-tour="inquiry-button"]',
            side: 'top',
            title: ['Found one you like?', 'পছন্দ হয়েছে কোনোটি?'],
            body: [
              'This tells the landlord you are interested and opens a direct line to them. You can chat or call from there.',
              'এটি বাড়িওয়ালাকে জানিয়ে দেয় যে আপনি আগ্রহী, আর তার সাথে সরাসরি যোগাযোগের পথ খুলে দেয়। এরপর চ্যাট বা কল করতে পারবেন।',
            ],
            action: [
              'Your phone number stays private until you choose to share it.',
              'আপনি নিজে না দিলে আপনার ফোন নম্বর গোপন থাকে।',
            ],
          }),
          step({
            element: '[data-tour="details-button"]',
            side: 'top',
            title: ['See the whole place first', 'আগে পুরো জায়গাটি দেখে নিন'],
            body: [
              'Every photo and video, the full list of facilities, the rent terms, and exactly where it sits on the map.',
              'সব ছবি ও ভিডিও, সুযোগ-সুবিধার পূর্ণ তালিকা, ভাড়ার শর্ত, আর ম্যাপে ঠিক কোথায় সেটি আছে।',
            ],
            action: [
              'Worth a look before you get in touch.',
              'যোগাযোগ করার আগে একবার দেখে নেওয়া ভালো।',
            ],
          }),
        ],
        {
          anchor: '[data-tour="desktop-filter-sidebar"], [data-tour="mobile-filter-btn"]',
          alsoWaitFor: '[data-tour="details-button"], [data-tour="inquiry-button"]',
          stillValid: () => window.location.pathname.startsWith('/properties'),
        },
      ),
    [runTour, step],
  );

  /* ══════════════════════════════════════════════════════════════════════
     8. WHEN TOURS START
     Two ways in, and both are gated by the same per-account record, so a tour
     can only ever run once no matter which path fires first:

       • straight after the signup welcome popup closes (the fast path)
       • on arriving at the relevant page (the safety net, for anyone who
         dismissed the popup, signed up before the tour existed, or logged in
         on a new device)

     What is deliberately NOT a trigger any more: the LOGIN welcome popup. It
     appears on every single login until the user opts out, and it used to chain
     into a tour attempt each time — half of the "it starts every time I log in"
     complaint. Signing up is a first-run event; logging in is not.
     ══════════════════════════════════════════════════════════════════════ */

  const [pendingTourRole, setPendingTourRole] = useState(null);

  useEffect(() => {
    const handleWelcomeTriggered = (event) => {
      const { role, type } = event.detail || {};
      if (type === 'signup' && role) setPendingTourRole(role);
    };

    const handleWelcomeFinished = () => {
      if (!pendingTourRole) return;
      const role = pendingTourRole;
      setPendingTourRole(null);
      // The popup closing is the clearest possible signal that the screen is
      // free again, so give every tour its attempts back. A route-level effect
      // may already have spent some of them waiting behind this very popup.
      attemptsRef.current = {};
      // No delay and no DOM check here on purpose. This event fires as the robot
      // BEGINS its exit animation, so its card is still on screen — that is
      // precisely why the tour used to open on top of the popup. runTour waits
      // for the overlay to actually leave before it drives anything.
      if (role === 'tenant') startTenantTour();
      else if (role === 'landlord' || role === 'host') startHostTour();
    };

    window.addEventListener('triggerWelcomeRobot', handleWelcomeTriggered);
    window.addEventListener('welcomeRobotFinished', handleWelcomeFinished);
    return () => {
      window.removeEventListener('triggerWelcomeRobot', handleWelcomeTriggered);
      window.removeEventListener('welcomeRobotFinished', handleWelcomeFinished);
    };
  }, [pendingTourRole, startTenantTour, startHostTour]);

  const isLandlord = activeRole === 'landlord' || activeRole === 'host';
  const path = location.pathname;
  // Which Living wallet is open ('solo' | 'joint' | null) — gates the Living tour below.
  const livingMode = useLivingStore((s) => s.mode);

  // Home page. A landlord gets pointed at their dashboard, a tenant gets the
  // search walkthrough. `retryTick` is in the deps so a tour turned away by a
  // popup gets another go once the screen is free.
  useEffect(() => {
    if (path !== '/' || activeTour) return;
    if (isLandlord) startHostTour();
    else if (activeRole === 'tenant') startTenantTour();
  }, [path, isLandlord, activeRole, activeTour, retryTick, startHostTour, startTenantTour]);

  useEffect(() => {
    if (path !== '/host-dashboard' || activeTour) return;
    startHostDashboardTour();
  }, [path, activeTour, retryTick, startHostDashboardTour]);

  // The Living tour teaches the SHARED wallet (meals, bazar, split expenses),
  // so it only runs once that wallet is the one on screen. On the mode picker
  // or the solo ledger its anchors don't exist — and re-running it there would
  // burn the tour's start attempts pointing at things the user can't see.
  // Reading the mode reactively means picking "যৌথ" starts it right away.
  useEffect(() => {
    if (path !== '/living' || activeTour) return;
    if (livingMode !== 'joint') return;
    startLivingTour();
  }, [path, activeTour, retryTick, startLivingTour, livingMode]);

  useEffect(() => {
    if (!path.startsWith('/properties') || activeTour) return;
    startSearchTour();
  }, [path, activeTour, retryTick, startSearchTour]);

  const value = {
    activeTour,
    startTenantTour,
    startHostTour,
    startHostDashboardTour,
    startAddPropertyTour,
    startLivingTour,
    startSearchTour,
    hasTourCompleted: isTourDone,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
