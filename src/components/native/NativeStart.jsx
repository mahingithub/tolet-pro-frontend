import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useIsBn } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import useNativeExperience from '../../hooks/useNativeExperience';
import { NATIVE_WELCOME_PATH, getNativeHome, inferNativeExperience, saveNativeExperience } from '../../utils/nativeExperience';

export default function NativeStart() {
  const navigate = useNavigate();
  const isBn = useIsBn();
  const { isNative, experience, homePath, selectExperience } = useNativeExperience();
  const { isAuthenticated, activeRole } = useAuth();
  const { settings } = useSettings();
  const [stage, setStage] = useState('role');
  const [role, setRole] = useState(experience?.role || null);
  const [intent, setIntent] = useState(experience?.role === 'tenant' ? experience.mode : null);

  // A SIGNED-IN account already answers "who are you?" — asking it again is how
  // a returning user ends up stranded on this screen after a reinstall. Their
  // role picks the side and the home saved on the account picks the surface, so
  // there is nothing left to ask: set it and go.
  //
  // Only when nothing is stored yet. Someone who arrives from "change how I use
  // the app" HAS a saved choice and came here deliberately, so they still get
  // the questions.
  const settleFromAccount = isNative && isAuthenticated && !experience && activeRole
    ? inferNativeExperience({ activeRole, defaultHome: settings?.app?.defaultHome })
    : null;
  useEffect(() => {
    if (!settleFromAccount) return;
    saveNativeExperience(settleFromAccount.role, settleFromAccount.mode, 'account');
  }, [settleFromAccount?.role, settleFromAccount?.mode]);

  if (!isNative) return <Navigate to="/" replace />;
  if (settleFromAccount) {
    return <Navigate to={getNativeHome({ version: 1, ...settleFromAccount })} replace />;
  }

  const finish = (nextRole, mode) => {
    const preference = selectExperience(nextRole, mode);
    navigate(getNativeHome(preference), { replace: true });
  };
  const proceed = () => {
    if (stage === 'role') {
      if (role === 'landlord') finish(role, 'host');
      else if (role === 'tenant') setStage('intent');
    } else if (intent) finish('tenant', intent);
  };

  // Each answer SHOWS itself. A line icon beside a line of text is the look of
  // a settings row, and it left the person choosing to imagine what either side
  // of the app would be like. The onboarding artwork already draws exactly these
  // four situations, so the choice is made by looking rather than by reading:
  //   · a tenant with a phone, finding a home
  //   · a landlord checking rent that has come in
  //   · two housemates settling the Living খাতা
  //   · the same home search, for the tenant who came to look
  // Cut out of its matte (scripts/cutout-onboarding-art.mjs), so it sits on the
  // card with no white block around it.
  //
  // `body` is what fits under a card; `detail` is the full sentence, which moves
  // to the panel below once a card is chosen. Two columns cannot hold a line of
  // Bangla prose without turning into a paragraph of four words a row.
  const options = stage === 'role' ? [
    { id: 'tenant', art: 'find-home-v2', title: isBn ? 'আমি ভাড়াটিয়া' : 'I am a tenant', body: isBn ? 'বাসা খুঁজুন, খরচের হিসাব রাখুন।' : 'Find a home, track expenses.', detail: isBn ? 'বাসা খুঁজুন অথবা নিজের ও যৌথ খরচের হিসাব রাখুন।' : 'Find a home, or keep track of personal and shared expenses.' },
    { id: 'landlord', art: 'collect-rent-v3', title: isBn ? 'আমি বাড়িওয়ালা' : 'I am a landlord', body: isBn ? 'প্রপার্টি ও ভাড়ার হিসাব সামলান।' : 'Manage properties and rent.', detail: isBn ? 'প্রপার্টি, ভাড়াটিয়া ও ভাড়ার হিসাব এক জায়গায় সামলান।' : 'Manage your properties, tenants and rent in one place.' },
  ] : [
    { id: 'living', art: 'shared-ledger-v3', title: isBn ? 'হিসাব রাখব' : 'Keep accounts', body: isBn ? 'নিজের বা মেসের খরচের খাতা।' : 'Your own or shared ledger.', detail: isBn ? 'নিজের খাতা বা মেসের মিল, বাজার ও বিলের হিসাব — Living-এ।' : 'Your own ledger, or meals, groceries and bills with housemates — in Living.' },
    { id: 'search', art: 'find-home-v2', title: isBn ? 'বাসা খুঁজব' : 'Find a home', body: isBn ? 'এলাকা ও বাজেট অনুযায়ী খুঁজুন।' : 'Search by area and budget.', detail: isBn ? 'এলাকা ও বাজেট অনুযায়ী ভাড়ার বাসা খুঁজে দেখুন।' : 'Explore rental homes by location and budget.' },
  ];
  const selected = stage === 'role' ? role : intent;
  const selectedOption = options.find((o) => o.id === selected) || null;

  return (
    // One scheme, so no `dark:` pair to keep in step — the app resolves to light
    // everywhere (SettingsContext.resolveTheme). White page, hairline rules, and
    // colour spent only where it carries meaning: the wordmark and the answer
    // you picked. Nothing here moves on touch; a settings question should sit
    // still and be read.
    <main className="min-h-[100dvh] bg-white px-6 pt-safe pb-safe text-slate-900">
      {/* The page already reserves both insets, so the column is the screen
          minus them — a bare 100dvh pushed the button and hint under the
          Android navigation bar. */}
      <div className="mx-auto flex min-h-[calc(100dvh-var(--sat)-var(--sab))] max-w-md flex-col py-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] font-bold tracking-[0.2em] text-[#ba0036]">TO-LET PRO</span>
          {/* Always a way out. This screen is no longer the first thing a fresh
              install sees — /welcome is, and it links here for a landlord who
              wants to look around before signing in. Without the third case
              that visit was a dead end: no experience saved, so no back
              button, and nothing behind it in the history stack either. */}
          <button
            type="button"
            onClick={() => stage === 'intent' ? setStage('role')
              : navigate(experience ? homePath : NATIVE_WELCOME_PATH, { replace: true })}
            className="-mr-2 flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-slate-500"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />{isBn ? 'ফিরে যান' : 'Back'}
          </button>
        </div>

        <div className="mt-7">
          {/* Two coloured bars were the loudest thing on a screen that asks one
              quiet question. The step is a fact, so it is stated as one. */}
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {isBn ? `ধাপ ${stage === 'role' ? '১' : '২'} / ২` : `Step ${stage === 'role' ? 1 : 2} of 2`}
          </p>
          <h1 className="mt-3 text-[27px] font-bold leading-snug tracking-tight">
            {stage === 'role' ? (isBn ? 'আপনি কে?' : 'Which describes you?') : (isBn ? 'কী করতে চান?' : 'What brings you here?')}
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
            {isBn ? 'আপনার নির্বাচন অনুযায়ী অ্যাপ সাজানো হবে। পরে প্রোফাইল থেকে বদলাতে পারবেন।' : 'We will open the app around your choice. You can change it later from Profile.'}
          </p>
        </div>

        <div
          role="group"
          aria-label={stage === 'role' ? (isBn ? 'পরিচয়' : 'Your role') : (isBn ? 'ব্যবহারের উদ্দেশ্য' : 'Your purpose')}
          className="mt-7 grid grid-cols-2 gap-3"
        >
          {options.map(({ id, art, title, body }) => {
            const isOn = selected === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isOn}
                onClick={() => stage === 'role' ? setRole(id) : setIntent(id)}
                // ring-inset rather than a thicker border: the chosen card has to
                // read as heavier without becoming a pixel taller than the other,
                // which is what makes a pair of cards jump as you pick one.
                className={`relative flex flex-col rounded-2xl border p-3 text-left ${
                  isOn ? 'border-[#ba0036] bg-[#ba0036]/[0.04] ring-1 ring-inset ring-[#ba0036]' : 'border-slate-200 bg-white'
                }`}
              >
                {/* A tinted panel behind the cut-out, so the artwork reads as a
                    picture on the card rather than as loose shapes on the page.
                    4:3 against 3:2 art leaves a little air above and below it. */}
                <span className={`mb-3 block overflow-hidden rounded-xl ${isOn ? 'bg-white' : 'bg-slate-50'}`}>
                  <img
                    src={`/illustrations/onboarding/${art}.png`}
                    alt=""
                    aria-hidden="true"
                    width="960"
                    height="640"
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    className="block aspect-[4/3] w-full object-contain"
                  />
                </span>
                <span className="block text-[15px] font-bold leading-snug">{title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-slate-500">{body}</span>
                {isOn && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#ba0036] text-white"
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* The full sentence for the card you picked. It lives here and not on
            the card because two columns cannot hold Bangla prose, and it gives
            the screen something to say back when you choose — the fixed height
            keeps the button from walking up the screen as it fills in. */}
        <div className="mt-3 flex min-h-[68px] items-center rounded-xl bg-slate-50 px-4 py-3">
          <p className={`text-sm leading-relaxed ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`} aria-live="polite">
            {selectedOption
              ? selectedOption.detail
              : (isBn ? 'উপরের দুটির একটি বেছে নিন।' : 'Choose one of the two above.')}
          </p>
        </div>

        <div className="mt-auto pt-8">
          {/* A greyed-out button says "not yet" far better than a red one at 40%
              opacity, which just looks like the screen failed to paint. */}
          <button
            type="button"
            disabled={!selected}
            onClick={proceed}
            className={`flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-bold ${
              selected ? 'bg-[#ba0036] text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {isBn ? 'শুরু করুন' : 'Get started'}
            <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
            {isBn ? 'ঘুরে দেখতে লগইন লাগবে না। কিছু যোগ বা সেভ করতে লগইন করুন।' : 'Explore without signing in. Sign in when you want to add or save something.'}
          </p>
          {/* Someone who already has an account should never have to answer the
              questions above — after a reinstall this screen is all they see,
              and there is no way to know them until they say so. `known=1`
              tells the login screen not to ask which side they are on either:
              the account already knows, and the app configures itself from it. */}
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
            {isBn ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
            {/* Underlined, not just coloured: a link sitting inside a sentence
                has to be findable by shape as well as by colour. */}
            <button
              type="button"
              onClick={() => navigate('/login?known=1')}
              className="min-h-11 font-bold text-[#ba0036] underline decoration-[#ba0036]/40 underline-offset-4"
            >
              {isBn ? 'লগইন করুন' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
