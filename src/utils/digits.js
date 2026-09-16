/**
 * digits.js — ১০১ is a number too.
 * ──────────────────────────────────────────────────────────────────────────
 * A landlord on a Bangla keyboard types ১০১, not 101. Two things used to throw
 * that away:
 *   • <input type="number"> — the browser silently drops ১০১ before React
 *     ever sees it, so the field just stays empty and nothing says why.
 *   • `\d` / `\D` in JavaScript match ASCII digits only, so "১০১" read as a
 *     string with no digits in it at all.
 *
 * So digits are folded to ASCII at the door — installDigitInput() rewrites
 * numeric fields as they are typed — and again wherever text is parsed that
 * never came through a typed field: paste handlers, stored values, scans.
 *
 * There are no `type="number"` inputs in this app for the same reason; a
 * numeric field is `type="text" inputMode="numeric|decimal" data-number`.
 * src/test/digits.test.jsx fails if one creeps back in.
 *
 * Mirrors toAsciiDigits() in the backend's utils/roomKey.js.
 */

// Bengali ০-৯ (U+09E6…) and Arabic-Indic ٠-٩ (U+0660…).
const FOREIGN_DIGIT = /[০-৯٠-٩]/g;
const BN_ZERO = 0x09e6;
const AR_ZERO = 0x0660;

/** '১০১' → '101', 'রুম ১০১' → 'রুম 101'. Everything that is not a digit is kept. */
export function toAsciiDigits(s) {
  return String(s ?? '').replace(FOREIGN_DIGIT, (d) => {
    const code = d.charCodeAt(0);
    return String(code - (code >= BN_ZERO ? BN_ZERO : AR_ZERO));
  });
}

/**
 * What an <input type="number"> would have allowed, in either script: digits,
 * one decimal point, a leading minus (basement floors). '৫,০০০' → '5000'.
 */
export function toNumericText(s) {
  let out = '';
  let dot = false;
  for (const ch of toAsciiDigits(s)) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !dot) { out += ch; dot = true; }
    else if (ch === '-' && out === '') out += ch;
  }
  return out;
}

// Which typed fields are folded. Free text is left alone on purpose — a Bangla
// address keeps its ১২/৩ — so only fields that are explicitly numeric
// (`data-number`, stripped to a number) or that open a number pad (digits
// folded, the rest kept: "+880 ১৭…" still has its "+").
const NUMBER_PAD = new Set(['numeric', 'decimal', 'tel']);

function cleanerFor(el) {
  if (!el || el.tagName !== 'INPUT') return null;
  if (el.hasAttribute('data-number')) return toNumericText;
  if (el.type === 'tel' || NUMBER_PAD.has(el.getAttribute('inputmode'))) return toAsciiDigits;
  return null;
}

const installed = new WeakSet();

/**
 * One document-level listener instead of a fix in every form.
 *
 * It runs in the CAPTURE phase, so it rewrites the field before React's own
 * listener (on the root, further down) reads it — onChange receives '101', and
 * state never holds a Bengali digit.
 *
 * The value is written with the PROTOTYPE setter. React keeps its own copy of
 * the last value on the element itself; assigning `el.value` would update that
 * copy too, React would conclude nothing changed, and onChange would never
 * fire. Going round it is what lets React see the edit.
 */
export function installDigitInput(doc = document) {
  if (!doc || installed.has(doc)) return;
  installed.add(doc);

  const win = doc.defaultView;
  const setValue = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;

  const fold = (el) => {
    const clean = cleanerFor(el);
    if (!clean) return false;
    const before = el.value;
    const after = clean(before);
    if (after === before) return false;

    let caret = null;
    try { caret = el.selectionEnd; } catch { /* this input type has no selection */ }
    setValue.call(el, after);
    // Keep the caret where the user was typing, not flung to the end.
    if (caret != null) {
      const at = clean(before.slice(0, caret)).length;
      try { el.setSelectionRange(at, at); } catch { /* as above */ }
    }
    return true;
  };

  doc.addEventListener('input', (e) => {
    // Rewriting the value mid-composition makes an IME commit twice. Leave it
    // alone until compositionend.
    if (e.isComposing) return;
    fold(e.target);
  }, true);

  // Chrome sends the last `input` of a composition BEFORE compositionend, so
  // there is no later event to fold on. Make one, so React hears the result.
  doc.addEventListener('compositionend', (e) => {
    if (fold(e.target)) e.target.dispatchEvent(new win.Event('input', { bubbles: true }));
  }, true);
}
