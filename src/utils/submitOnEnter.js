/*
 * submitOnEnter.js
 * ──────────────────────────────────────────────────────────────────────────
 * Enter submits the form.
 *
 * WHY THIS IS NEEDED AT ALL
 * These forms are `<div>`s holding inputs and a `<button onClick>`, not real
 * `<form onSubmit>` elements. A browser only gives you Enter-to-submit inside a
 * `<form>`, so pressing Enter here did nothing — the landlord typed a room
 * number, hit Enter, and the app sat there.
 *
 * WHY NOT JUST WRAP EVERYTHING IN <form>
 * Inside a `<form>`, a `<button>` with no `type` defaults to `type="submit"`.
 * These screens are full of buttons that are not submits — the আছে/নেই toggles,
 * the profession chips, seat removers, the format picker. Wrapping the
 * containers would turn every one of them into a save. The blast radius is
 * larger than the bug.
 *
 * So: one keydown handler on the container, with the exclusions a native form
 * would give you for free.
 *
 * WHAT IT DELIBERATELY IGNORES
 *   textarea          Enter is a newline there. Notes and addresses need it.
 *   button / a        Enter already activates them; handling it too would
 *                     fire the focused button AND the submit.
 *   select            Enter closes the dropdown.
 *   contentEditable   same reasoning as textarea.
 *   Shift+Enter       the universal "newline, not send".
 *   IME composition   THE IMPORTANT ONE HERE. Typing Bengali (or any language
 *                     using an input method) commits a candidate with Enter.
 *                     Submitting on that keystroke would save the form
 *                     mid-word, every time, for the users this app is for.
 */

/**
 * Build an onKeyDown handler that runs `handler` when Enter is pressed.
 *
 * @param {Function} handler        what Enter should do — usually the primary button's onClick
 * @param {object}   [opts]
 * @param {boolean}  [opts.enabled] set false to switch it off (e.g. while saving)
 * @returns {(e: KeyboardEvent) => void}
 */
export const submitOnEnter = (handler, { enabled = true } = {}) => (e) => {
  if (!enabled || typeof handler !== 'function') return;
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

  // Mid-composition: the Enter is choosing a candidate, not submitting.
  // `isComposing` is the modern signal; keyCode 229 is the older one that some
  // Android keyboards still send.
  if (e.nativeEvent?.isComposing || e.isComposing || e.keyCode === 229) return;

  const el = e.target;
  const tag = el?.tagName;
  if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT') return;
  if (el?.isContentEditable) return;
  // A file input opens its picker on Enter; let it.
  if (tag === 'INPUT' && el.type === 'file') return;

  e.preventDefault();
  handler(e);
};

export default submitOnEnter;
