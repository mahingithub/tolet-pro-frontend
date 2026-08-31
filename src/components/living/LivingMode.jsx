/**
 * LivingMode — the fork at the front door of Living.
 *
 * Some people run a mess with five roommates; some live alone and just want
 * their own খাতা. Those are two different apps wearing one tab, so instead of
 * guessing we ask once, remember the answer, and leave a switch in the header.
 *
 * Switching is always safe: the two wallets are separate slices in the store,
 * so going solo never touches the mess's bazar and going back never touches the
 * personal ledger. That promise is stated on screen, because a user who fears
 * losing data will never press the button.
 */
import React, { useState } from 'react';
import {
  ArrowLeftRight, Check, HandCoins, PieChart, ShieldCheck, User, Users,
  UtensilsCrossed, Wallet, WifiOff,
} from 'lucide-react';

import { PrimaryButton, Sheet, cx } from './livingUI';

export const MODE_META = {
  solo: {
    key: 'solo',
    en: 'Living alone',
    bn: 'একা থাকি',
    shortEn: 'Solo',
    shortBn: 'একা',
    icon: User,
    tagline: {
      bn: 'নিজের খরচ, নিজের আয় — সব নিজের খাতায়।',
      en: 'Your own spending, your own income, your own ledger.',
    },
    points: [
      { icon: Wallet, bn: 'কোন খাতে কত খরচ হলো, দিনে দিনে', en: 'Every taka, by category, day by day' },
      { icon: HandCoins, bn: 'কার কাছে কত পাবেন, কাকে কত দেবেন', en: 'Who owes you, and whom you owe' },
      { icon: PieChart, bn: 'মাস শেষে পরিষ্কার রিপোর্ট', en: 'A clean report at the end of the month' },
    ],
  },
  joint: {
    key: 'joint',
    en: 'Living with roommates',
    bn: 'মেসে / যৌথভাবে থাকি',
    shortEn: 'Shared',
    shortBn: 'যৌথ',
    icon: Users,
    tagline: {
      bn: 'মিল, বাজার, বিল আর খরচ — সবার সাথে ভাগ।',
      en: 'Meals, bazar, bills and expenses — shared with everyone.',
    },
    points: [
      { icon: UtensilsCrossed, bn: 'মিল ম্যানেজার, বাজার আর মিল রেট', en: 'Meal manager, bazar and meal rate' },
      { icon: Users, bn: 'রুমমেটদের সাথে খরচ ভাগাভাগি', en: 'Split expenses with roommates' },
      { icon: HandCoins, bn: 'কে কাকে কত দেবে, এক জায়গায়', en: 'Who pays whom, all in one place' },
    ],
  },
};

const ModeCard = ({ mode, isBn, active, onPick }) => {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  return (
    <button
      onClick={() => onPick(mode)}
      className={cx(
        'group w-full text-left rounded-[2rem] border bg-white p-5 transition active:scale-[0.99]',
        active
          ? 'border-[#ba0036] ring-2 ring-[#ba0036]/20 shadow-[0_18px_40px_-20px_rgba(186,0,54,0.55)]'
          : 'border-gray-100 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)] hover:border-[#ba0036]/40'
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cx(
            'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition',
            active ? 'bg-[#ba0036] text-white' : 'bg-[#ba0036]/10 text-[#ba0036]'
          )}
        >
          <Icon size={22} strokeWidth={2.3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-black text-gray-900 tracking-tight">{isBn ? meta.bn : meta.en}</p>
            {active && (
              <span className="inline-flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wider text-[#ba0036] bg-[#ba0036]/10 px-1.5 py-0.5 rounded-full">
                <Check size={10} /> {isBn ? 'এখন চালু' : 'On now'}
              </span>
            )}
          </div>
          <p className="text-[12px] font-semibold text-gray-500 mt-1 leading-relaxed">
            {isBn ? meta.tagline.bn : meta.tagline.en}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {meta.points.map((p) => {
          const PIcon = p.icon;
          return (
            <div key={p.en} className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center shrink-0 group-hover:text-[#ba0036] transition">
                <PIcon size={14} strokeWidth={2.2} />
              </span>
              <span className="text-[12px] font-bold text-gray-600">{isBn ? p.bn : p.en}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
};

/**
 * The first-run picker. Shown in place of the module content until the user
 * has answered, so nobody lands in a mess wallet they never asked for.
 */
export const ModeChooser = ({ isBn, onPick }) => (
  <div data-tour="living-mode-chooser" className="max-w-2xl mx-auto py-4">
    <div className="text-center px-2 mb-5">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#ba0036] bg-[#ba0036]/10 px-3 py-1.5 rounded-full">
        <ArrowLeftRight size={12} /> {isBn ? 'একবার বেছে নিন' : 'Choose once'}
      </span>
      <h2 className="text-[22px] md:text-[26px] font-black text-gray-900 tracking-tight leading-tight mt-3">
        {isBn ? 'হিসাবটা কীভাবে রাখবেন?' : 'How do you want to keep accounts?'}
      </h2>
      <p className="text-[13px] font-semibold text-gray-500 mt-1.5 leading-relaxed">
        {isBn
          ? 'একা থাকলে নিজের খাতা, মেসে থাকলে সবার সাথে ভাগের খাতা। পরে যখন খুশি বদলাতে পারবেন।'
          : 'Your own ledger if you live alone, a shared one if you live with roommates. You can switch whenever you like.'}
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <ModeCard mode="solo" isBn={isBn} onPick={onPick} />
      <ModeCard mode="joint" isBn={isBn} onPick={onPick} />
    </div>

    <div className="flex items-start gap-2.5 mt-4 rounded-2xl bg-white/70 border border-gray-100 p-3.5">
      <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
      <p className="text-[11.5px] font-semibold text-gray-500 leading-relaxed">
        {isBn
          ? 'দুটো হিসাব সম্পূর্ণ আলাদা থাকে। একটা থেকে অন্যটায় গেলে কোনো তথ্য মুছে যায় না — যেটা যেখানে লেখা, সেখানেই থাকে।'
          : 'The two ledgers stay completely separate. Switching between them never deletes anything — what you wrote stays where you wrote it.'}
      </p>
    </div>
  </div>
);

/**
 * The header switch. A pill that says which wallet is open, and a sheet to move
 * to the other one.
 */
export const ModeSwitcher = ({ mode, isBn, onSwitch }) => {
  const [open, setOpen] = useState(false);
  const meta = MODE_META[mode] || MODE_META.joint;
  const Icon = meta.icon;
  const other = mode === 'solo' ? 'joint' : 'solo';

  const pick = (next) => {
    setOpen(false);
    if (next !== mode) onSwitch(next);
  };

  return (
    <>
      <button
        data-tour="living-mode-switch"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 pl-2 pr-2.5 py-2 bg-white/70 rounded-xl border border-white/80 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-white active:scale-95 transition"
        aria-label={isBn ? 'হিসাবের ধরন বদলান' : 'Switch wallet mode'}
      >
        <Icon size={15} className="text-[#ba0036]" />
        <span className="text-[11px] font-black hidden sm:inline">{isBn ? meta.shortBn : meta.shortEn}</span>
        <ArrowLeftRight size={12} className="text-gray-400" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={isBn ? 'কোন হিসাব চালাবেন?' : 'Which ledger?'}
        subtitle={isBn ? 'যখন খুশি এদিক-ওদিক করতে পারবেন' : 'Move between them as often as you like'}
        maxWidth="max-w-lg"
        footer={
          <PrimaryButton className="w-full" onClick={() => pick(other)}>
            <ArrowLeftRight size={17} />
            {isBn ? `${MODE_META[other].bn}-তে যান` : `Switch to ${MODE_META[other].en.toLowerCase()}`}
          </PrimaryButton>
        }
      >
        <div className="space-y-3 py-1">
          <ModeCard mode="solo" isBn={isBn} active={mode === 'solo'} onPick={pick} />
          <ModeCard mode="joint" isBn={isBn} active={mode === 'joint'} onPick={pick} />

          <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
            <WifiOff size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] font-semibold text-emerald-700 leading-relaxed">
              {isBn
                ? 'নিজের খাতা ফোনেই জমা থাকে — নেট না থাকলেও লেখা যায়, আর কিছুই হারায় না।'
                : 'Your personal ledger is stored on the phone — it keeps working with no internet, and nothing is lost.'}
            </p>
          </div>
        </div>
      </Sheet>
    </>
  );
};

export default ModeSwitcher;
