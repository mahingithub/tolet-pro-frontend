import React, { useEffect } from 'react';

// 🔴 HeroSection drives the full desktop homepage (Hero, Popular, Network, CTA, Footer).
import HeroSection from './HeroSection';

// 📱 Premium mobile-only home experience — gated below at md:hidden so it never
// affects desktop, and the desktop hero never renders inside the mobile viewport.
import MobileHome from './mobile/MobileHome';

import useSeo from '../seo/useSeo';
import { webPageSchema } from '../seo/schema';
import { ALL_KEYWORDS, toKeywordString } from '../seo/keywords';

// The homepage has to carry BOTH halves of the product in one description —
// the marketplace ("বাসা ভাড়া") and the management tools ("মিল ম্যানেজার") —
// because a brand search for "tolet pro" lands here and needs to see both, and
// because this is the page every other page links back to.
// Kept short on purpose: Google truncates a title around 600px of rendered
// width, and Bengali glyphs are wide. The meal-manager and rent-manager terms
// are carried by their own landing pages, not crammed in here.
const HOME_TITLE = 'বাসা ভাড়া ও টু-লেট — House Rent in Bangladesh';

const HOME_DESCRIPTION =
  'বাংলাদেশের ৬৪ জেলায় বাসা, ফ্ল্যাট, রুম, সিট ও মেস ভাড়ার টু-লেট বিজ্ঞাপন — দালাল ছাড়াই '
  + 'সরাসরি বাড়িওয়ালার সাথে। সাথে মিল ম্যানেজার, রুমমেট ওয়ালেট, ভাড়া কালেকশন ও ভাড়াটিয়া '
  + 'ম্যানেজমেন্ট। Find to-let flats across Bangladesh and manage rent, tenants, meals '
  + 'and shared expenses — free, in Bangla and English.';

const HomePage = () => {
  // No FAQPage block here on purpose: this page renders no visible FAQ, and
  // FAQ markup without matching on-page content is a structured-data violation
  // Google issues manual actions for. The visible FAQs live on /to-let, the
  // feature landing pages and the district pages, and those emit the schema.
  // Organization + WebSite are emitted once, from index.html.
  useSeo({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    keywords: toKeywordString(ALL_KEYWORDS, 30),
    canonical: '/',
    jsonLd: webPageSchema({
      name: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: '/',
    }),
  });

  // Always start at the top when this page mounts.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    // ✨ Premium wrapper with global selection colours + fade-in.
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans relative overflow-hidden text-gray-900 selection:bg-[#ba0036] selection:text-white animate-in fade-in duration-1000">

      {/* ───── MOBILE HOMEPAGE (max-width: 768px) ───── */}
      {/* Self-contained native-app-style feed: sticky glass search, trust */}
      {/* badge rail, swipeable divisions strip, landlord CTA card, and a    */}
      {/* full-bleed image-carousel property feed. Hidden from md and up.    */}
      <div className="md:hidden">
        <MobileHome />
      </div>

      {/* ───── DESKTOP / TABLET HOMEPAGE (≥ md) ───── */}
      {/* The existing HeroSection-driven layout. Hidden below md. */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:relative">
        {/* ✨ AMBIENT GLOWING ORBS FOR PREMIUM FEEL ✨ */}
        <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0"></div>
        <div className="absolute top-[60%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0"></div>

        {/* Main content (z-10 keeps it above the ambient background) */}
        <div className="relative z-10 w-full flex flex-col">
          <section className="w-full">
            <HeroSection />
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
