import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { Sparkles, Check, X, ArrowLeft, Crown, PlayCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService } from '../services/subscriptionService';
import { getSectionGuides } from '../services/aiGuideService';

// Full list of features for the comparison table
const ALL_FEATURES = [
  { id: 'listings', en: 'Active Listings', bn: 'অ্যাক্টিভ লিস্টিং', free: '1', plus: 'Up to 3', pro: 'Unlimited' },
  { id: 'photos', en: 'Photos per property', bn: 'প্রতি প্রপার্টিতে ছবি', free: '5', plus: '15', pro: '50' },
  { id: 'videos', en: 'Videos per property', bn: 'প্রতি প্রপার্টিতে ভিডিও', free: '✗', plus: '1', pro: '5' },
  { id: 'boost', en: 'Search Boost', bn: 'সার্চ বুস্ট', free: '✗', plus: '1× / month', pro: 'Super Boost + Top Position' },
  { id: 'fbboost', en: 'Facebook Boost Post', bn: 'ফেসবুক বুস্ট পোস্ট', free: '✗', plus: 'Boost Post', pro: 'Super Boost Post' },
  { id: 'rent', en: 'Rent Collection', bn: 'ভাড়া কালেকশন', free: '✗', plus: '✓', pro: '✓' },
  { id: 'bookings', en: 'Bookings Pipeline', bn: 'বুকিং পাইপলাইন', free: '✗', plus: '✓', pro: '✓' },
  { id: 'alerts', en: 'Smart Alerts', bn: 'স্মার্ট অ্যালার্টস', free: '✗', plus: '✗', pro: '✓' },
  { id: 'analytics', en: 'Advanced Analytics', bn: 'অ্যাডভান্সড অ্যানালিটিক্স', free: '✗', plus: '✗', pro: '✓' },
  { id: 'ai', en: 'AI Insights & Pricing', bn: 'এআই ইনসাইটস ও প্রাইসিং', free: '✗', plus: '✗', pro: '✓' },
  { id: 'badge', en: 'Profile Badge', bn: 'প্রোফাইল ব্যাজ', free: '✗', plus: 'Plus Badge', pro: 'Pro Badge + Gold Card' },
];

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/host-dashboard');
  const [params] = useSearchParams();
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';
  
  const [status, setStatus] = useState(() => subscriptionService.getStatus());
  const [billingCycle, setBillingCycle] = useState('month');
  
  // Video Guides State
  const [guides, setGuides] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  
  useEffect(() => {
    subscriptionService.fetchStatus();
    const off = subscriptionService.onChange(() => setStatus(subscriptionService.getStatus()));
    
    // Fetch video guides for subscription page
    getSectionGuides('subscription').then(data => {
      const fetchedGuides = Array.isArray(data) ? data : [];
      setGuides(fetchedGuides);
      if (fetchedGuides.length > 0 && !sessionStorage.getItem('subscription_video_played')) {
        setActiveVideo(fetchedGuides[0].videoUrl);
        sessionStorage.setItem('subscription_video_played', 'true');
      }
    });

    return off;
  }, []);

  const handleUpgrade = (planId) => {
    navigate(`/checkout/${planId}_${billingCycle === 'month' ? 'monthly' : 'yearly'}`);
  };

  // Determine current active plan strictly for UI highlight.
  //
  // `isTrial` is tracked separately from the tier: a landlord on the 2-month
  // launch trial has tier 'pro' but isPaid false, so without this they fell
  // through to the "You're on the Free Plan" banner while actually holding Pro.
  const currentPlanTier = status.tier || 'free';
  const isTrial = !!status.isTrial && status.daysRemaining > 0;
  const isFree = currentPlanTier === 'free';
  const isPlus = currentPlanTier === 'plus' && !isTrial;
  const isPro = currentPlanTier === 'pro' && !isTrial;

  // Helper to format youtube URL to embed
  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      return url.replace('watch?v=', 'embed/');
    }
    if (url.includes('youtu.be/')) {
      return url.replace('youtu.be/', 'youtube.com/embed/');
    }
    return url;
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0A0A0F] text-[#0F172A] dark:text-[#F1F5F9] font-sans transition-colors duration-300 pb-24 overflow-x-hidden relative">
      
      {/* Abstract Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-violet-600/10 dark:bg-violet-600/20 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-screen" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-6">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-4 group"
        >
          <div className="bg-white dark:bg-white/10 dark:border-white/10 p-2 rounded-full shadow-sm group-hover:shadow-md transition-all border border-slate-200">
            <ArrowLeft size={16} />
          </div>
          {isBn ? 'ফিরে যান' : 'Go Back'}
        </button>

        {/* SECTION 1: Hero Status Banner */}
        <div className="flex justify-center mb-6">
          {isTrial && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:from-emerald-400/20 dark:to-teal-400/20 border border-emerald-200 dark:border-emerald-500/30 backdrop-blur-md shadow-lg shadow-emerald-500/10">
              <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                {isBn
                  ? `ফ্রি ${currentPlanTier === 'pro' ? 'প্রো' : 'প্লাস'} ট্রায়াল চলছে — ${status.daysRemaining} দিন বাকি`
                  : `Free ${currentPlanTier === 'pro' ? 'Pro' : 'Plus'} trial — ${status.daysRemaining} days remaining`}
              </p>
            </div>
          )}
          {isFree && !isTrial && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {isBn ? 'আপনি ফ্রি প্ল্যানে আছেন — আরও সুবিধা আনলক করুন' : "You're on the Free Plan — Unlock More"}
              </p>
            </div>
          )}
          {isPlus && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600/10 to-purple-600/10 dark:from-violet-500/20 dark:to-purple-500/20 border border-violet-200 dark:border-violet-500/30 backdrop-blur-md shadow-lg shadow-violet-500/5">
              <Crown size={18} className="text-violet-600 dark:text-violet-400 animate-pulse" />
              <p className="text-sm font-bold text-violet-800 dark:text-violet-200">
                {isBn ? `আপনি প্লাস প্ল্যানে আছেন — ${status.daysRemaining} দিন বাকি` : `You're on Plus — ${status.daysRemaining} days remaining`}
              </p>
            </div>
          )}
          {isPro && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 dark:from-amber-400/20 dark:to-yellow-400/20 border border-amber-200 dark:border-amber-500/30 backdrop-blur-md shadow-lg shadow-amber-500/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              <Sparkles size={18} className="text-amber-600 dark:text-amber-400 animate-pulse relative z-10" />
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200 relative z-10">
                {isBn ? `আপনি প্রো ✦ প্ল্যানে আছেন — ${status.daysRemaining} দিন বাকি` : `You're on Pro ✦ — ${status.daysRemaining} days remaining`}
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2: Header & Toggle */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            {isBn ? 'আপনার বাড়ি ম্যানেজ করুন' : 'Manage your home'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base max-w-3xl mx-auto mb-4 leading-relaxed">
            {isBn
              ? 'খাতা-কলমের হিসাব বাদ দিন! কে ভাড়া দিয়েছে, কে দেয়নি তার স্মার্ট রিমাইন্ডার এবং হিসাব রাখুন। ভেরিফাইড ভাড়াটিয়া খুঁজুন এবং খুব সহজেই সব ম্যানেজ করুন। বাড়িওয়ালা হিসেবে শুরু করলেই ২ মাস Pro সাবস্ক্রিপশন সম্পূর্ণ ফ্রি!'
              : 'Keep track of who paid rent with smart reminders. Find verified tenants and manage everything easily. Every new landlord gets 2 months of Pro absolutely free!'}
          </p>

          {/* Video Guides Row (if any uploaded by admin) */}
          {(guides.length > 0) && (
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {guides.map(guide => (
                <button 
                  key={guide._id}
                  onClick={() => setActiveVideo(guide.videoUrl)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <PlayCircle size={18} />
                  {guide.title || (isBn ? 'ভিডিও গাইড দেখুন' : 'Watch Guide')}
                </button>
              ))}
            </div>
          )}

          {/* Fixed shift button alignment using direct active classes without absolute slider */}
          <div className="inline-flex items-center p-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full shadow-inner">
            <button
              onClick={() => setBillingCycle('month')}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
                billingCycle === 'month' 
                  ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isBn ? 'মাসিক' : 'MONTHLY'}
            </button>
            <button
              onClick={() => setBillingCycle('year')}
              className={`px-8 py-3 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                billingCycle === 'year' 
                  ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {isBn ? 'বার্ষিক' : 'YEARLY'}
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* SECTION 3: Plan Cards — paid plans only. The Free tier is still
            described in the comparison table below, but it is not sold here,
            so it gets no card. Two cards → a 2-column grid. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-12 items-center max-w-4xl mx-auto">

          {/* PLUS CARD */}
          <div className="bg-white dark:bg-[#13111C] border border-violet-200 dark:border-violet-500/30 rounded-3xl p-8 shadow-2xl shadow-violet-500/10 dark:shadow-[0_0_40px_-15px_rgba(124,58,237,0.3)] flex flex-col h-full hover:-translate-y-1 hover:shadow-violet-500/20 transition-all duration-300 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600" />
            <div className="mb-6">
              <span className="inline-block px-3 py-1 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-black uppercase tracking-widest rounded-full mb-4">
                PLUS
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-3">
                {isBn ? '২-৩টি বাড়ি ম্যানেজ করেন? এই প্ল্যান আপনার জন্য' : 'Managing 2-3 properties? This is for you'}
              </p>
              <div className="flex items-baseline gap-1 relative mb-2">
                <span className="text-4xl font-display font-extrabold text-slate-900 dark:text-white transition-opacity duration-300">
                  ৳{billingCycle === 'year' ? '229' : '19'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">/{billingCycle === 'year' ? 'yr' : 'mo'}</span>
              </div>
            </div>
            
            <div className="flex-1 space-y-4 mb-8">
              {[
                'Up to 3 Active Listings', '15 Photos + 1 Video', '1× Top Search Boost/month',
                'Rent Collection Ledger', 'Bookings Pipeline', 'Plus Badge on Profile'
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check size={18} className="text-violet-500 dark:text-violet-400 shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">{feat}</span>
                </div>
              ))}
              {['No Smart Alerts', 'No AI Insights', 'No Gold Card'].map((feat, i) => (
                <div key={i} className="flex items-start gap-3 opacity-50">
                  <X size={18} className="text-slate-400 shrink-0 mt-0.5" strokeWidth={3} />
                  <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{feat}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleUpgrade('plus')}
              disabled={isPlus}
              className={`w-full py-4 rounded-2xl font-bold transition-all ${isPlus ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/30 hover:shadow-xl hover:shadow-violet-600/40'}`}
            >
              {isPlus ? (isBn ? 'বর্তমান প্ল্যান' : 'Current Plan') : (isBn ? 'প্লাস এ আপগ্রেড করুন' : 'Upgrade to Plus')}
            </button>
          </div>

          {/* PRO CARD (MOST POPULAR) */}
          <div className="relative bg-white dark:bg-[#1A160F] rounded-3xl p-8 flex flex-col h-full transform lg:scale-105 z-10 hover:-translate-y-1 transition-transform duration-300 shadow-2xl shadow-amber-500/20 dark:shadow-[0_0_50px_-15px_rgba(245,158,11,0.3)] backdrop-blur-xl group">
            {/* Shimmer Border Setup */}
            <div className="absolute inset-0 rounded-3xl p-[2px] bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 animate-border-shimmer bg-[length:200%_200%] -z-10" />
            <div className="absolute inset-[2px] bg-white dark:bg-[#130F0A] rounded-[22px] -z-10" />
            
            {/* Ribbon */}
            <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest py-1 px-3 rounded-full shadow-lg shadow-amber-500/40 rotate-12 z-20">
              {isBn ? 'সবচেয়ে জনপ্রিয়' : 'MOST POPULAR'}
            </div>

            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-widest rounded-full mb-4">
                <Crown size={12} strokeWidth={3} /> PRO
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-3">
                {isBn ? 'একাধিক বাড়ি আছে? সব কিছু এক জায়গায় কন্ট্রোল করুন' : 'Multiple properties? Control everything in one place'}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-display font-extrabold text-slate-900 dark:text-white">
                  ৳{billingCycle === 'year' ? '599' : '49'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">/{billingCycle === 'year' ? 'yr' : 'mo'}</span>
              </div>
              {/* The launch trial grants PRO, so the free-months badge belongs
                  on this card — it used to sit on the Plus card. */}
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded w-max">
                {isBn ? 'নতুন বাড়িওয়ালাদের প্রথম ২ মাস ফ্রি!' : 'First 2 months free for new landlords!'}
              </div>
            </div>
            
            <div className="flex-1 space-y-4 mb-8">
              {[
                'Unlimited Listings (No limits)', '50 Photos + 5 Videos', 'Super Boost + Top Position',
                'Smart Alerts (Push, WA, SMS)', 'Advanced Analytics & KPIs', 'Pro Badge + Gold Card',
                'Revenue & Tenant Scorecards', 'AI Pricing & Demand Forecasts'
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} className="text-amber-600 dark:text-amber-400" strokeWidth={4} />
                  </div>
                  <span className="text-slate-800 dark:text-slate-200 text-sm font-semibold">{feat}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleUpgrade('pro')}
              disabled={isPro}
              className={`w-full py-4 rounded-2xl font-bold transition-all relative overflow-hidden ${isPro ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-xl shadow-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/50 group-hover:after:animate-shimmer after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent after:-translate-x-full'}`}
            >
              {isPro ? (isBn ? 'বর্তমান প্ল্যান' : 'Current Plan') : (isBn ? 'প্রো তে আপগ্রেড করুন' : 'Upgrade to Pro')}
            </button>
          </div>

        </div>

        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-16">
          {isBn ? 'টু-লেট প্রো-তে সব প্ল্যানেই লিস্টিং করা ফ্রি। প্রিমিয়াম প্ল্যানগুলো ভাড়া ব্যাবসা বাড়াতে বাড়তি সুবিধা দেয়।' : 'All plans include free listing on To-Let Pro. Premium plans unlock powerful tools to manage and grow your rental income.'}
        </p>

        {/* SECTION 4: Feature Comparison Table */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-none backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 font-bold text-slate-900 dark:text-white w-2/5">
                    {isBn ? 'ফিচার সমূহ' : 'Features'}
                  </th>
                  <th className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 font-black text-slate-500 dark:text-slate-400 text-center w-1/5">FREE</th>
                  <th className="p-6 bg-violet-50/50 dark:bg-violet-500/10 border-b border-violet-100 dark:border-violet-500/20 font-black text-violet-700 dark:text-violet-400 text-center w-1/5">PLUS</th>
                  <th className="p-6 bg-amber-50/50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20 font-black text-amber-700 dark:text-amber-400 text-center w-1/5">PRO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {ALL_FEATURES.map((feat) => (
                  <tr key={feat.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isBn ? feat.bn : feat.en}
                    </td>
                    <td className="p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                      {feat.free === '✓' ? <Check size={18} className="mx-auto text-slate-400" /> : feat.free === '✗' ? <X size={18} className="mx-auto opacity-30" /> : feat.free}
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-violet-700 dark:text-violet-300 bg-violet-50/30 dark:bg-violet-500/5">
                      {feat.plus === '✓' ? <Check size={18} className="mx-auto text-violet-500" strokeWidth={3} /> : feat.plus === '✗' ? <X size={18} className="mx-auto opacity-30" /> : feat.plus}
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-500/5">
                      {feat.pro === '✓' ? <Check size={18} className="mx-auto text-amber-500" strokeWidth={3} /> : feat.pro === '✗' ? <X size={18} className="mx-auto opacity-30" /> : feat.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Video Modal Overlay */}
      {activeVideo && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#13111C] w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
            <button 
              onClick={() => setActiveVideo(null)} 
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center z-10 transition-colors backdrop-blur-md"
            >
              <X size={24} />
            </button>
            <div className="aspect-video w-full bg-black">
              <iframe 
                src={getEmbedUrl(activeVideo)} 
                className="w-full h-full border-0" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowFullScreen 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
