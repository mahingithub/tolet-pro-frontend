/**
 * soloConfig — visual metadata for the SOLO wallet (the "I live alone" খাতা):
 * spending categories, income sources, the six entry types and the module
 * sub-navigation.
 *
 * Same shape as livingConfig.jsx on purpose (`tint`/`text` Tailwind classes the
 * dark retrofit already remaps, plus a raw `hex` for the hand-rolled SVG
 * charts), so both wallets can share every component in livingUI.jsx.
 */
import {
  UtensilsCrossed, ShoppingBasket, Home, Zap, Bus, Smartphone, HeartPulse,
  GraduationCap, ShoppingBag, Coffee, Heart, Layers, Tag,
  Briefcase, Store, Laptop, Gift, HandCoins,
  Wallet, ArrowUpRight, ArrowDownLeft, Users, PieChart, Undo2,
} from 'lucide-react';

// ── spending categories ─────────────────────────────────────────────────────
// Written for how money actually goes in a Bangladeshi month — খাওয়া and বাজার
// are separate (eating out vs. cooking at home), and "বাসায় পাঠানো" is a real
// line item, not "other".
export const SPEND_CATEGORIES = {
  food: { key: 'food', en: 'Food & Drink', bn: 'খাওয়া-দাওয়া', icon: UtensilsCrossed, tint: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316' },
  groceries: { key: 'groceries', en: 'Bazar', bn: 'বাজার', icon: ShoppingBasket, tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e' },
  rent: { key: 'rent', en: 'Rent', bn: 'বাসা ভাড়া', icon: Home, tint: 'bg-rose-50', text: 'text-red-600', hex: '#ba0036' },
  bills: { key: 'bills', en: 'Bills', bn: 'বিল', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', hex: '#f59e0b' },
  transport: { key: 'transport', en: 'Transport', bn: 'যাতায়াত', icon: Bus, tint: 'bg-blue-50', text: 'text-blue-600', hex: '#3b82f6' },
  mobile: { key: 'mobile', en: 'Mobile & Net', bn: 'মোবাইল/নেট', icon: Smartphone, tint: 'bg-violet-50', text: 'text-violet-600', hex: '#8b5cf6' },
  health: { key: 'health', en: 'Health', bn: 'চিকিৎসা', icon: HeartPulse, tint: 'bg-red-50', text: 'text-red-600', hex: '#ef4444' },
  education: { key: 'education', en: 'Education', bn: 'পড়াশোনা', icon: GraduationCap, tint: 'bg-indigo-50', text: 'text-indigo-600', hex: '#6366f1' },
  shopping: { key: 'shopping', en: 'Shopping', bn: 'কেনাকাটা', icon: ShoppingBag, tint: 'bg-pink-50', text: 'text-pink-600', hex: '#ec4899' },
  outing: { key: 'outing', en: 'Outing', bn: 'ঘোরাঘুরি', icon: Coffee, tint: 'bg-teal-50', text: 'text-teal-600', hex: '#14b8a6' },
  family: { key: 'family', en: 'Sent Home', bn: 'বাসায় পাঠানো', icon: Heart, tint: 'bg-fuchsia-50', text: 'text-fuchsia-600', hex: '#d946ef' },
  other: { key: 'other', en: 'Other', bn: 'অন্যান্য', icon: Layers, tint: 'bg-gray-100', text: 'text-gray-600', hex: '#64748b' },
};

export const SPEND_ORDER = [
  'food', 'groceries', 'rent', 'bills', 'transport', 'mobile',
  'health', 'education', 'shopping', 'outing', 'family', 'other',
];

// ── the user's own খাত ──────────────────────────────────────────────────────
// The twelve heads above cover most of a month, but not everyone's month: a
// টিউশনির খরচ or a বাইকের তেল is a real, repeating line for the person keeping
// the খাতা and "অন্যান্য" for everybody else. So a name typed once becomes a
// খাত of its own.
//
// It is stored as the entry's own category key — `c:বাইকের তেল` — and nothing
// else. No second collection, no schema change, no id to sync: the server
// already takes the category as free text (models/SoloLedger.js), every reader
// goes through the getters below, and two phones that both invent "বাইকের তেল"
// land on the same key and merge into one folder instead of two. The flip side
// is deliberate: a খাত exists exactly as long as something is written in it.
export const CUSTOM_PREFIX = 'c:';
// The server caps `category` at 30 characters — leave room for the prefix.
export const CUSTOM_NAME_MAX = 26;

export const isCustomCategory = (key) => typeof key === 'string' && key.startsWith(CUSTOM_PREFIX);

/** The display name inside a custom key. */
export const customCategoryName = (key) => (isCustomCategory(key) ? key.slice(CUSTOM_PREFIX.length) : '');

/** Normalise a typed name, so "  রিকশা   ভাড়া " and "রিকশা ভাড়া" are one খাত. */
export const cleanCategoryName = (name) =>
  String(name || '').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);

export const customCategoryKey = (name) => `${CUSTOM_PREFIX}${cleanCategoryName(name)}`;

// Colours are derived from the name rather than stored, so the same খাত looks
// the same on every device and after every reinstall — with nothing to sync.
const CUSTOM_SWATCHES = [
  { tint: 'bg-teal-50', text: 'text-teal-600', hex: '#14b8a6' },
  { tint: 'bg-blue-50', text: 'text-blue-600', hex: '#3b82f6' },
  { tint: 'bg-violet-50', text: 'text-violet-600', hex: '#8b5cf6' },
  { tint: 'bg-amber-50', text: 'text-amber-600', hex: '#f59e0b' },
  { tint: 'bg-pink-50', text: 'text-pink-600', hex: '#ec4899' },
  { tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e' },
  { tint: 'bg-indigo-50', text: 'text-indigo-600', hex: '#6366f1' },
  { tint: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316' },
];

const swatchFor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CUSTOM_SWATCHES[h % CUSTOM_SWATCHES.length];
};

/** Category metadata for a user-made খাত — same shape the tables above use. */
export const getCustomCategory = (key) => {
  const name = customCategoryName(key) || 'খাত';
  return { key, en: name, bn: name, icon: Tag, custom: true, ...swatchFor(name) };
};

export const getSpendCategory = (key) =>
  isCustomCategory(key) ? getCustomCategory(key) : SPEND_CATEGORIES[key] || SPEND_CATEGORIES.other;

// ── income sources ───────────────────────────────────────────────────────────
export const INCOME_CATEGORIES = {
  salary: { key: 'salary', en: 'Salary', bn: 'বেতন', icon: Briefcase, tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e' },
  family: { key: 'family', en: 'From Family', bn: 'বাসা থেকে', icon: Home, tint: 'bg-rose-50', text: 'text-red-600', hex: '#ba0036' },
  tuition: { key: 'tuition', en: 'Tuition', bn: 'টিউশনি', icon: GraduationCap, tint: 'bg-indigo-50', text: 'text-indigo-600', hex: '#6366f1' },
  business: { key: 'business', en: 'Business', bn: 'ব্যবসা', icon: Store, tint: 'bg-amber-50', text: 'text-amber-600', hex: '#f59e0b' },
  freelance: { key: 'freelance', en: 'Freelance', bn: 'ফ্রিল্যান্স', icon: Laptop, tint: 'bg-violet-50', text: 'text-violet-600', hex: '#8b5cf6' },
  gift: { key: 'gift', en: 'Gift', bn: 'উপহার', icon: Gift, tint: 'bg-pink-50', text: 'text-pink-600', hex: '#ec4899' },
  other: { key: 'other', en: 'Other', bn: 'অন্যান্য', icon: Layers, tint: 'bg-gray-100', text: 'text-gray-600', hex: '#64748b' },
};

export const INCOME_ORDER = ['salary', 'family', 'tuition', 'business', 'freelance', 'gift', 'other'];

export const getIncomeCategory = (key) =>
  isCustomCategory(key) ? getCustomCategory(key) : INCOME_CATEGORIES[key] || INCOME_CATEGORIES.other;

/** The right getter for a side of the খাতা (`flow` as used by SoloLedger). */
export const categoryOfFlow = (key, flow) => (flow === 'in' ? getIncomeCategory(key) : getSpendCategory(key));

/**
 * A default খাত whose name matches what was just typed, if there is one — so
 * typing "বাজার" picks the বাজার that already exists instead of quietly making
 * a second one beside it.
 */
export const matchDefaultCategory = (name, flow) => {
  const clean = cleanCategoryName(name).toLowerCase();
  if (!clean) return null;
  const table = flow === 'in' ? INCOME_CATEGORIES : SPEND_CATEGORIES;
  const hit = Object.values(table).find(
    (c) => c.bn.toLowerCase() === clean || c.en.toLowerCase() === clean
  );
  return hit ? hit.key : null;
};

/** Category metadata for ANY entry, picking the right table for its type. */
export const categoryFor = (entry) =>
  entry?.type === 'income' ? getIncomeCategory(entry.category) : getSpendCategory(entry?.category);

// ── entry types ──────────────────────────────────────────────────────────────
// `flow` is what the money did to my pocket; `person` is what it did to that
// friend's balance (+1 = they owe me more, −1 = I owe them more). Keeping both
// on one table is what stops a ধার from ever being counted as spending.
export const ENTRY_TYPES = {
  expense: {
    key: 'expense', flow: 'out', person: 0, needsPerson: false,
    en: 'Spent', bn: 'খরচ', icon: ArrowUpRight, tint: 'bg-rose-50', text: 'text-red-600', hex: '#ba0036',
  },
  income: {
    key: 'income', flow: 'in', person: 0, needsPerson: false,
    en: 'Received', bn: 'আয়', icon: ArrowDownLeft, tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e',
  },
  lend: {
    key: 'lend', flow: 'out', person: 1, needsPerson: true,
    en: 'Lent out', bn: 'ধার দিলাম', icon: HandCoins, tint: 'bg-blue-50', text: 'text-blue-600', hex: '#3b82f6',
  },
  borrow: {
    key: 'borrow', flow: 'in', person: -1, needsPerson: true,
    en: 'Borrowed', bn: 'ধার নিলাম', icon: HandCoins, tint: 'bg-amber-50', text: 'text-amber-600', hex: '#f59e0b',
  },
  'repay-in': {
    key: 'repay-in', flow: 'in', person: -1, needsPerson: true,
    en: 'Got back', bn: 'পাওনা পেলাম', icon: Undo2, tint: 'bg-teal-50', text: 'text-teal-600', hex: '#14b8a6',
  },
  'repay-out': {
    key: 'repay-out', flow: 'out', person: 1, needsPerson: true,
    en: 'Paid back', bn: 'ধার শোধ', icon: Undo2, tint: 'bg-violet-50', text: 'text-violet-600', hex: '#8b5cf6',
  },
};

export const getEntryType = (key) => ENTRY_TYPES[key] || ENTRY_TYPES.expense;

/**
 * The four ধার types, resolved from the only two things a person actually
 * knows: which way the টাকা moved, and where the balance already stands.
 *
 * Asking someone to choose between ধার দিলাম / ধার নিলাম / পাওনা পেলাম / ধার
 * শোধ is asking them to do the bookkeeping themselves — four near-identical
 * Bengali phrases, three of them containing the word ধার, and picking the wrong
 * one silently moves the balance the wrong way. But the answer was never a
 * choice: given a friend who already owes ৳৫০০, টাকা দিলাম can only be a fresh
 * ধার, and টাকা পেলাম can only be that পাওনা coming back. So the sheet asks the
 * one question a human can answer without thinking — টাকা গেল, না এলো? — and
 * derives the rest.
 *
 * @param {'out'|'in'} direction  'out' = I handed money over, 'in' = I received it
 * @param {number} net            that person's balance now (+ they owe me)
 */
export const typeForDirection = (direction, net = 0) =>
  direction === 'out'
    ? (net >= 0 ? 'lend' : 'repay-out')   // they owe me → lending more; I owe them → paying back
    : (net > 0 ? 'repay-in' : 'borrow');  // they owe me → getting it back; else → borrowing

// The type choices offered on each side of the খাতা, in the order they appear
// in the add sheet's segmented control.
export const OUT_TYPES = ['expense', 'lend', 'repay-out'];
export const IN_TYPES = ['income', 'borrow', 'repay-in'];

// ── module sub-navigation (solo) ─────────────────────────────────────────────
export const SOLO_MODULES = [
  { id: 'overview', en: 'Wallet', bn: 'হিসাব', icon: Wallet },
  { id: 'spending', en: 'Spending', bn: 'খরচ', icon: ArrowUpRight },
  { id: 'income', en: 'Income', bn: 'আয়', icon: ArrowDownLeft },
  { id: 'people', en: 'People', bn: 'দেনা-পাওনা', icon: Users },
  { id: 'report', en: 'Report', bn: 'রিপোর্ট', icon: PieChart },
];

// Colour swatches offered when creating a friend profile (same set the joint
// wallet uses for roommates, so avatars look like one family).
export const PERSON_SWATCHES = ['#ba0036', '#1B8553', '#2563eb', '#D99B28', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
