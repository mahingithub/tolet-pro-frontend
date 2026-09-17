// ─── FOCUS MODALITY ────────────────────────────────────────────────────────
// Puts `tp-keyboard-nav` on <html> while the user is navigating with the
// keyboard, and takes it off again on the next pointer interaction.
//
// WHY THIS EXISTS. The focus rules in index.css need to tell "this field was
// tabbed into" apart from "this field was tapped". For buttons, links and
// selects the browser already does that — :focus-visible matches on Tab and
// not on a tap. For TEXT-ENTRY fields it does not: the spec has
// <input type=text> and <textarea> match :focus-visible however focus arrived,
// so a CSS-only rule paints a focus ring on every tap into every field. On a
// phone that is a crimson rectangle appearing under every keyboard, squared
// off against the rounded pills it sits inside, on a device that has never
// seen a Tab key. See the FOCUS RING block in index.css for the full story.
//
// So we track the modality ourselves and let CSS ask about it.

const KEYBOARD_NAV_CLASS = 'tp-keyboard-nav';

export function installFocusModality() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const setKeyboardNav = (on) => root.classList.toggle(KEYBOARD_NAV_CLASS, on);

  // Tab is the only key that MOVES focus, so it is the only key that turns the
  // ring on. Deliberately NOT the arrow keys: pressing ArrowLeft to move the
  // caret in a field you just tapped is editing, not navigating, and lighting
  // a ring up mid-sentence is the same visual noise this whole change removes.
  // Arrow-key navigation inside radio groups, menus and selects is unaffected
  // — those are non-text controls and keep native :focus-visible, which
  // handles them correctly on its own.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab') setKeyboardNav(true);
    },
    true,
  );

  // Any pointer press ends keyboard mode. Capture phase, so a component that
  // calls stopPropagation() on its own handlers cannot strand the flag on and
  // leave rings painted for the rest of the session. pointerdown covers mouse,
  // pen and touch in one event; mousedown/touchstart are there for WebViews
  // old enough to lack Pointer Events, and are harmless duplicates elsewhere.
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
    window.addEventListener(type, () => setKeyboardNav(false), {
      capture: true,
      passive: true,
    });
  }
}
