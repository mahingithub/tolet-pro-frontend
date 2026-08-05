/**
 * subscriptionService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Handles host subscription states, plans, and simulated checkouts via API.
 */

import { broadcast, subscribe as subscribeKey } from './_storage.js';

const KEY_SUBSCRIPTION = 'subscription:update';
const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

let cachedStatus = { tier: 'free', isPaid: false, isTrial: false, isExpired: false, daysRemaining: 0, trialEndsAt: null, plan: null };

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
    price: 229,
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
    price: 599,
    currency: '৳',
    interval: 'year',
    intervalLabel: { en: '/year', bn: '/বছর' },
    popular: true,
    tier: 'pro',
    benefits: { en: ['Unlimited Listings', 'Super Boost & Top Position', 'Smart Alerts & AI Insights', 'Pro Badge & Gold Card'], bn: ['আনলিমিটেড লিস্টিং', 'সুপার বুস্ট ও টপ পজিশন', 'স্মার্ট অ্যালার্টস ও এআই ইনসাইটস', 'প্রো ব্যাজ ও গোল্ড কার্ড'] },
  },
];

const getToken = () => window.localStorage.getItem('auth:token');

function authHeaders() {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
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

function updateCache(dbSub) {
  if (!dbSub) {
    cachedStatus = { tier: 'free', isPaid: false, isTrial: false, isExpired: false, daysRemaining: 0, trialEndsAt: null, plan: null };
  } else if (dbSub.status === 'active' && dbSub.currentPeriodEnd) {
    const msLeft = new Date(dbSub.currentPeriodEnd).getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    const planDef = PLANS.find(p => p.id === dbSub.planId) || { id: dbSub.planId, name: { en: 'Pro', bn: 'প্রো' }, tier: 'pro' };
    
    cachedStatus = {
      tier: planDef.tier || 'pro',
      plan: { id: planDef.id, name: planDef.name, interval: planDef.interval },
      isPaid: true,
      isTrial: false,
      isExpired: daysRemaining === 0,
      daysRemaining,
      paidThroughAt: dbSub.currentPeriodEnd,
      autoRenew: dbSub.autoRenew
    };
  } else if (dbSub.status === 'trialing' && dbSub.trialEndsAt) {
    const msLeft = new Date(dbSub.trialEndsAt).getTime() - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    cachedStatus = {
      // The launch trial grants full Pro for 2 months. The backend records
      // which tier it granted (Subscription.trialTier) instead of us assuming
      // — so a future "1 month of Plus" promo needs no frontend change.
      // An already-expired trial falls through to free below via daysRemaining.
      tier: daysRemaining > 0 ? (dbSub.trialTier || 'pro') : 'free',
      plan: null,
      isPaid: false,
      isTrial: daysRemaining > 0,
      isExpired: daysRemaining === 0,
      daysRemaining,
      trialEndsAt: dbSub.trialEndsAt
    };
  } else {
    cachedStatus = { tier: 'free', isPaid: false, isTrial: false, isExpired: true, daysRemaining: 0, trialEndsAt: null, plan: null };
  }
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

  async subscribe(planId, paymentMethod = 'bKash') {
    const data = await call('/billing/checkout', {
      method: 'POST',
      body: { planId, paymentMethod }
    });
    return updateCache(data.subscription);
  },

  async cancel() {
    const data = await call('/billing/cancel', { method: 'POST' });
    return updateCache(data.subscription);
  },

  onChange(listener) {
    return subscribeKey(KEY_SUBSCRIPTION, listener);
  },
};
