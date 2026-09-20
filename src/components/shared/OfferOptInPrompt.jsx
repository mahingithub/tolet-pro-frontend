/**
 * OfferOptInPrompt — the one time we ask to send offers on WhatsApp.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS.
 * `preferences.notifications.whatsappOptIn` defaults to FALSE (models/User.js
 * explains why: Meta rates a business number down for messaging people who
 * never agreed, and the OpenWA path sends from our OWN number, so the cost of
 * getting this wrong is the number itself). The only thing in the app that ever
 * set it true was a toggle buried in Settings → Notifications, which nothing
 * pointed at. The predictable result: an admin blast to 32 users reported
 * "0 sent, 32 skipped — never opted in", and the console was right.
 *
 * So this is a discovery problem, not a consent problem. The switch exists and
 * works; nobody knows it is there.
 *
 * WHEN IT ASKS — and why not at launch.
 * The caller passes `eligible`, and is expected to pass true only once the
 * account has done the thing the app is FOR: a landlord with a property, a
 * tenant with a tenancy. Asking on first launch means asking someone who has no
 * idea yet whether this app is worth hearing from, and a "no" is permanent — we
 * only ask once, ever. Waiting costs a few days and buys an answer that means
 * something.
 *
 * ASKED ONCE, EVER.
 * Both buttons record the ask. Declining is not a maybe-later: a promo consent
 * prompt that reappears is the thing that makes people uninstall, and the
 * toggle stays in Settings for anyone who changes their mind. The record is
 * keyed by user id and listed in authService's DEVICE_KEEP_PREFIXES, so it
 * survives a logout — otherwise signing out and back in would re-ask, which is
 * exactly the nag this avoids.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';

import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useLanguage } from '../../context/LanguageContext';

// Per-account so a shared phone does not answer for the next person. The
// prefix is registered in services/authService.js → DEVICE_KEEP_PREFIXES.
const askedKey = (userId) => `tolet_pro::offer_optin_asked::${userId}`;

const wasAsked = (userId) => {
  if (!userId) return true; // no id → no way to scope the record; do not ask
  try { return window.localStorage.getItem(askedKey(userId)) === '1'; } catch { return true; }
};
const markAsked = (userId) => {
  try { window.localStorage.setItem(askedKey(userId), '1'); } catch { /* ignore */ }
};

// Long enough that the sheet is not part of the screen's arrival — it should
// read as a considered question, not a popup that fired on page load.
const APPEAR_DELAY_MS = 4000;

export default function OfferOptInPrompt({ eligible = false }) {
  const auth = useAuth();
  const { settings, update } = useSettings();
  const lang = useLanguage();
  const bn = lang?.language === 'বাংলা' || lang?.language === 'bn';

  const user = auth?.user;
  const userId = user?.id || user?._id || '';
  const isLandlord = Array.isArray(auth?.roles) && auth.roles.includes('landlord');

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // `alreadyOptedIn` is read from settings rather than assumed: someone who
  // found the toggle on their own must never be asked as though they hadn't.
  const alreadyOptedIn = settings?.notifications?.whatsappOptIn === true;

  useEffect(() => {
    if (!eligible || !userId || alreadyOptedIn || wasAsked(userId)) return undefined;
    const t = setTimeout(() => setOpen(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible, userId, alreadyOptedIn]);

  const close = useCallback(() => {
    markAsked(userId);
    setOpen(false);
  }, [userId]);

  const accept = useCallback(async () => {
    setSaving(true);
    try {
      await update({ notifications: { whatsappOptIn: true } });
    } catch {
      // Swallowed deliberately. The consent is recorded as asked either way,
      // and a failed PATCH here is not worth an error toast on top of a prompt
      // the user did not go looking for — SettingsContext's cache keeps the
      // optimistic value and the next successful write reconciles it.
    } finally {
      setSaving(false);
      close();
    }
  }, [update, close]);

  if (!open) return null;

  const title = bn ? 'WhatsApp-এ অফার পাঠাব?' : 'Send offers on WhatsApp?';
  const blurb = isLandlord
    ? (bn
      ? 'নতুন ফিচার, ছাড় আর প্ল্যানের অফার সরাসরি আপনার WhatsApp-এ। ভাড়ার রিমাইন্ডার বা হিসাবের বার্তা এতে বদলাবে না — সেগুলো আগের মতোই আসবে।'
      : 'New features, discounts and plan offers straight to your WhatsApp. This does not change your rent reminders or ledger messages — those keep coming either way.')
    : (bn
      ? 'নতুন বাসার খবর, ছাড় আর অফার সরাসরি আপনার WhatsApp-এ। ভাড়ার রসিদ বা বাড়িওয়ালার বার্তা এতে বদলাবে না — সেগুলো আগের মতোই আসবে।'
      : 'New listings, discounts and offers straight to your WhatsApp. This does not change your rent receipts or messages from your landlord — those keep coming either way.');

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-[2rem] sm:rounded-[2rem] p-5 pb-[calc(1.25rem+var(--sab))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle size={20} strokeWidth={2.4} />
            </span>
            <h2 className="text-[18px] font-black text-gray-900 dark:text-gray-50 tracking-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1.5 -mt-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition shrink-0"
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[12.5px] font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-5 leading-relaxed">
          {blurb}
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          {/* "No" is a real, equally reachable button, not a dismissive link.
              A consent prompt that makes declining the hard path is the kind
              users answer by uninstalling. */}
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-[13px] font-black text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 active:scale-[0.98] transition disabled:opacity-50"
          >
            {bn ? 'না, ধন্যবাদ' : 'No thanks'}
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl text-[13px] font-black text-white bg-[#ba0036] active:scale-[0.98] transition disabled:opacity-60"
          >
            {saving ? (bn ? 'সেভ হচ্ছে…' : 'Saving…') : (bn ? 'হ্যাঁ, পাঠান' : 'Yes, send them')}
          </button>
        </div>

        <p className="text-[10.5px] font-bold text-gray-400 dark:text-gray-500 text-center mt-3.5 leading-relaxed">
          {bn
            ? 'যখন খুশি সেটিংস → নোটিফিকেশন থেকে বন্ধ করতে পারবেন।'
            : 'You can turn this off any time in Settings → Notifications.'}
        </p>
      </div>
    </div>,
    document.body,
  );
}
