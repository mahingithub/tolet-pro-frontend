import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Info, Lock } from 'lucide-react';
import { BkashGateway, NagadGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    color: 'bg-[#e2136e]',
    borderColor: 'border-[#e2136e]',
    bgTint: 'bg-[#e2136e]/5',
    hoverColor: 'hover:bg-[#e2136e]/10',
    ringColor: 'ring-[#e2136e]/30',
    logo: (
      <div className="relative w-20 h-14 md:w-24 md:h-16 bg-[#e2136e] rounded-lg flex items-center justify-center shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105">
        <img 
          src="https://seeklogo.com/images/B/bkash-logo-835789094F-seeklogo.com.png" 
          alt="bKash" 
          className="w-[80%] h-[80%] object-contain" 
          onError={(e) => { 
            e.target.style.display = 'none'; 
            e.target.parentElement.innerHTML = '<span class="text-white font-black text-xl md:text-2xl tracking-tight">bKash</span>'; 
          }} 
        />
      </div>
    )
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    color: 'bg-[#f7941d]',
    borderColor: 'border-[#f7941d]',
    bgTint: 'bg-[#f7941d]/5',
    hoverColor: 'hover:bg-[#f7941d]/10',
    ringColor: 'ring-[#f7941d]/30',
    logo: (
      <div className="relative w-20 h-14 md:w-24 md:h-16 bg-[#f7941d] rounded-lg flex items-center justify-center shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105">
        <span className="text-white font-black text-xl md:text-2xl tracking-wider">নগদ</span>
      </div>
    )
  }
];

const CheckoutPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/subscription');
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';

  const [toast, setToast] = useState(null);
  const [activeGateway, setActiveGateway] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);
  const [autoRenew, setAutoRenew] = useState(true);

  // Find the selected plan
  const plan = PLANS.find(p => p.id === planId);

  useEffect(() => {
    if (!plan) {
      navigate('/subscription');
    }
  }, [plan, navigate]);

  if (!plan) return null;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePaySuccess = async () => {
    try {
      const methodLabel = PAYMENT_METHODS.find(m => m.id === activeGateway)?.label || activeGateway;
      await subscriptionService.subscribe(planId, methodLabel);
      
      setActiveGateway(null);
      showToast(isBn ? 'পেমেন্ট সফল হয়েছে!' : 'Payment Successful!');
      setTimeout(() => navigate('/host-dashboard'), 1500);
    } catch (error) {
      setActiveGateway(null);
      showToast(error.message || 'Payment failed', 'error');
    }
  };

  const isPro = plan.tier === 'pro';
  
  // Theme variables
  const themeClasses = {
    badgeText: isPro ? 'text-amber-700 dark:text-amber-400' : 'text-violet-700 dark:text-violet-400',
    badgeBg: isPro ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-violet-100 dark:bg-violet-500/20',
    buttonBg: isPro ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700',
    toggleBg: isPro ? 'bg-amber-500' : 'bg-violet-600',
    shadow: isPro ? 'shadow-amber-500/30' : 'shadow-violet-600/30',
  };

  const benefitText = isPro 
    ? (isBn ? 'সীমাহীন বাড়ি, AI সহায়তা, সব ফিচার আনলক' : 'Unlimited listings, AI insights, all features unlocked')
    : (isBn ? '৩টি বাড়ি লিস্ট করুন, ভাড়া ট্র্যাক করুন' : 'List up to 3 properties, track rent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:bg-gradient-to-br dark:from-[#0A0A0F] dark:via-[#13111C] dark:to-[#1A1625] font-sans text-slate-900 dark:text-white pb-12 transition-colors duration-300 flex justify-center">
      
      {/* Toast Notification */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border flex items-center gap-3 ${toast?.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-slate-900/90 dark:bg-white/10 text-white border-white/20'}`}>
          <Check size={18} className={toast?.type === 'error' ? 'text-white' : 'text-emerald-400'} />
          <span className="text-sm font-semibold tracking-wide">{toast?.msg}</span>
        </div>
      </div>

      <div className="w-full max-w-[480px] lg:max-w-[540px] px-4 sm:px-6 pt-6 md:pt-10 flex flex-col relative z-10">
        
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            type="button"
            onClick={goBack}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-xl sm:text-2xl">{isBn ? 'চেকআউট' : 'Checkout'}</h1>
        </div>

        {/* SECTION: WHAT YOU'RE BUYING */}
        <div className="bg-white dark:bg-[#13111C] rounded-[20px] sm:rounded-[24px] p-5 sm:p-6 lg:p-7 shadow-lg dark:shadow-2xl border border-slate-200 dark:border-white/10 mb-6 sm:mb-8 hover:shadow-xl transition-shadow duration-300">
          <div className="flex justify-between items-start mb-4 sm:mb-5">
            <div className="flex-1">
              <span className={`inline-block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest ${themeClasses.badgeBg} ${themeClasses.badgeText} mb-2 sm:mb-3`}>
                {isBn ? plan.name.bn : plan.name.en}
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug sm:leading-tight">
                {benefitText}
              </p>
            </div>
          </div>
          
          <div className="flex items-baseline gap-1 sm:gap-2 mb-6">
            <span className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold tracking-tight">
              {plan.currency === 'BDT' ? '৳' : plan.currency}{plan.price.toLocaleString('en-IN')}
            </span>
            <span className="text-sm sm:text-base text-slate-500 font-medium">
              {isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}
            </span>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/10 text-sm sm:text-base font-medium">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>{isBn ? 'সাবটোটাল' : 'Subtotal'}</span>
              <span>৳{plan.price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>{isBn ? 'ভ্যাট / ট্যাক্স' : 'VAT / Tax'}</span>
              <span>৳0</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base sm:text-lg pt-1">
              <span>{isBn ? 'সর্বমোট' : 'Total'}</span>
              <span>৳{plan.price.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* SECTION: PAY WITH */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 sm:mb-4 px-1">
            {isBn ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Select Payment Method'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {PAYMENT_METHODS.map(method => {
              const isSelected = selectedMethod === method.id;
              return (
                <div 
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`group relative flex items-center justify-between p-4 sm:p-5 lg:p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 bg-white dark:bg-[#13111C] overflow-hidden ${
                    isSelected 
                      ? `${method.borderColor} ${method.bgTint} shadow-lg ring-4 ${method.ringColor}` 
                      : `border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 ${method.hoverColor}`
                  }`}
                >
                  {/* Animated background effect on selection */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  )}
                  
                  <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                    {/* Method Logo */}
                    <div className="flex-shrink-0">
                      {method.logo}
                    </div>
                    
                    {/* Method Name */}
                    <div className="flex flex-col">
                      <span className={`font-bold text-base sm:text-lg transition-colors ${
                        isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {isBn ? method.labelBn : method.label}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {isBn ? 'মোবাইল ব্যাংকিং' : 'Mobile Banking'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                    {/* Amount */}
                    <span className={`font-bold text-base sm:text-lg transition-colors ${
                      isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      ৳{plan.price.toLocaleString('en-IN')}
                    </span>
                    
                    {/* Radio Button */}
                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      isSelected 
                        ? `${method.borderColor} scale-110` 
                        : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      <div className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${method.color} transition-transform duration-300 ${
                        isSelected ? 'scale-100' : 'scale-0'
                      }`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Info message */}
          <div className="mt-4 flex items-start gap-2 p-3 sm:p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30">
            <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
              {isBn 
                ? 'আপনার মোবাইল ওয়ালেট থেকে নিরাপদভাবে পেমেন্ট করুন। লেনদেন সম্পন্ন হতে কয়েক সেকেন্ড সময় লাগতে পারে।'
                : 'Pay securely from your mobile wallet. Transaction may take a few seconds to complete.'
              }
            </p>
          </div>
        </div>

        {/* SECTION: AUTO RENEWAL */}
        <div className="bg-white dark:bg-[#13111C] rounded-2xl p-4 sm:p-5 shadow-lg dark:shadow-2xl border border-slate-200 dark:border-white/10 flex items-center justify-between mb-8 sm:mb-10 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors ${
              autoRenew ? themeClasses.badgeBg : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              <ShieldCheck size={20} className={autoRenew ? themeClasses.badgeText : 'text-slate-400'} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                {isBn ? 'স্বয়ংক্রিয় নবায়ন' : 'Auto-renewal'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isBn ? 'প্রতি মাসে নিজে থেকে চালু হবে' : 'Renew automatically each cycle'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setAutoRenew(!autoRenew)}
            className={`w-14 h-7 sm:w-16 sm:h-8 rounded-full p-1 transition-all duration-300 flex relative ${
              autoRenew ? themeClasses.toggleBg : 'bg-slate-300 dark:bg-slate-700'
            } hover:scale-105 active:scale-95`}
          >
            <div className={`w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${
              autoRenew ? 'translate-x-7 sm:translate-x-8' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* SECTION: ACTION BUTTON */}
        <div className="mt-auto pb-6 sm:pb-8">
          <button
            onClick={() => setActiveGateway(selectedMethod)}
            className={`w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg text-white transition-all shadow-lg hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 ${themeClasses.buttonBg} ${themeClasses.shadow} flex items-center justify-center gap-2 sm:gap-3 group`}
          >
            <Lock size={18} className="group-hover:rotate-12 transition-transform" />
            <span>{isBn ? 'নিরাপদ পেমেন্ট করুন' : 'Proceed to Pay'}</span>
            <span className="text-xl sm:text-2xl group-hover:translate-x-1 transition-transform">&rarr;</span>
          </button>
          
          <div className="mt-4 sm:mt-5 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500">
            <ShieldCheck size={16} className="text-emerald-500" />
            {isBn ? '২৫৬-বিট SSL এনক্রিপশন দ্বারা সুরক্ষিত' : 'Protected by 256-bit SSL Encryption'}
          </div>
          
          {/* Trust badges */}
          <div className="mt-4 flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {isBn ? 'নিরাপদ' : 'Secure'}
            </div>
            <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {isBn ? 'দ্রুত' : 'Fast'}
            </div>
            <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              {isBn ? 'সহজ' : 'Easy'}
            </div>
          </div>
        </div>

      </div>

      {/* Render Active Gateway Overlay */}
      {activeGateway === 'bkash' && (
        <BkashGateway amount={plan.price} onPay={handlePaySuccess} onClose={() => setActiveGateway(null)} />
      )}
      {activeGateway === 'nagad' && (
        <NagadGateway amount={plan.price} onPay={handlePaySuccess} onClose={() => setActiveGateway(null)} />
      )}
    </div>
  );
};

export default CheckoutPage;

