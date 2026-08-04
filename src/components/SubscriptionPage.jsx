import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import {
  Sparkles, Check, Zap, ArrowLeft, Crown, BellRing,
  Calendar, Wallet, TrendingUp, Folder, ShieldCheck, Clock, CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS, PREMIUM_FEATURES } from '../services/subscriptionService';

const FEATURE_META = {
  analytics:   { icon: TrendingUp, en: 'Analytics',       bn: 'অ্যানালিটিক্স',     descEn: 'KPIs, revenue chart, tenant scorecards', descBn: 'KPI, রেভিনিউ চার্ট, ভাড়াটিয়া স্কোরকার্ড' },
  documents:   { icon: Folder,     en: 'Home Management', bn: 'হোম ম্যানেজমেন্ট',   descEn: 'Lease, IDs, receipts, utility vault',     descBn: 'লিজ, আইডি, রসিদ, ইউটিলিটি ভল্ট' },
  bookings:    { icon: Calendar,   en: 'Bookings',        bn: 'বুকিং',              descEn: 'Lease stages: Draft → Active → Done',     descBn: 'লিজ স্টেজ: ড্রাফট → অ্যাক্টিভ → শেষ' },
  rent:        { icon: Wallet,     en: 'Rent Collection', bn: 'ভাড়া কালেকশন',     descEn: 'Shared ledger, dues, partial payments',  descBn: 'শেয়ার্ড লেজার, বকেয়া, পার্শিয়াল পেমেন্ট' },
  smartAlerts: { icon: BellRing,   en: 'Smart Alerts',    bn: 'স্মার্ট অ্যালার্টস', descEn: 'Auto-reminders via App Push, WhatsApp, or SMS', descBn: 'অ্যাপ, হোয়াটসঅ্যাপ বা SMS এর মাধ্যমে অটো রিমাইন্ডার' },
  aiInsights:  { icon: Sparkles,   en: 'AI Insights',     bn: 'এআই ইনসাইটস',       descEn: 'Pricing tips, demand forecasts',          descBn: 'প্রাইসিং টিপস, ডিমান্ড ফোরকাস্ট' },
};

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/host-dashboard');
  const [params] = useSearchParams();
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';
  const fromFeature = params.get('from');

  const [status, setStatus] = useState(() => subscriptionService.getStatus());
  const [billingCycle, setBillingCycle] = useState('month');
  
  // Default select the 'pro' plan of the current cycle
  const [selectedPlanId, setSelectedPlanId] = useState(`pro_${billingCycle}`);
  
  useEffect(() => {
    subscriptionService.fetchStatus();
    const off = subscriptionService.onChange(() => setStatus(subscriptionService.getStatus()));
    return off;
  }, []);

  // When cycle changes, try to keep the same tier selected if possible
  useEffect(() => {
    const currentTier = selectedPlanId.split('_')[0];
    setSelectedPlanId(`${currentTier}_${billingCycle}`);
  }, [billingCycle]);

  const handleContinue = () => {
    if (selectedPlanId) {
      navigate(`/checkout/${selectedPlanId}`);
    }
  };

  const banner = (() => {
    if (status.isPaid) {
      return {
        accent: 'from-emerald-500 to-green-600',
        title: isBn ? `আপনি ${status.tier === 'pro' ? 'প্রো' : 'প্লাস'} সদস্য` : `You're on ${status.tier === 'pro' ? 'Pro' : 'Plus'}`,
        body: isBn
          ? `আপনার সাবস্ক্রিপশন ${status.daysRemaining} দিন বাকি আছে।`
          : `${status.daysRemaining} day${status.daysRemaining === 1 ? '' : 's'} of premium access remaining.`,
        icon: Crown,
      };
    }
    if (status.isExpired) {
      return {
        accent: 'from-[#ba0036] to-[#ff004c]',
        title: isBn ? 'আপনার ট্রায়াল শেষ' : 'Your free trial has ended',
        body: isBn
          ? 'প্রিমিয়াম ফিচারগুলো আবার আনলক করতে যেকোনো প্ল্যান বেছে নিন।'
          : 'Pick a plan below to unlock premium features again.',
        icon: ShieldCheck,
      };
    }
    return {
      accent: 'from-blue-500 to-indigo-600',
      title: isBn ? 'ফ্রি ট্রায়াল চলছে' : 'Free trial in progress',
      body: isBn
        ? `আপনার ৩-মাসের ট্রায়ালের ${status.daysRemaining} দিন বাকি আছে — কোনো কার্ডের প্রয়োজন নেই।`
        : `${status.daysRemaining} day${status.daysRemaining === 1 ? '' : 's'} left in your 3-month trial — no card required.`,
      icon: Clock,
    };
  })();

  const BannerIcon = banner.icon;

  const filteredPlans = PLANS.filter(p => p.interval === billingCycle && p.id !== 'free');

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans relative overflow-hidden text-gray-900">
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-24">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#ba0036] transition-colors mb-6 group"
        >
          <div className="bg-white p-2 rounded-full shadow-sm group-hover:shadow-md transition-all border border-gray-100">
            <ArrowLeft size={16} />
          </div>
          {isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
        </button>

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          
          {/* LEFT COLUMN: Banner & Features (The "Promotional Graphic") */}
          <div className="w-full lg:w-1/2 flex flex-col gap-5">
            {/* Status banner */}
            <div className={`rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-gray-200/50 bg-gradient-to-br ${banner.accent} overflow-hidden relative`}>
              <div className="absolute -right-10 -top-10 opacity-10 rotate-12 scale-150">
                <Crown size={200} />
              </div>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                  <BannerIcon size={26} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">{banner.title}</h1>
                  <p className="text-sm font-bold text-white/90 mt-1">{banner.body}</p>
                </div>
              </div>
            </div>

            {/* Why we sent you here */}
            {fromFeature && FEATURE_META[fromFeature] && (
              <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-6 shadow-sm flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
                  {(() => {
                    const Icon = FEATURE_META[fromFeature].icon;
                    return <Icon size={20} />;
                  })()}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-[#ba0036] uppercase tracking-widest">{isBn ? 'প্রিমিয়াম ফিচার আনলক করুন' : 'Unlock Premium Feature'}</p>
                  <h3 className="text-xl font-black text-gray-900 mt-1">{isBn ? FEATURE_META[fromFeature].bn : FEATURE_META[fromFeature].en}</h3>
                  <p className="text-sm font-bold text-gray-500 mt-1">{isBn ? FEATURE_META[fromFeature].descBn : FEATURE_META[fromFeature].descEn}</p>
                </div>
              </div>
            )}

            {/* All premium features explained */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-200/50 border border-white flex-1">
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Sparkles size={20} className="text-blue-500" />
                {isBn ? 'প্রো প্ল্যানের সুবিধা সমূহ' : 'Premium Benefits'}
              </h2>
              
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PREMIUM_FEATURES.map(id => {
                  const meta = FEATURE_META[id];
                  const Icon = meta.icon;
                  return (
                    <div key={id} className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{isBn ? meta.bn : meta.en}</p>
                        <p className="text-xs font-medium text-gray-500 mt-1 leading-snug">{isBn ? meta.descBn : meta.descEn}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Choose a Plan */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 p-6 md:p-8 border border-white h-full flex flex-col">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  {isBn ? 'প্ল্যান বেছে নিন' : 'Choose a Plan'}
                </h2>
                
                {/* Billing Cycle Toggle */}
                <div className="bg-gray-100 p-1.5 rounded-full flex items-center shrink-0">
                  <button
                    onClick={() => setBillingCycle('month')}
                    className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${billingCycle === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    {isBn ? 'মাসিক' : 'Monthly'}
                  </button>
                  <button
                    onClick={() => setBillingCycle('year')}
                    className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${billingCycle === 'year' ? 'bg-[#ba0036] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    {isBn ? 'বার্ষিক' : 'Yearly'}
                    {billingCycle !== 'year' && <span className="ml-1 text-[9px] text-[#ba0036]">-20%</span>}
                  </button>
                </div>
              </div>

              {/* Radio List of Plans */}
              <div className="flex-1 space-y-4">
                {filteredPlans.map(plan => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 ${isSelected ? 'border-[#ba0036] bg-[#ba0036]/5 shadow-md shadow-[#ba0036]/10' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Radio Button */}
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-[#ba0036]' : 'border-gray-300'}`}>
                            <div className={`w-3 h-3 rounded-full bg-[#ba0036] transition-transform duration-300 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-gray-900">{isBn ? plan.name.bn : plan.name.en}</span>
                              {plan.popular && (
                                <span className="bg-[#ba0036] text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                  {isBn ? 'জনপ্রিয়' : 'Popular'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-gray-500 mt-1 line-clamp-1">
                              {(isBn ? plan.benefits.bn : plan.benefits.en).join(' • ')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-2xl font-black text-gray-900 tracking-tighter">
                            {plan.currency === 'BDT' ? '৳' : plan.currency}{plan.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={handleContinue}
                  disabled={!selectedPlanId}
                  className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${selectedPlanId ? 'bg-[#ba0036] text-white shadow-xl shadow-[#ba0036]/30 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#ba0036]/40' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {isBn ? 'পেমেন্ট করুন' : 'Continue to Payment'}
                </button>
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  {isBn ? 'নিরাপদ পেমেন্ট গেটওয়ে' : 'Secure Encrypted Gateway'}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
