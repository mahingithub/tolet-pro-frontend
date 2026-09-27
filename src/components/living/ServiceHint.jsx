/**
 * ServiceHint — the খাতা's two ways of mentioning a shop.
 * ──────────────────────────────────────────────────────────────────────────
 *   showServiceHint()   a toast, right after a row is saved. "You just wrote
 *                       down গ্যাস ৳১৪০০ — three shops near you sell it."
 *   <ReorderHints />    a card for what the clock says has run out.
 *
 * ─── THE RULE BOTH OBEY ──────────────────────────────────────────────────────
 * Nothing renders unless we KNOW somebody is nearby — see
 * useNearbyServiceCounts().hasNearby, which is false for "no location yet",
 * "request failed" and "nobody there" alike. ServicesPage can afford to show a
 * tile with no count because the user walked into it on purpose. Neither of
 * these was asked for, so an unconfirmed suggestion is not shown at all.
 *
 * ─── THE COPY IS NOT THE REGISTRY'S ──────────────────────────────────────────
 * config/serviceCategories.js is fetched, never bundled, and this file does not
 * break that: what is written below is HINT copy — one sentence about why a
 * খাতা row is worth a tap — not the category's label or blurb. The registry
 * stays the single source for what a category IS; these are sentences this
 * screen says about it.
 */

import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  Flame, Droplets, ShoppingBasket, Users, Wifi, Utensils, ChevronRight, X, Store,
} from 'lucide-react';

import { serviceForCategory, reorderDue } from '../../utils/serviceHints';
import useNearbyServiceCounts, { fetchNearbyCounts } from '../../hooks/useNearbyServiceCounts';
import useServiceLocation from '../../hooks/useServiceLocation';
import { num } from './livingUtils';
import { Card, IconBadge, SectionHeader, cx } from './livingUI';

// Spelled out rather than indexed off lucide — a dynamic index access defeats
// tree-shaking and pulls the entire icon set in. serviceIcons.js documents what
// that cost the provider app (256 kB → 1,469 kB).
const ICON = {
  gas: Flame,
  water: Droplets,
  grocery: ShoppingBasket,
  domestic_helper: Users,
  internet: Wifi,
  eatery: Utensils,
};

const TINT = {
  gas: { tint: 'bg-orange-50', text: 'text-orange-600' },
  water: { tint: 'bg-blue-50', text: 'text-blue-600' },
  grocery: { tint: 'bg-emerald-50', text: 'text-emerald-600' },
  domestic_helper: { tint: 'bg-pink-50', text: 'text-pink-600' },
  internet: { tint: 'bg-indigo-50', text: 'text-indigo-600' },
  eatery: { tint: 'bg-rose-50', text: 'text-rose-600' },
};

// What this screen says about each shop. One line, and it answers "why would I
// tap this" rather than restating the খাত the user just picked.
const COPY = {
  gas: {
    bn: { title: 'গ্যাস সিলিন্ডার কাছেই আছে', line: 'বাসায় পৌঁছে দেবে, দাম আগেই দেখে নিন' },
    en: { title: 'Gas cylinders near you', line: 'Delivered to the door, price shown before you call' },
  },
  water: {
    bn: { title: 'পানির জার কাছেই আছে', line: 'ফ্ল্যাট পর্যন্ত দিয়ে যাবে' },
    en: { title: 'Water jars near you', line: 'Carried up to your flat' },
  },
  grocery: {
    bn: { title: 'এলাকার মুদি দোকান', line: 'বাজারটা ফোনেই দিয়ে দিন' },
    en: { title: 'Grocery shops in your area', line: 'Order the bazar from your phone' },
  },
  domestic_helper: {
    bn: { title: 'কাছের গৃহকর্মী', line: 'রেট দেখে তবেই কথা বলুন' },
    en: { title: 'Helpers nearby', line: 'See the monthly rate before you call' },
  },
  internet: {
    bn: { title: 'এলাকার ইন্টারনেট লাইন', line: 'প্যাকেজ আর দাম মিলিয়ে দেখুন' },
    en: { title: 'Internet in your area', line: 'Compare packages and prices' },
  },
  eatery: {
    bn: { title: 'কাছের খাবার হোটেল', line: 'মাসিক মিল প্যাকেজও আছে' },
    en: { title: 'Eateries nearby', line: 'Monthly meal plans too' },
  },
};

// The clock's own headline — a question about a thing running out, which is a
// different sentence from "here is a shop".
const DUE_COPY = {
  gas: {
    bn: 'গ্যাস ফুরানোর সময় হলো',
    en: 'Gas is about due',
  },
  water: {
    bn: 'পানির জার শেষ?',
    en: 'Jar running empty?',
  },
};

const nearbyLine = (count, isBn) => (isBn
  ? `${num(count, 'বাংলা')} জন কাছে আছে`
  : `${count} nearby`);

// ─── after a row is saved ────────────────────────────────────────────────────

/**
 * Fire the post-save toast.
 *
 * Deliberately a plain function and not a component: the two entry sheets that
 * call it unmount the moment they save, so there is nothing left to render
 * into. It also means the call site is one line inside an existing handler.
 *
 * @param {string} serviceId  a live category id, already resolved
 * @param {number} count      how many shops — > 0, checked by the caller
 */
function showToast(serviceId, count, navigate, isBn) {
  const copy = COPY[serviceId];
  if (!copy) return;

  const text = isBn ? copy.bn : copy.en;
  const Icon = ICON[serviceId] || Store;
  const tint = TINT[serviceId] || { tint: 'bg-gray-100', text: 'text-gray-600' };

  toast.custom((id) => (
    <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-100 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)] p-3.5 flex items-center gap-3">
      <span className={cx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tint.tint, tint.text)}>
        <Icon size={19} strokeWidth={2.3} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-black text-gray-900 leading-tight truncate">{text.title}</p>
        <p className="text-[11px] font-semibold text-gray-500 leading-tight mt-0.5 truncate">
          {count > 0 ? `${nearbyLine(count, isBn)} · ${text.line}` : text.line}
        </p>
      </div>
      <button
        type="button"
        onClick={() => { toast.dismiss(id); navigate(`/services/c/${serviceId}`); }}
        className="shrink-0 inline-flex items-center gap-0.5 pl-3 pr-2 py-2 rounded-xl bg-[#ba0036] text-white text-[11.5px] font-black active:scale-95 transition"
      >
        {isBn ? 'দেখুন' : 'See'}
        <ChevronRight size={13} />
      </button>
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label={isBn ? 'বন্ধ করুন' : 'Dismiss'}
        className="shrink-0 w-7 h-7 -mr-1 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-600 transition"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  ), { duration: 7000 });
}

/**
 * `hint(categoryKey)`, ready to drop into an onSave handler.
 *
 * ─── IT COSTS NOTHING UNTIL IT IS USED ───────────────────────────────────────
 * The counts are fetched at SAVE time, not on mount. Opening the খরচ tab and
 * writing nothing down — or writing down a rickshaw fare, which maps to no
 * shop — sends no request at all. Once asked, the answer is cached for the
 * session, so a month of বাজার rows still costs one.
 *
 * Every failure mode is silence: an unknown খাত, no location, a failed
 * request, nobody nearby. It is never awaited and never throws, so the save
 * it rides on can neither be delayed nor broken by a suggestion.
 */
export function useServiceHint(navigate, isBn) {
  const { query } = useServiceLocation();

  return (categoryKey) => {
    const serviceId = serviceForCategory(categoryKey);
    if (!serviceId || !COPY[serviceId]) return;

    fetchNearbyCounts(query)
      .then((counts) => {
        const count = counts?.[serviceId] || 0;
        if (count > 0) showToast(serviceId, count, navigate, isBn);
      })
      .catch(() => { /* a suggestion that cannot be verified is not made */ });
  };
}

// ─── the clock ───────────────────────────────────────────────────────────────

/**
 * "আবার লাগবে" — what the ledger says has run out.
 *
 * Renders nothing at all when the clock is quiet or nobody is nearby, so it is
 * safe to drop unconditionally into a layout: no empty card, no placeholder.
 *
 * @param {object} p
 * @param {Array<{serviceId, at}>} p.rows  from serviceHints' extractors —
 *        MEMOISE it at the call site; the clock re-derives on array identity.
 * @param {boolean} [p.heading] render the "আবার লাগবে" section header. It lives
 *        inside the nothing-to-show guard so a quiet clock leaves no orphan
 *        title behind.
 */
export const ReorderHints = ({ rows = [], language, navigate, heading = false, className = '' }) => {
  const isBn = language === 'বাংলা';

  // The clock is decided FIRST, and it is free — pure arithmetic over rows
  // already in memory. Only then is the network asked anything. Most months
  // nothing is due, and those months cost no request at all.
  const due = useMemo(() => reorderDue(rows), [rows]);
  const { counts, hasNearby } = useNearbyServiceCounts(due.length > 0);

  const visible = due.filter((d) => hasNearby(d.serviceId) && DUE_COPY[d.serviceId]);

  if (!visible.length) return null;

  return (
    <div className={cx('space-y-2.5', className)}>
      {heading ? (
        <SectionHeader
          title={isBn ? 'আবার লাগবে' : 'Running low'}
          subtitle={isBn ? 'আপনার খাতা যা বলছে' : 'Going by your own ledger'}
        />
      ) : null}
      {visible.map((d) => {
        const Icon = ICON[d.serviceId] || Store;
        const tint = TINT[d.serviceId] || { tint: 'bg-gray-100', text: 'text-gray-600' };
        // Derived from the memo rather than a fresh Date.now(): the clock's
        // due date already IS lastAt + cycle, so reading the wall clock again
        // here would be an impure call during render that could only disagree
        // with the row it is describing.
        const sinceDays = d.cycleDays + d.daysLate;
        const count = counts?.[d.serviceId] || 0;

        return (
          <Card
            key={d.serviceId}
            as="button"
            onClick={() => navigate(`/services/c/${d.serviceId}`)}
            className="w-full p-4 text-left flex items-center gap-3.5 active:scale-[0.99] transition"
          >
            <IconBadge icon={Icon} tint={tint.tint} text={tint.text} size={44} iconSize={20} />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-black text-gray-900 leading-tight">
                {isBn ? DUE_COPY[d.serviceId].bn : DUE_COPY[d.serviceId].en}
              </p>
              <p className="text-[11.5px] font-semibold text-gray-500 mt-0.5 truncate">
                {/* The reason we think so, said plainly. A nudge that shows its
                    working is one the user can disagree with — which is the
                    difference between a reminder and an advertisement. */}
                {isBn
                  ? `শেষ কিনেছেন ${num(sinceDays, 'বাংলা')} দিন আগে · ${nearbyLine(count, true)}`
                  : `Last bought ${sinceDays} days ago · ${nearbyLine(count, false)}`}
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 shrink-0" />
          </Card>
        );
      })}
    </div>
  );
};

export default ReorderHints;
