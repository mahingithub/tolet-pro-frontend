/**
 * livingConfig — visual metadata for the Living tab: expense categories, bill
 * types, payment methods, activity kinds and the module sub-navigation.
 *
 * Colours are expressed as (a) Tailwind tint classes (`tint`/`text`) that the
 * app's global dark retrofit in index.css automatically remaps for dark mode,
 * and (b) a raw `hex` used for hand-rolled SVG charts (chosen mid-tone so it
 * reads on both light and dark surfaces). Icons are lucide-react components.
 */
import {
  Zap, Flame, Droplets, Wifi, ShoppingBasket, Brush, Sparkles, Globe, Layers,
  Banknote, Smartphone, Landmark, Receipt, UtensilsCrossed, HandCoins, BellRing,
  Wallet, ArrowLeftRight, PieChart, Activity,
} from 'lucide-react';

// ── expense categories ──────────────────────────────────────────────────────
export const CATEGORIES = {
  electricity: { key: 'electricity', en: 'Electricity', bn: 'বিদ্যুৎ', icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600', hex: '#f59e0b' },
  gas: { key: 'gas', en: 'Gas', bn: 'গ্যাস', icon: Flame, tint: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316' },
  water: { key: 'water', en: 'Water', bn: 'পানি', icon: Droplets, tint: 'bg-blue-50', text: 'text-blue-600', hex: '#3b82f6' },
  wifi: { key: 'wifi', en: 'WiFi', bn: 'ওয়াইফাই', icon: Wifi, tint: 'bg-violet-50', text: 'text-violet-600', hex: '#8b5cf6' },
  groceries: { key: 'groceries', en: 'Groceries', bn: 'বাজার', icon: ShoppingBasket, tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e' },
  maid: { key: 'maid', en: 'Maid', bn: 'বুয়া', icon: Brush, tint: 'bg-pink-50', text: 'text-pink-600', hex: '#ec4899' },
  cleaning: { key: 'cleaning', en: 'Cleaning', bn: 'পরিষ্কার', icon: Sparkles, tint: 'bg-teal-50', text: 'text-teal-600', hex: '#14b8a6' },
  internet: { key: 'internet', en: 'Internet', bn: 'ইন্টারনেট', icon: Globe, tint: 'bg-indigo-50', text: 'text-indigo-600', hex: '#6366f1' },
  other: { key: 'other', en: 'Other', bn: 'অন্যান্য', icon: Layers, tint: 'bg-gray-100', text: 'text-gray-600', hex: '#64748b' },
};

export const CATEGORY_ORDER = ['electricity', 'gas', 'water', 'wifi', 'groceries', 'maid', 'cleaning', 'internet', 'other'];

export const getCategory = (key) => CATEGORIES[key] || CATEGORIES.other;

// ── bills ─────────────────────────────────────────────────────────────────────
export const BILL_TYPES = {
  electricity: CATEGORIES.electricity,
  gas: CATEGORIES.gas,
  water: CATEGORIES.water,
  internet: CATEGORIES.internet,
};
export const BILL_ORDER = ['electricity', 'gas', 'water', 'internet'];
export const getBillType = (key) => BILL_TYPES[key] || CATEGORIES.other;

// ── bill status → colour tokens ────────────────────────────────────────────────
export const BILL_STATUS = {
  paid: { en: 'Paid', bn: 'পরিশোধিত', tint: 'bg-emerald-50', text: 'text-emerald-600', dot: '#22c55e' },
  'due-soon': { en: 'Due Soon', bn: 'শীঘ্রই দিতে হবে', tint: 'bg-amber-50', text: 'text-amber-600', dot: '#f59e0b' },
  overdue: { en: 'Overdue', bn: 'সময় পেরিয়েছে', tint: 'bg-rose-50', text: 'text-red-600', dot: '#f43f5e' },
  unpaid: { en: 'Unpaid', bn: 'বাকি', tint: 'bg-gray-100', text: 'text-gray-600', dot: '#94a3b8' },
};

// ── payment methods ─────────────────────────────────────────────────────────────
export const PAYMENT_METHODS = {
  cash: { key: 'cash', en: 'Cash', bn: 'ক্যাশ', icon: Banknote, tint: 'bg-emerald-50', text: 'text-emerald-600', hex: '#22c55e' },
  bkash: { key: 'bkash', en: 'bKash', bn: 'বিকাশ', icon: Smartphone, tint: 'bg-pink-50', text: 'text-pink-600', hex: '#ec4899' },
  nagad: { key: 'nagad', en: 'Nagad', bn: 'নগদ', icon: Smartphone, tint: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316' },
  bank: { key: 'bank', en: 'Bank Transfer', bn: 'ব্যাংক ট্রান্সফার', icon: Landmark, tint: 'bg-blue-50', text: 'text-blue-600', hex: '#3b82f6' },
};
export const METHOD_ORDER = ['cash', 'bkash', 'nagad', 'bank'];
export const getMethod = (key) => PAYMENT_METHODS[key] || PAYMENT_METHODS.cash;

// ── split modes ───────────────────────────────────────────────────────────────
export const SPLIT_TYPES = {
  equal: { key: 'equal', en: 'Equal', bn: 'সমান' },
  percentage: { key: 'percentage', en: 'Percentage', bn: 'শতাংশ' },
  custom: { key: 'custom', en: 'Custom', bn: 'কাস্টম' },
};

// ── activity kinds ───────────────────────────────────────────────────────────────
export const ACTIVITY_META = {
  expense: { icon: Receipt, tint: 'bg-blue-50', text: 'text-blue-600' },
  bill: { icon: Zap, tint: 'bg-amber-50', text: 'text-amber-600' },
  meal: { icon: UtensilsCrossed, tint: 'bg-emerald-50', text: 'text-emerald-600' },
  settlement: { icon: HandCoins, tint: 'bg-violet-50', text: 'text-violet-600' },
  reminder: { icon: BellRing, tint: 'bg-rose-50', text: 'text-red-600' },
};
export const getActivityMeta = (type) => ACTIVITY_META[type] || ACTIVITY_META.expense;

// ── module sub-navigation ─────────────────────────────────────────────────────────
export const MODULES = [
  { id: 'overview', en: 'Overview', bn: 'ওভারভিউ', icon: Wallet },
  { id: 'expenses', en: 'Expenses', bn: 'খরচ ভাগ', icon: Receipt },
  { id: 'meals', en: 'Meals', bn: 'মিল', icon: UtensilsCrossed },
  { id: 'bills', en: 'Bills', bn: 'বিল', icon: Zap },
  { id: 'balances', en: 'Balances', bn: 'ব্যালেন্স', icon: ArrowLeftRight },
  { id: 'report', en: 'Report', bn: 'রিপোর্ট', icon: PieChart },
  { id: 'activity', en: 'Activity', bn: 'একটিভিটি', icon: Activity },
  { id: 'reminders', en: 'Reminders', bn: 'রিমাইন্ডার', icon: BellRing },
];
