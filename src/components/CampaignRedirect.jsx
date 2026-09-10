/*
 * CampaignRedirect.jsx — the /r/<code> landing screen.
 * ──────────────────────────────────────────────────────────────────────────
 * Where a promotional SMS or WhatsApp link lands. It resolves the code, counts
 * the click, and navigates on. The user should see this for a fraction of a
 * second; it renders a branded panel rather than nothing so a slow network
 * reads as "loading" instead of "the link is broken".
 *
 * SIGNED-OUT RECIPIENTS ARE THE NORMAL CASE, not an error to handle. Most of
 * these links are opened from a phone's SMS app by someone who has not signed
 * in on that browser — often the entire point of the campaign. So this page
 * never asks for a login itself. It navigates to the destination and lets the
 * destination decide:
 *
 *   • a public page (/, /to-let, /property/…) just opens;
 *   • a private one is wrapped in <RequireAuth>, which redirects to
 *     /login?next=<destination>. LoginPage honours `next` after BOTH login and
 *     signup, so someone who has to create an account still lands on the page
 *     the campaign advertised rather than on a generic home screen.
 *
 * `replace` on every navigation is deliberate: /r/<code> must not sit in the
 * history stack, or Back from the destination re-resolves the link, counts a
 * second click, and bounces the user forward again.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveCampaignLink } from '../services/campaignLinkService';

// Codes being resolved in this page load, keyed to the IN-FLIGHT PROMISE.
//
// The resolve call is also what COUNTS THE CLICK, so it must happen once per
// person rather than once per mount — and this component is mounted more than
// once for a single visit: React.StrictMode (main.jsx) deliberately mounts,
// unmounts and remounts every component in development, and a remount also
// happens in production when the user navigates Back.
//
// Caching the RESULT is not enough, and this is worth spelling out because it
// looks like it should be: both mounts run their effect before either fetch
// comes back, so both miss a result cache and both fire. Storing the promise
// makes the second mount await the first request instead of starting another.
//
// Module scope rather than a ref, because surviving StrictMode's remount is
// exactly the job, and a ref belongs to a component instance.
const inFlight = new Map();

export default function CampaignRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let pending = inFlight.get(code);
        if (!pending) {
          pending = resolveCampaignLink(code);
          inFlight.set(code, pending);
        }
        const { path } = await pending;
        if (cancelled) return;
        navigate(path || '/', { replace: true });
      } catch (err) {
        // Drop the failed attempt so a later mount can retry rather than
        // re-awaiting a promise that is already rejected.
        inFlight.delete(code);
        if (cancelled) return;
        // A 404 is a dead or mistyped code — tell the person, briefly, then
        // send them to the homepage rather than leaving them on a blank screen.
        // Anything else (offline, server down) also ends at the homepage: the
        // app works there, and stranding someone on an error page because a
        // marketing link failed is a worse outcome than a wrong landing.
        if (err.status === 404) {
          setDead(true);
          setTimeout(() => navigate('/', { replace: true }), 2200);
        } else {
          navigate('/', { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code, navigate]);

  return (
    <div
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-slate-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#ba0036] to-[#ff4d7d] shadow-[0_12px_24px_-6px_rgba(186,0,54,0.45)]">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-lg object-contain" />
      </div>

      {dead ? (
        <>
          <p className="text-sm font-black text-slate-900 dark:text-white">লিংকটি আর কাজ করছে না</p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            হোম পেজে নিয়ে যাচ্ছি…
          </p>
        </>
      ) : (
        <>
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-rose-700 dark:border-slate-700 dark:border-t-rose-500" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">খুলছে…</p>
        </>
      )}
    </div>
  );
}
