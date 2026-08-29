/**
 * RouteSeoGuard.jsx — head defaults for every route that doesn't set its own.
 * ─────────────────────────────────────────────────────────────────────────────
 * Two jobs, both of which want to live in one place rather than in eleven
 * components:
 *
 * 1. KEEP PRIVATE SCREENS OUT OF THE INDEX. Dashboards, chat, checkout, the
 *    living hub — none of it is useful in a search result and some of it must
 *    never be there at all. `/join/:token` is the sharp one: those URLs are
 *    landlord invite links printed onto QR codes, and an indexed invite token
 *    is a stranger walking into someone's building record. robots.txt asks
 *    crawlers not to fetch them; this adds `noindex` for the crawlers that
 *    fetch anyway, and for links shared into Facebook or WhatsApp.
 *
 * 2. GIVE THE SMALL PUBLIC PAGES A REAL TITLE. Support and the legal pages are
 *    worth indexing but not worth an import each, so their copy sits in the
 *    table below.
 *
 * ── Why a sibling component works ──
 * This renders just above <Routes>, so React runs its effect BEFORE the route
 * component's. Any page with its own `useSeo` (home, listings, property
 * details, the landing pages, how-it-works) therefore writes last and wins.
 * The guard is the floor, never the ceiling.
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import useSeo from '../../seo/useSeo';

/**
 * Path prefixes that must never be indexed. Order does not matter; the first
 * match wins only for choosing the browser-tab title.
 */
const PRIVATE_PREFIXES = [
  { prefix: '/login', title: 'Sign in' },
  { prefix: '/host-dashboard', title: 'Landlord dashboard' },
  { prefix: '/tenant-dashboard', title: 'Tenant dashboard' },
  { prefix: '/list-property', title: 'List your property' },
  { prefix: '/messages', title: 'Messages' },
  { prefix: '/living', title: 'Living — meals, bills & expenses' },
  { prefix: '/account', title: 'Account' },
  { prefix: '/subscription', title: 'Subscription' },
  { prefix: '/checkout', title: 'Checkout' },
  { prefix: '/smart-alerts', title: 'Smart alerts' },
  { prefix: '/ai-insights', title: 'AI insights' },
  // Invite links. Never index — see the note at the top of this file.
  { prefix: '/join/', title: 'Join your property' },
  { prefix: '/inquire/', title: 'Send an inquiry' },
  // Individual people's profiles. Thin for search, and not ours to publish.
  { prefix: '/landlord/', title: 'Landlord profile' },
  { prefix: '/tenant/', title: 'Tenant profile' },
  // The in-app services hub. /home-services is the public, indexable version
  // of this content; indexing both would split the ranking between them.
  { prefix: '/services', title: 'Home services' },
];

/** Public pages whose components don't manage their own head. */
const PUBLIC_ROUTE_SEO = {
  '/support': {
    title: 'সাহায্য ও সাপোর্ট — Help & Support',
    description:
      'TO-LET PRO ব্যবহারে কোনো সমস্যা? বাসা ভাড়া, বিজ্ঞাপন, অ্যাকাউন্ট, পেমেন্ট বা '
      + 'রিপোর্ট সংক্রান্ত সাহায্যের জন্য সাপোর্ট টিমের কাছে অনুরোধ পাঠান — বাংলা ও ইংরেজিতে।',
  },
  '/privacy-policy': {
    title: 'প্রাইভেসি পলিসি — Privacy Policy',
    description:
      'TO-LET PRO কোন তথ্য সংগ্রহ করে, কেন করে, কতদিন রাখে এবং আপনি কিভাবে আপনার তথ্য '
      + 'দেখতে, সংশোধন করতে বা মুছে ফেলতে পারেন — সম্পূর্ণ প্রাইভেসি পলিসি।',
  },
  '/terms': {
    title: 'ব্যবহারের শর্তাবলী — Terms of Service',
    description:
      'TO-LET PRO ব্যবহারের শর্তাবলী — বাড়িওয়ালা ও ভাড়াটিয়ার দায়িত্ব, বিজ্ঞাপনের নিয়ম, '
      + 'নিষিদ্ধ ব্যবহার এবং অ্যাকাউন্ট সংক্রান্ত শর্ত।',
  },
  '/refund': {
    title: 'রিফান্ড পলিসি — Refund Policy',
    description:
      'TO-LET PRO এর পেইড প্ল্যান ও বুস্ট সংক্রান্ত রিফান্ড নীতি — কখন রিফান্ড প্রযোজ্য, '
      + 'কিভাবে অনুরোধ করবেন এবং কত সময় লাগে।',
  },
  '/trust-safety': {
    title: 'ট্রাস্ট ও নিরাপত্তা — Trust & Safety',
    description:
      'ভেরিফিকেশন, প্রতারণা এড়ানোর উপায়, নিরাপদে বাসা দেখা ও রিপোর্ট করার নিয়ম — '
      + 'TO-LET PRO তে নিরাপদ থাকার নির্দেশিকা।',
  },
};

const RouteSeoGuard = () => {
  const { pathname } = useLocation();

  const priv = PRIVATE_PREFIXES.find((p) => pathname.startsWith(p.prefix));
  const pub = PUBLIC_ROUTE_SEO[pathname];

  useSeo(
    priv
      ? { title: priv.title, noindex: true }
      : pub
        ? { ...pub, canonical: pathname }
        : {},
  );

  return null;
};

export default RouteSeoGuard;
