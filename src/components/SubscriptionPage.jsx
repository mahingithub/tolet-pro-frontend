import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import {
  Sparkles, Check, Zap, ArrowLeft, Crown, BellRing,
  Calendar, Wallet, TrendingUp, Folder, ShieldCheck, Clock, X, CreditCard
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

const PAYMENT_METHODS = [
  { id: 'bKash', label: 'bKash', color: 'bg-[#e2136e] text-white', hover: 'hover:bg-[#b80f58]' },
  { id: 'Nagad', label: 'Nagad', color: 'bg-[#ed1c24] text-white', hover: 'hover:bg-[#cc161e]' },
  { id: 'Rocket', label: 'Rocket', color: 'bg-[#8c1562] text-white', hover: 'hover:bg-[#6c104b]' },
  { id: 'Card', label: 'Credit/Debit Card', icon: CreditCard, color: 'bg-gray-900 text-white', hover: 'hover:bg-gray-800' }
];

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/host-dashboard');
  const [params] = useSearchParams();
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';
  const fromFeature = params.get('from');

  const [status, setStatus] = useState(() => subscriptionService.getStatus());
  const [busyPlan, setBusyPlan] = useState(null);
  const [toast, setToast] = useState(null);
  const [billingCycle, setBillingCycle] = useState('month'); // 'month' or 'year'
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, planId: null });

  useEffect(() => {
    subscriptionService.fetchStatus();
    const off = subscriptionService.onChange(() => setStatus(subscriptionService.getStatus()));
    return off;
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  const handleSubscribeClick = (planId) => {
    setPaymentModal({ isOpen: true, planId });
  };

  const processSubscription = async (methodId) => {
    const planId = paymentModal.planId;
    setPaymentModal({ isOpen: false, planId: null });
    setBusyPlan(planId);
    try {
      // In a real app, you would pass the methodId to the backend
      await subscriptionService.subscribe(planId);
      showToast(isBn ? `সাবস্ক্রিপশন অ্যাক্টিভ! (${methodId})` : `Subscription active! (${methodId})`);
      setTimeout(() => navigate('/host-dashboard'), 1200);
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusyPlan(null);
    }
  };

  const getFilteredPlans = () => {
    const freePlan = {
      id: 'free',
      name: { en: 'Free', bn: 'ফ্রি' },
      price: 0,
      currency: '৳',
      interval: 'month',
      intervalLabel: { en: '', bn: '' },
      popular: false,
      tier: 'free',
      benefits: { en: ['1 Active Listing', 'Max 5 Photos', 'Basic Inbox & Inquiries'], bn: ['১টি অ্যাক্টিভ লিস্টিং', 'সর্বোচ্চ ৫টি ছবি', 'বেসিক ইনবক্স ও ইনকোয়ারি'] },
    };
    const paidPlans = PLANS.filter(p => p.interval === billingCycle);
    return [freePlan, ...paidPlans];
  };

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans relative overflow-hidden text-gray-900">
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Toast */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className="bg-gray-900/90 backdrop-blur-2xl text-white px-5 py-3 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/10 flex items-center gap-3">
          <Check size={14} className="text-green-400" />
          <span className="text-xs font-bold tracking-wide">{toast}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-24">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#ba0036] transition-colors"
        >
          <ArrowLeft size={14} /> {isBn ? 'ড্যাশবোর্ডে ফিরে যান' : 'Back to Dashboard'}
        </button>

        {/* Reason Banner */}
        {fromFeature && FEATURE_META[fromFeature] && (
          <div className="mt-5 bg-white border border-[#ba0036]/15 rounded-[1.5rem] p-5 md:p-6 shadow-sm flex flex-col sm:flex-row gap-4 items-start max-w-3xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center shrink-0">
              {(() => {
                const Icon = FEATURE_META[fromFeature].icon;
                return <Icon size={20} />;
              })()}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-[#ba0036] uppercase tracking-widest">{isBn ? 'প্রিমিয়াম ফিচার' : 'Premium feature'}</p>
              <h3 className="text-lg md:text-xl font-black text-gray-900 mt-0.5">{isBn ? FEATURE_META[fromFeature].bn : FEATURE_META[fromFeature].en}</h3>
              <p className="text-sm font-bold text-gray-500 mt-1">{isBn ? 'এই ফিচারটি ব্যবহার করতে প্লাস বা প্রো প্ল্যানে আপগ্রেড করুন।' : 'Upgrade to a Plus or Pro plan to unlock this feature.'}</p>
            </div>
          </div>
        )}

        {/* Pricing Header */}
        <div className="text-center mt-12 mb-10">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-gray-900">{isBn ? 'প্রাইসিং প্ল্যান' : 'Pricing'}</h1>
          <p className="mt-4 text-base text-gray-500 font-bold max-w-xl mx-auto">
            {isBn ? 'আপনার প্রপার্টি পরিচালনার জন্য সেরা প্ল্যান বেছে নিন।' : 'Enjoy the power of visual analytics, discover your data, build segmentation, predictive and prescriptive models.'}
          </p>
          
          {/* Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="bg-white p-1 rounded-full flex items-center shadow-sm border border-gray-100">
              <button
                onClick={() => setBillingCycle('month')}
                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${billingCycle === 'month' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {isBn ? 'মাসিক' : 'Monthly'}
              </button>
              <button
                onClick={() => setBillingCycle('year')}
                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${billingCycle === 'year' ? 'bg-[#ba0036] text-white shadow-md' : 'text-gray-500 hover:text-[#ba0036]'}`}
              >
                {isBn ? 'বার্ষিক' : 'Yearly'}
              </button>
            </div>
            {billingCycle === 'month' && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">
                {isBn ? 'বার্ষিক প্ল্যানে সাশ্রয়' : 'Save ~20% on Yearly'}
              </span>
            )}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {getFilteredPlans().map(plan => {
            const isPro = plan.tier === 'pro';
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-[2rem] p-6 md:p-8 transition-all hover:-translate-y-1 ${isPro ? 'border-2 border-[#ba0036] shadow-[0_20px_60px_rgba(186,0,54,0.15)] md:-translate-y-4' : 'border border-gray-100 shadow-sm hover:shadow-xl'}`}
              >
                {isPro && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#ba0036] to-[#ff004c] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Crown size={12} /> {isBn ? 'জনপ্রিয়' : 'Most popular'}
                  </div>
                )}
                
                <h3 className={`text-2xl font-black ${isPro ? 'text-[#ba0036]' : 'text-gray-900'}`}>
                  {isBn ? plan.name.bn : plan.name.en}
                </h3>
                
                <div className="mt-4 flex items-end gap-1 border-b border-gray-100 pb-6">
                  <span className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter">{plan.price === 0 ? (isBn ? 'ফ্রি' : 'Free') : `${plan.currency} ${plan.price}`}</span>
                  {plan.price > 0 && <span className="text-sm font-bold text-gray-400 pb-1.5">{isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}</span>}
                </div>
                
                <p className="mt-6 text-[11px] font-bold text-gray-500 mb-4 leading-relaxed">
                  {isBn ? 'যেসব ফিচার পাচ্ছেন:' : 'What is included:'}
                </p>
                
                <ul className="space-y-3 mb-8 min-h-[160px]">
                  {(isBn ? plan.benefits.bn : plan.benefits.en).map(line => (
                    <li key={line} className="flex items-start gap-2 text-sm font-bold text-gray-700 leading-snug">
                      <div className="mt-0.5 w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Check size={10} />
                      </div>
                      {line}
                    </li>
                  ))}
                </ul>
                
                {plan.id === 'free' ? (
                  <button
                    disabled
                    className="w-full py-3.5 rounded-xl font-black text-sm text-gray-400 bg-gray-50 border border-gray-200"
                  >
                    {isBn ? 'বর্তমান প্ল্যান' : 'Current Plan'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribeClick(plan.id)}
                    disabled={busyPlan === plan.id}
                    className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${isPro ? 'bg-[#ba0036] text-white shadow-[0_8px_20px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_25px_rgba(186,0,54,0.35)]' : 'bg-gray-900 text-white hover:bg-gray-800'} ${busyPlan === plan.id ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {busyPlan === plan.id ? (
                      <><Zap size={14} className="animate-pulse" /> {isBn ? 'প্রসেসিং…' : 'Processing…'}</>
                    ) : (
                      <><Sparkles size={14} /> {isBn ? 'আপগ্রেড করুন' : 'Upgrade'}</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method Modal */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setPaymentModal({ isOpen: false, planId: null })} />
          <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-black text-lg text-gray-900">{isBn ? 'পেমেন্ট মেথড' : 'Payment Method'}</h3>
              <button onClick={() => setPaymentModal({ isOpen: false, planId: null })} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {PAYMENT_METHODS.map(method => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => processSubscription(method.id)}
                    className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-colors ${method.color} ${method.hover}`}
                  >
                    {Icon && <Icon size={20} />}
                    <span className="font-black tracking-wide text-sm">{method.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1">
                <ShieldCheck size={12} /> {isBn ? 'নিরাপদ পেমেন্ট' : 'Secure Checkout'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
