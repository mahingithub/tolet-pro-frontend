/**
 * subscriptionService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Handles host subscription states, plans, and bKash / Nagad Send Money
 * payments (submitted by TrxID, accepted by our wallet's SMS or an admin).
 */

import { broadcast, subscribe as subscribeKey } from './_storage.js';

const KEY_SUBSCRIPTION = 'subscription:update';
const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');


let cachedStatus = { tier: 'free', isLoading: true, isPaid: false, isTrial: false, isExpired: false, daysRemaining: 0, trialEndsAt: null, plan: null, shareTrialClaimed: false, everPaid: false, planState: 'free_never' };
try {
  const saved = window.localStorage.getItem('tolet_sub_cache');
  if (saved) {
    cachedStatus = { ...JSON.parse(saved), isLoading: true };
  }
} catch(e) {}


export const PREMIUM_FEATURES = [
  'analytics',
  'documents',
  'bookings',
  'rent',
  'smartAlerts',
  'aiInsights',
];

// Plan limits. MUST mirror tolet-pro-backend/utils/subscriptionTier.js →
// TIER_LIMITS, which is where they are actually ENFORCED. This copy exists so
// the wizard can disable a control before the user wastes an upload; a
// mismatch here just means the API rejects something the UI allowed.
//
// Pro is "unlimited listings" but NOT unlimited media — the plan sells 50
// photos and 5 videos per property (this used to say Infinity/Infinity, which
// contradicted the pricing table on the same screen).
export const TIER_LIMITS = {
  free: { maxProperties: 1, maxPhotos: 5, maxVideos: 0 },
  plus: { maxProperties: 3, maxPhotos: 15, maxVideos: 1 },
  pro: { maxProperties: Infinity, maxPhotos: 50, maxVideos: 5 }
};

const FEATURE_LABELS = {
  analytics:   { en: 'Analytics',        bn: 'অ্যানালিটিক্স' },
  documents:   { en: 'Home Management',  bn: 'হোম ম্যানেজমেন্ট' },
  bookings:    { en: 'Bookings',         bn: 'বুকিং' },
  rent:        { en: 'Rent Collection',  bn: 'ভাড়া কালেকশন' },
  smartAlerts: { en: 'Smart Alerts',     bn: 'স্মার্ট অ্যালার্টস' },
  aiInsights:  { en: 'AI Insights',      bn: 'এআই ইনসাইটস' },
};

// Prices below are only the fallback: a super admin sets the live monthly
// prices and the yearly discount in the admin console, and fetchPlans() writes
// them onto these objects (cached in localStorage so the next visit opens on
// the right price). A yearly plan also carries listPrice (12 × monthly) and
// discount (%), for the strike-through.
export const PLANS = [
  {
    id: 'plus_monthly',
    name: { en: 'Plus', bn: 'প্লাস' },
    price: 19,
    currency: '৳',
    interval: 'month',
    intervalLabel: { en: '/month', bn: '/মাসিক' },
    popular: false,
    tier: 'plus',
    benefits: { en: ['Up to 3 Active Listings', '1x Top Search Boost/mo', 'Rent & Bookings Management', 'Plus Badge'], bn: ['সর্বোচ্চ ৩টি অ্যাক্টিভ লিস্টিং', 'মাসে ১টি টপ সার্চ বুস্ট', 'ভাড়া ও বুকিং ম্যানেজমেন্ট', 'প্লাস ব্যাজ'] },
  },
  {
    id: 'plus_yearly',
    name: { en: 'Plus', bn: 'প্লাস' },
    price: 182,
    listPrice: 228,
    discount: 20,
    currency: '৳',
    interval: 'year',
    intervalLabel: { en: '/year', bn: '/বছর' },
    popular: false,
    tier: 'plus',
    benefits: { en: ['Up to 3 Active Listings', '1x Top Search Boost/mo', 'Rent & Bookings Management', 'Plus Badge'], bn: ['সর্বোচ্চ ৩টি অ্যাক্টিভ লিস্টিং', 'মাসে ১টি টপ সার্চ বুস্ট', 'ভাড়া ও বুকিং ম্যানেজমেন্ট', 'প্লাস ব্যাজ'] },
  },
  {
    id: 'pro_monthly',
    name: { en: 'Pro', bn: 'প্রো' },
    price: 49,
    currency: '৳',
    interval: 'month',
    intervalLabel: { en: '/month', bn: '/মাসিক' },
    popular: true,
    tier: 'pro',
    benefits: { en: ['Unlimited Listings', 'Super Boost & Top Position', 'Smart Alerts & AI Insights', 'Pro Badge & Gold Card'], bn: ['আনলিমিটেড লিস্টিং', 'সুপার বুস্ট ও টপ পজিশন', 'স্মার্ট অ্যালার্টস ও এআই ইনসাইটস', 'প্রো ব্যাজ ও গোল্ড কার্ড'] },
  },
  {
    id: 'pro_yearly',
    name: { en: 'Pro', bn: 'প্রো' },
    price: 470,
    listPrice: 588,
    discount: 20,
    currency: '৳',
    interval: 'year',
    intervalLabel: { en: '/year', bn: '/বছর' },
    popular: true,
    tier: 'pro',
    benefits: { en: ['Unlimited Listings', 'Super Boost & Top Position', 'Smart Alerts & AI Insights', 'Pro Badge & Gold Card'], bn: ['আনলিমিটেড লিস্টিং', 'সুপার বুস্ট ও টপ পজিশন', 'স্মার্ট অ্যালার্টস ও এআই ইনসাইটস', 'প্রো ব্যাজ ও গোল্ড কার্ড'] },
  },
];

const KEY_PRICES = 'tolet_plan_prices';

/** Write the server's [{ id, price, listPrice?, discount? }] onto PLANS. */
function applyPrices(serverPlans) {
  if (!Array.isArray(serverPlans)) return;
  for (const p of PLANS) {
    const live = serverPlans.find((x) => x.id === p.id);
    if (!(Number(live?.price) > 0)) continue;
    p.price = Number(live.price);
    if (p.interval === 'year') {
      p.listPrice = Number(live.listPrice) || p.price;
      p.discount = Number(live.discount) || 0;
    }
  }
}
try { applyPrices(JSON.parse(window.localStorage.getItem(KEY_PRICES) || 'null')); } catch { /* fallback prices */ }

/** The yearly discount for a tier, in whole percent (0 = none). */
export function yearlySavingPercent(tier) {
  return PLANS.find((p) => p.tier === tier && p.interval === 'year')?.discount || 0;
}

const getToken = () => window.localStorage.getItem('auth:token');

function authHeaders() {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const headers = authHeaders();
  // The browser sets the multipart boundary itself.
  if (isForm) delete headers['Content-Type'];
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const err = new Error(data.message || 'অনুরোধে সমস্যা হয়েছে।');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * Collapse the cached status into the ONE state the UI branches on, so the
 * dashboard and the listing wizard can never disagree about what to offer:
 *
 *   'paid_active'  — live paid plan            → nothing to prompt
 *   'trial_active' — share trial running       → nothing to prompt
 *   'paid_expired' — a paid period lapsed      → "Renew Your Plan"  → /subscription
 *   'trial_lapsed' — share trial spent + over  → "Upgrade to Pro"   → /subscription
 *   'free_never'   — never claimed, never paid → the share-trial offer
 *
 * Order matters: someone who used the share trial and LATER paid should be
 * asked to renew, not re-offered a reward the server would refuse.
 */
function derivePlanState(s) {
  if (s.isPaid && !s.isExpired) return 'paid_active';
  if (s.isTrial) return 'trial_active';
  if (s.everPaid) return 'paid_expired';
  if (s.shareTrialClaimed) return 'trial_lapsed';
  return 'free_never';
}

function updateCache(dbSub) {
  // Whether the one-time "share the app" Pro trial has already been taken.
  // Read off every branch below (including the free one) so the Free Pro Trial
  // CTA stays hidden after the reward has been used AND after it expires —
  // the reward is once per account, not once per free period.
  const shareTrialClaimed = !!dbSub?.shareTrialClaimedAt;
  // Did money ever change hands? `currentPeriodEnd` is stamped only by
  // checkout, so it's what separates "renew" from "upgrade" once a host is
  // back on free.
  const everPaid = !!dbSub?.currentPeriodEnd;

  if (!dbSub) {
    cachedStatus = { tier: 'free', isLoading: false, isPaid: false, isTrial: false, isExpired: false, daysRemaining: 0, trialEndsAt: null, plan: null, shareTrialClaimed, everPaid };
  } else if (dbSub.status === 'active' && dbSub.currentPeriodEnd) {
    const msLeft = new Date(dbSub.currentPeriodEnd).getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    const planDef = PLANS.find(p => p.id === dbSub.planId) || { id: dbSub.planId, name: { en: 'Pro', bn: 'প্রো' }, tier: 'pro' };
    const live = daysRemaining > 0;

    cachedStatus = {
      // A LAPSED paid period is free, not the tier they used to hold. This
      // mirrors the server's tierOf() — without it the wizard would hand an
      // expired payer Pro's 50-photo allowance and the API would then reject
      // the listing at publish.
      tier: live ? (planDef.tier || 'pro') : 'free',
      plan: { id: planDef.id, name: planDef.name, interval: planDef.interval },
      isPaid: live,
      isTrial: false,
      isExpired: !live,
      daysRemaining,
      paidThroughAt: dbSub.currentPeriodEnd,
      autoRenew: dbSub.autoRenew,
      shareTrialClaimed,
      everPaid,
      isLoading: false
    };
  } else if (dbSub.status === 'trialing' && dbSub.trialEndsAt) {
    const msLeft = new Date(dbSub.trialEndsAt).getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    cachedStatus = {
      // The share trial grants full Pro for 2 months. The backend records
      // which tier it granted (Subscription.trialTier) instead of us assuming
      // — so a future "1 month of Plus" promo needs no frontend change.
      // An already-expired trial falls through to free below via daysRemaining.
      tier: daysRemaining > 0 ? (dbSub.trialTier || 'pro') : 'free',
      plan: null,
      isPaid: false,
      isTrial: daysRemaining > 0,
      isExpired: daysRemaining === 0,
      daysRemaining,
      trialEndsAt: dbSub.trialEndsAt,
      shareTrialClaimed,
      everPaid,
      isLoading: false
    };
  } else {
    // No trial, no paid period — either a brand-new account (there is no
    // automatic trial any more, so this is the normal starting state) or one
    // whose row exists only because of a cancelled plan.
    //
    // `isExpired` must distinguish those two: it drives a red "Trial ended"
    // badge, and showing that to someone who never had a trial reads as a
    // broken account. Only claim expiry when a period actually lapsed.
    const everHadPeriod = !!(dbSub.trialEndsAt || dbSub.currentPeriodEnd);
    cachedStatus = { tier: 'free', isLoading: false, isPaid: false, isTrial: false, isExpired: everHadPeriod, daysRemaining: 0, trialEndsAt: null, plan: null, shareTrialClaimed, everPaid };
  }
  cachedStatus.planState = derivePlanState(cachedStatus);
  try { window.localStorage.setItem('tolet_sub_cache', JSON.stringify(cachedStatus)); } catch(e) {}
  broadcast(KEY_SUBSCRIPTION);
  return cachedStatus;
}

export const subscriptionService = {
  getStatus() {
    return cachedStatus;
  },

  async fetchStatus() {
    if (!getToken()) return cachedStatus;
    try {
      const data = await call('/billing/subscription');
      return updateCache(data.subscription);
    } catch (err) {
      console.error('[subscriptionService] fetch error:', err);
      return cachedStatus;
    }
  },

  getLockedFeatures() {
    if (cachedStatus.tier === 'pro') return [];
    if (cachedStatus.tier === 'plus') return ['analytics', 'smartAlerts', 'aiInsights']; // Plus locks these
    return [...PREMIUM_FEATURES]; // Free locks everything in PREMIUM_FEATURES
  },

  labelFor(featureId, lang = 'English') {
    const entry = FEATURE_LABELS[featureId];
    if (!entry) return featureId;
    return lang === 'বাংলা' ? entry.bn : entry.en;
  },

  /**
   * Everything the checkout needs in one request: live prices (written onto
   * PLANS and cached) and the payment methods hosts can pay with — each
   * { id, type: bkash|nagad|rocket|bank, name, accountNumber, accountName,
   *   accountType, bankName, branchName, routingNumber, instructions, autoCheck }.
   * Returns a fresh plans array so a component holding it in state re-renders;
   * on a network error the cached prices stay and methods is null.
   */
  async fetchCheckoutOptions() {
    try {
      const data = await call('/billing/plans');
      const prices = (data.plans || []).map(({ id, price, listPrice, discount }) => ({ id, price, listPrice, discount }));
      applyPrices(prices);
      try { window.localStorage.setItem(KEY_PRICES, JSON.stringify(prices)); } catch { /* private mode */ }
      return { plans: [...PLANS], methods: data.methods || [] };
    } catch (err) {
      console.error('[subscriptionService] plans fetch error:', err);
      return { plans: [...PLANS], methods: null };
    }
  },

  /** Live prices onto PLANS (see fetchCheckoutOptions). */
  async fetchPlans() {
    return (await subscriptionService.fetchCheckoutOptions()).plans;
  },

  /** The host's recent Send Money claims, newest first. */
  async getPayments() {
    const data = await call('/billing/payments');
    return data.payments || [];
  },

  /**
   * Submit the payment details (+ optional screenshot File) for one of the
   * methods from fetchCheckoutOptions. Accepted at once when our wallet's SMS
   * has already arrived; otherwise the returned payment is 'pending' until the
   * SMS comes in or an admin checks it.
   */
  async submitPayment({ planId, methodId, trxId, sender, file }) {
    const form = new FormData();
    form.append('planId', planId);
    form.append('methodId', methodId);
    form.append('trxId', trxId);
    form.append('sender', sender);
    if (file) form.append('file', file);
    const data = await call('/billing/payments', { method: 'POST', body: form });
    updateCache(data.subscription);
    return data.payment;
  },

  async cancel() {
    const data = await call('/billing/cancel', { method: 'POST' });
    return updateCache(data.subscription);
  },

  /**
   * Claim the one-time free Pro trial earned by sharing the app link
   * (FreeProTrialModal). The server is the only authority here — the wizard's
   * photo/video limits and the publish-time validation both read the
   * Subscription row this writes, so a client-side flag would unlock the UI
   * and then fail at Publish.
   *
   * Throws with `err.code` of 'share_trial_already_claimed' /
   * 'share_trial_not_eligible' / 'share_trial_not_landlord' when refused.
   */
  async claimShareTrial() {
    const data = await call('/billing/share-trial', { method: 'POST' });
    return updateCache(data.subscription);
  },

  /**
   * Can this host still earn the share trial? False once claimed, and false
   * while they already hold Plus/Pro (nothing to unlock).
   */
  canClaimShareTrial() {
    return !cachedStatus.shareTrialClaimed && cachedStatus.tier === 'free';
  },

  onChange(listener) {
    return subscribeKey(KEY_SUBSCRIPTION, listener);
  },
};
