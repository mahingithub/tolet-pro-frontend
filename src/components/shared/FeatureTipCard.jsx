/**
 * FeatureTipCard — the feature tour, for people we are not allowed to push.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS COMPONENT EXISTS
 * On Android 13+ notification permission is a runtime grant. If somebody taps
 * "Don't allow" there is no API, at any privilege level, that lets the app post
 * a notification anyway — and on that OS most people do tap it. A feature tour
 * that only knows how to push therefore loses the majority of the people it was
 * written for, silently, on day one.
 *
 * So the tour has a second surface: when the server has a tip due for this
 * install and no way to push it, the tip is handed over on app open and shown
 * here instead. It is the same four tips, the same schedule, the same
 * destinations — delivered where we are actually allowed to speak.
 *
 * ── SHOWN ONCE, AND ONLY WHEN THERE IS SOMETHING TO SAY ───────────────────
 * The fetch CONSUMES the tip: the server marks it delivered as it hands it
 * over, because a tip fetched and not shown is a tip lost. That makes this
 * component's contract strict — if it asks, it must render. So it asks late
 * (after mount, off the critical path), renders immediately on a hit, and on a
 * miss renders nothing at all. Most launches are a miss; that is correct.
 *
 * ── WHY IT IS A CARD AND NOT A MODAL ──────────────────────────────────────
 * The guest did not ask for this. A sheet that blocks the screen to advertise a
 * feature is the thing that makes people uninstall, and we are already speaking
 * to somebody who declined our notifications once. It sits at the bottom, it is
 * dismissible with one obvious tap, and it never returns.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';

import { fetchPendingTip } from '../../services/guestDeviceService';
import { useAuth } from '../../context/AuthContext.jsx';

// Long enough to be clear of the app's own arrival — the first seconds belong
// to whatever the person opened the app to do.
const APPEAR_DELAY_MS = 6000;

export default function FeatureTipCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tip, setTip] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // SIGNED-IN ACCOUNTS ARE NOT THIS COMPONENT'S JOB. They have the account
    // tour, which writes a real Notification row and reaches the bell. Asking
    // here as well would consume a guest tip for somebody who is going to be
    // told the same thing through a channel that persists.
    if (user) return undefined;

    let cancelled = false;
    const t = setTimeout(async () => {
      const found = await fetchPendingTip();
      if (!cancelled && found) setTip(found);
    }, APPEAR_DELAY_MS);

    return () => { cancelled = true; clearTimeout(t); };
  }, [user]);

  const close = useCallback(() => {
    // Animate out rather than vanishing. The tip is already spent server-side,
    // so there is nothing to preserve — this is purely so the dismissal reads
    // as the user's action and not as a glitch.
    setLeaving(true);
    setTimeout(() => setTip(null), 200);
  }, []);

  const open = useCallback(() => {
    if (tip?.path) navigate(tip.path);
    setTip(null);
  }, [navigate, tip]);

  if (!tip) return null;

  return createPortal(
    <div
      className={`fixed left-0 right-0 z-[380] px-3 transition-all duration-200 ${
        leaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
      // Clears the bottom rail rather than assuming its height — see the
      // --bottom-nav-h / --sab tokens the rest of the app positions against.
      style={{ bottom: 'calc(var(--bottom-nav-h, 64px) + var(--sab, 0px) + 12px)' }}
      role="status"
    >
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* The poster, when the tip has one. Fails to nothing: a broken image
            on a card nobody asked for should cost the reader no space. */}
        {tip.image && (
          <img
            src={tip.image}
            alt=""
            className="w-full h-28 object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[14px] font-black text-gray-900 dark:text-gray-50 leading-snug">
              {tip.title}
            </h3>
            <button
              type="button"
              onClick={close}
              className="p-1 -mt-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition shrink-0"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-[12.5px] font-semibold text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            {tip.body}
          </p>

          <button
            type="button"
            onClick={open}
            className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-black text-white bg-[#ba0036] active:scale-[0.98] transition flex items-center justify-center gap-1.5"
          >
            দেখুন
            <ArrowRight size={15} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
