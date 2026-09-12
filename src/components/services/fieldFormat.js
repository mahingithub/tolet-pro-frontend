/**
 * fieldFormat.js — turning a provider's raw answers into readable lines.
 * ──────────────────────────────────────────────────────────────────────────
 * A provider's `fields` is whatever his category asked for, stored by key:
 *
 *   { sizes: { kg_12: 1450, kg_35: 3900 }, brands: ['omera'], delivery: 'within_1h' }
 *
 * None of that is showable. The labels — '১২ কেজি', 'ওমেরা', '১ ঘণ্টার মধ্যে' —
 * live in the category definition on the server, which is why the definition is
 * FETCHED alongside the provider rather than guessed at here. One formatter
 * serves the list card and the detail page, so a price can never read one way
 * in the list and another way after the tap.
 *
 * ─── A MISSING ANSWER IS NOT A ZERO ─────────────────────────────────────────
 * A shopkeeper prices what he stocks and leaves the rest blank, so an absent row
 * means "he does not sell it" — never "free", and never "৳0". Every function
 * here drops absent values rather than defaulting them.
 */

/** Pick the label in the reader's language, tolerating a plain string. */
const label = (v, bn) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return (bn ? v.bn : v.en) || v.bn || v.en || '';
};

const money = (n, bn) => {
  const s = Number(n || 0).toLocaleString('en-IN');
  return `৳${bn ? s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[d]) : s}`;
};

/**
 * The priced rows a provider actually filled in, as `{ key, label, unit, price }`.
 *
 * Returns `[]` — not null — when the server withheld prices because they went
 * stale past twice the category's window. The caller shows `pricesHidden`
 * copy in that case; the provider is still listed and still callable, because
 * "I don't know his price" is a reason to ring him, not a reason to hide him.
 */
export function priceRows(categoryDef, fields, bn) {
  if (!categoryDef || !fields) return [];
  const out = [];

  for (const field of categoryDef.providerFields || []) {
    if (field.type !== 'price_rows') continue;
    const answers = fields[field.key];
    if (!answers || typeof answers !== 'object') continue;

    for (const row of field.rows || []) {
      const price = answers[row.key];
      // `Number.isFinite` rather than a truthiness check: a shopkeeper who has
      // not entered a price and one who entered nothing are the same, but a
      // legitimately cheap row must not be dropped for being falsy.
      if (!Number.isFinite(price)) continue;
      out.push({
        field: field.key,
        key: row.key,
        label: bn ? row.bn : (row.en || row.bn),
        unit: label(row.unit, bn),
        price,
        priceText: money(price, bn),
      });
    }
  }
  return out;
}

/**
 * Everything that is NOT a price, as `{ label, value }` — delivery time,
 * brands carried, whether he takes empty cylinders back.
 *
 * These are what a tenant actually chooses between once two shops cost the
 * same, so they are not an afterthought on the card.
 */
export function detailRows(categoryDef, fields, bn) {
  if (!categoryDef || !fields) return [];
  const out = [];

  for (const field of categoryDef.providerFields || []) {
    if (field.type === 'price_rows') continue;
    const value = fields[field.key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && !value.length) continue;
    // A `false` bool is a real answer ("does not take empties back") but a
    // quietly useful one to show, so it stays.

    let text;
    if (field.type === 'money') {
      text = money(value, bn);
    } else if (field.type === 'bool') {
      text = value ? (bn ? 'হ্যাঁ' : 'Yes') : (bn ? 'না' : 'No');
    } else if (field.type === 'choice') {
      const opt = (field.options || []).find((o) => o.id === value);
      text = opt ? label(opt, bn) : String(value);
    } else if (field.type === 'multi') {
      const ids = Array.isArray(value) ? value : [value];
      text = ids
        .map((id) => {
          const opt = (field.options || []).find((o) => o.id === id);
          return opt ? label(opt, bn) : id;
        })
        .join(', ');
    } else {
      text = String(value);
    }

    if (text) out.push({ key: field.key, label: label(field.label, bn), value: text });
  }
  return out;
}

/**
 * The one line a list card shows: the cheapest priced row, or the first
 * non-price answer if the category has no prices at all (গৃহকর্মী is a name and
 * a phone number, by design).
 *
 * The CHEAPEST rather than the first, because on a list of shops selling the
 * same cylinder the number a tenant is scanning for is the low one.
 */
export function summaryLine(categoryDef, fields, bn) {
  const prices = priceRows(categoryDef, fields, bn);
  if (prices.length) {
    const cheapest = prices.reduce((a, b) => (b.price < a.price ? b : a));
    const unit = cheapest.unit ? `/${cheapest.unit}` : '';
    return `${cheapest.label} — ${cheapest.priceText}${unit}`;
  }
  const details = detailRows(categoryDef, fields, bn);
  return details.length ? `${details[0].label}: ${details[0].value}` : '';
}

export { money as formatTaka };
