/**
 * serviceIcons.js — category id → Lucide icon, spelled out.
 * ──────────────────────────────────────────────────────────────────────────
 * The server sends an icon NAME ('Flame', 'ShoppingBasket') because
 * config/serviceCategories.js is shared by three clients and cannot ship React
 * components. Resolving that name needs a lookup, and there is exactly one
 * wrong way to write it:
 *
 *     import * as Icons from 'lucide-react';   // ← never do this
 *     const Icon = Icons[category.icon];
 *
 * That pulls the ENTIRE icon set into the bundle — it took the provider app
 * from 256 kB to 1,469 kB — because a dynamic index access defeats
 * tree-shaking: the bundler cannot know which keys are read, so it keeps all of
 * them. This app is on a congested mobile network by default; a megabyte of
 * unused SVG is tens of seconds of nothing.
 *
 * So every icon is named explicitly. Adding a category to the registry means
 * adding one line here — and if that is forgotten, FALLBACK renders rather than
 * a blank tile, which is a missing icon rather than a missing category.
 */

import {
  Flame, Droplets, ShoppingBasket, Users, Zap, Wrench, Wifi, Utensils,
  Sparkles, Hammer, Truck, Shirt, GraduationCap, ShieldCheck, Bug, Store,
} from 'lucide-react';

const ICONS = {
  Flame, Droplets, ShoppingBasket, Users, Zap, Wrench, Wifi, Utensils,
  Sparkles, Hammer, Truck, Shirt, GraduationCap, ShieldCheck, Bug,
};

/** A generic shopfront, so an unmapped name degrades to a tile and not a hole. */
export const FALLBACK = Store;

export const iconFor = (name) => ICONS[name] || FALLBACK;

/**
 * Per-category tint. Colour is decoration here, not meaning — the label
 * carries the meaning — so an unknown category gets a neutral chip rather than
 * an arbitrary colour that implies something.
 */
export const TINTS = {
  gas:             'bg-orange-50 text-orange-600 border-orange-100',
  water:           'bg-cyan-50 text-cyan-600 border-cyan-100',
  grocery:         'bg-emerald-50 text-emerald-600 border-emerald-100',
  domestic_helper: 'bg-pink-50 text-pink-600 border-pink-100',
  electricity:     'bg-amber-50 text-amber-600 border-amber-100',
  plumber:         'bg-sky-50 text-sky-600 border-sky-100',
  internet:        'bg-blue-50 text-blue-600 border-blue-100',
  eatery:          'bg-rose-50 text-rose-600 border-rose-100',
  cleaning:        'bg-teal-50 text-teal-600 border-teal-100',
  repairs:         'bg-gray-100 text-gray-600 border-gray-200',
  movers:          'bg-violet-50 text-violet-600 border-violet-100',
  laundry:         'bg-indigo-50 text-indigo-600 border-indigo-100',
  education:       'bg-purple-50 text-purple-600 border-purple-100',
  security:        'bg-red-50 text-red-600 border-red-100',
  pest:            'bg-lime-50 text-lime-600 border-lime-100',
};

export const tintFor = (id) => TINTS[id] || 'bg-gray-100 text-gray-600 border-gray-200';

export default iconFor;
