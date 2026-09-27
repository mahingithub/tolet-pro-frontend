/**
 * serviceHints — reading the খাতা as "what this household actually buys".
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * The Living wallets and the service marketplace were built separately and
 * turned out to describe the same month. livingConfig's expense categories are
 * গ্যাস · পানি · বাজার · বুয়া · ওয়াইফাই; config/serviceCategories.js's live
 * categories are gas · water · grocery · domestic_helper · internet. That is
 * not a coincidence — both were written for a rented flat in Dhaka — and it
 * means a খাতা row is a purchase somebody already made, with a date and an
 * amount on it.
 *
 * So this module answers two questions, and nothing else:
 *
 *   serviceForCategory(key)   this খাত is which shop?
 *   reorderDue(rows, now)     what has probably run out by now?
 *
 * ─── IT IS PURE, AND IT STAYS ON THE PHONE ───────────────────────────────────
 * No fetch, no React, no store. The ledger is the user's own record of their
 * money and it never leaves the device for this: the inference happens here,
 * and the only thing a screen sends to the server afterwards is a category id
 * and a thana ("is anybody selling gas near me?"). Nobody's spending is
 * uploaded to be sold against. The wallets are offline-first anyway, so the
 * rows are already local — doing it here is both the honest option and the
 * cheap one.
 *
 * ─── DELIBERATELY NOT IN buildReminders() ────────────────────────────────────
 * livingUtils' buildReminders() has four consumers, two of which render a
 * count or a badge from it. Everything in that list is money the user OWES —
 * a due bill, a roommate settlement. "গ্যাস ফুরানোর সময় হলো" is a suggestion,
 * not a debt, and folding it in would inflate an urgency badge with shopping.
 * The clock is its own function with its own card.
 */

// ─── খাত → দোকান ─────────────────────────────────────────────────────────────
//
// Keys from BOTH wallets: livingConfig.CATEGORIES / BILL_TYPES (joint) and
// soloConfig.SPEND_CATEGORIES (solo). The two tables share `groceries` and
// mean the same thing by it, so one map serves both.
//
// ONLY `status: 'live'` categories are listed. A planned one (cleaning,
// movers, laundry…) resolves to the "coming soon" modal, and walking somebody
// out of their own খাতা into a dead end is worse than saying nothing.
//
// ─── TWO KEYS THAT LOOK LIKE MATCHES AND ARE NOT ─────────────────────────────
//   electricity  the বিদ্যুৎ BILL. The `electricity` service category is an
//                ইলেকট্রিশিয়ান — a tradesman, not the utility. Someone logging
//                their DESCO bill is not shopping for a technician.
//   bills        (solo) too coarse to resolve. It could be any of four.
const SERVICE_FOR_KEY = {
  gas: 'gas',
  water: 'water',
  groceries: 'grocery',
  maid: 'domestic_helper',
  internet: 'internet',
  wifi: 'internet',
  food: 'eatery',
};

// ─── খাত people typed themselves ─────────────────────────────────────────────
//
// The solo wallet has no গ্যাস or পানি খাত of its own (see soloConfig's twelve
// heads), so anybody tracking a cylinder there MUST have made a custom one —
// `c:গ্যাস`. Name matching is therefore not a nicety on that side, it is the
// only way the clock ever runs.
const ALIASES = [
  { id: 'gas', names: ['গ্যাস', 'সিলিন্ডার', 'gas', 'cylinder'] },
  { id: 'water', names: ['পানি', 'জার', 'water', 'jar'] },
  { id: 'grocery', names: ['বাজার', 'মুদি', 'grocery', 'bazar', 'bazaar'] },
  { id: 'domestic_helper', names: ['বুয়া', 'গৃহকর্মী', 'maid', 'helper'] },
  { id: 'internet', names: ['ইন্টারনেট', 'ওয়াইফাই', 'internet', 'wifi', 'broadband'] },
  { id: 'eatery', names: ['হোটেল', 'মিল', 'eatery', 'mess'] },
];

// A metered utility is not a thing you order from a shop. "গ্যাস বিল" is তিতাস
// and "পানির বিল" is ওয়াসা — both would otherwise match above and send
// somebody shopping for a cylinder they do not use.
const NOT_A_PURCHASE = ['বিল', 'তিতাস', 'ওয়াসা', 'লাইন', 'bill', 'titas', 'wasa'];

/**
 * Token-prefix matching, NOT substring.
 *
 * Substring matching is actively wrong in Bengali here: 'বাজার' CONTAINS
 * 'জার', so a grocery খাত would resolve to পানির জার. Splitting on whitespace
 * and requiring a token to START with the alias gets both halves right —
 * 'বাজার' no longer matches 'জার', while 'পানির' still matches 'পানি' and
 * 'গ্যাসের' still matches 'গ্যাস', which is the inflection people actually
 * type.
 */
const matchesName = (tokens, alias) => tokens.some((t) => t.startsWith(alias));

/** Custom keys are stored as `c:<name>` — see soloConfig.CUSTOM_PREFIX. */
const CUSTOM_PREFIX = 'c:';

/**
 * Which live service category this খাত is about, or null.
 *
 * @param {string} key  a livingConfig / soloConfig category key, or `c:<name>`
 * @returns {string|null} a service category id
 */
export function serviceForCategory(key) {
  if (!key || typeof key !== 'string') return null;

  if (!key.startsWith(CUSTOM_PREFIX)) return SERVICE_FOR_KEY[key] || null;

  const name = key.slice(CUSTOM_PREFIX.length).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!name) return null;

  const tokens = name.split(' ');
  if (NOT_A_PURCHASE.some((w) => matchesName(tokens, w))) return null;

  const hit = ALIASES.find((a) => a.names.some((n) => matchesName(tokens, n)));
  return hit ? hit.id : null;
}

// ─── The reorder clock ───────────────────────────────────────────────────────
//
// Only two categories get one, because only two run out on a schedule a ledger
// can see. A cylinder lasts about a month and a jar about a week; বাজার has no
// cycle worth guessing at, and a বুয়া is a monthly arrangement, not a purchase.
//
// `min`/`max` clamp the LEARNED interval below. One forgotten month in the
// খাতা would otherwise produce a 90-day gas cycle and the clock would go quiet
// for a quarter.
const CYCLES = {
  gas: { fallback: 30, min: 20, max: 60 },
  water: { fallback: 8, min: 4, max: 20 },
};

/** How many cycles late before we stop asking. */
const GIVE_UP_AFTER = 2;

/** Intervals older than this tell us nothing about today's household. */
const LEARN_FROM = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * How often THIS household buys it, from their own rows.
 *
 * The median gap, not the mean: one cylinder bought for a party, or a month
 * away from home, should not move the clock. Two purchases are enough to have
 * an opinion; below that we use the category default.
 */
function cycleFor(serviceId, sortedAt) {
  const { fallback, min, max } = CYCLES[serviceId];
  if (sortedAt.length < 3) return fallback;

  const gaps = [];
  for (let i = 1; i < sortedAt.length; i++) {
    const days = (sortedAt[i] - sortedAt[i - 1]) / DAY_MS;
    if (days >= 1) gaps.push(days);
  }
  if (gaps.length < 2) return fallback;

  const learned = median(gaps.slice(-LEARN_FROM));
  return Math.round(Math.min(max, Math.max(min, learned)));
}

/**
 * What has probably run out.
 *
 * @param {Array<{serviceId: string, at: number|string|Date}>} rows
 *        purchases, any order. Build them with the extractors below.
 * @param {number} [now]
 * @returns {Array<{serviceId, lastAt, cycleDays, dueAt, daysLate}>}
 *          due first, most overdue leading.
 */
export function reorderDue(rows = [], now = Date.now()) {
  const byService = new Map();

  rows.forEach((r) => {
    if (!r || !CYCLES[r.serviceId]) return;
    const at = new Date(r.at).getTime();
    if (!Number.isFinite(at) || at > now) return;   // a future-dated row is a typo
    const list = byService.get(r.serviceId) || [];
    list.push(at);
    byService.set(r.serviceId, list);
  });

  const out = [];
  byService.forEach((times, serviceId) => {
    times.sort((a, b) => a - b);
    const lastAt = times[times.length - 1];
    const cycleDays = cycleFor(serviceId, times);
    const dueAt = lastAt + cycleDays * DAY_MS;

    if (now < dueAt) return;

    // Long past due means the খাত was abandoned — they moved to a line
    // connection, or stopped writing it down. Either way, asking again every
    // day forever is how a helpful nudge turns into the reason someone stops
    // opening the খাতা.
    const daysLate = Math.floor((now - dueAt) / DAY_MS);
    if (daysLate > cycleDays * GIVE_UP_AFTER) return;

    out.push({ serviceId, lastAt, cycleDays, dueAt, daysLate });
  });

  return out.sort((a, b) => b.daysLate - a.daysLate);
}

// ─── Extractors, one per wallet ──────────────────────────────────────────────

/**
 * The JOINT wallet's purchases.
 *
 * গ্যাস and পানি are BILLS there, not expenses (livingConfig's
 * EXPENSE_CATEGORY_ORDER deliberately keeps utilities out of the split sheet),
 * and a bill row carries the one flag that tells the two apart: `recurring`.
 * A repeating গ্যাস bill is তিতাস — a metered line, nothing to order. A one-off
 * one is a cylinder somebody paid for on a day.
 *
 * `paidDate` before `dueDate` because the cylinder started being used the day
 * it was bought, not the day the row said it was owed.
 */
export function purchaseRowsFromBills(bills = []) {
  return bills
    .filter((b) => b && b.recurring !== true)
    .map((b) => ({ serviceId: serviceForCategory(b.type), at: b.paidDate || b.dueDate }))
    .filter((r) => r.serviceId && r.at);
}

/**
 * The SOLO wallet's purchases.
 *
 * `type === 'expense'` and nothing else. The solo খাতা carries six entry types
 * and four of them are ধার — money that moved without anything being bought.
 * Counting a ধার as a purchase is the one mistake this file must never make.
 */
export function purchaseRowsFromSoloEntries(entries = []) {
  return entries
    .filter((e) => e && e.type === 'expense')
    .map((e) => ({ serviceId: serviceForCategory(e.category), at: e.date }))
    .filter((r) => r.serviceId && r.at);
}

/** Every service id the clock can produce — for tests and for callers. */
export const CLOCKED_SERVICES = Object.keys(CYCLES);
