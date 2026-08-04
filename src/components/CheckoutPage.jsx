import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Info, Lock } from 'lucide-react';
import { BkashGateway, NagadGateway, CardGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    color: 'bg-[#e2136e]',
    borderColor: 'border-[#e2136e]',
    bgTint: 'bg-[#e2136e]/5',
    logo: 'bKash'
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    color: 'bg-[#f7941d]',
    borderColor: 'border-[#f7941d]',
    bgTint: 'bg-[#f7941d]/5',
    logo: 'Nagad'
  },
  { 
    id: 'rocket', 
    label: 'Rocket', 
    labelBn: 'রকেট',
    color: 'bg-[#8c1586]',
    borderColor: 'border-[#8c1586]',
    bgTint: 'bg-[#8c1586]/5',
    logo: 'Rocket'
  },
  { 
    id: 'card',   
    label: 'Card / Online', 
    labelBn: 'কার্ড / অনলাইন',
    color: 'bg-blue-600',
    borderColor: 'border-blue-600',
    bgTint: 'bg-blue-600/5',
    logo: 'Cards'
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
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0A0A0F] font-sans text-slate-900 dark:text-white pb-12 transition-colors duration-300 flex justify-center">
      
      {/* Toast Notification */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border flex items-center gap-3 ${toast?.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-slate-900/90 dark:bg-white/10 text-white border-white/20'}`}>
          <Check size={18} className={toast?.type === 'error' ? 'text-white' : 'text-emerald-400'} />
          <span className="text-sm font-semibold tracking-wide">{toast?.msg}</span>
        </div>
      </div>

      <div className="w-full max-w-[480px] px-4 pt-6 md:pt-10 flex flex-col relative z-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={goBack}
            className="w-10 h-10 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-bold text-xl">{isBn ? 'চেকআউট' : 'Checkout'}</h1>
        </div>

        {/* SECTION: WHAT YOU'RE BUYING */}
        <div className="bg-white dark:bg-[#13111C] rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-white/10 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${themeClasses.badgeBg} ${themeClasses.badgeText} mb-2`}>
                {isBn ? plan.name.bn : plan.name.en}
              </span>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {benefitText}
              </p>
            </div>
          </div>
          
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-display font-extrabold tracking-tight">
              {plan.currency === 'BDT' ? '৳' : plan.currency}{plan.price.toLocaleString('en-IN')}
            </span>
            <span className="text-slate-500 font-medium">
              {isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}
            </span>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/10 text-sm font-medium">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>{isBn ? 'সাবটোটাল' : 'Subtotal'}</span>
              <span>৳{plan.price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>{isBn ? 'ভ্যাট / ট্যাক্স' : 'VAT / Tax'}</span>
              <span>৳0</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 dark:text-white text-base pt-1">
              <span>{isBn ? 'সর্বমোট' : 'Total'}</span>
              <span>৳{plan.price.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* SECTION: PAY WITH */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">
            {isBn ? 'পেমেন্ট মাধ্যম' : 'Pay With'}
          </h2>
          <div className="space-y-3">
            {PAYMENT_METHODS.map(method => {
              const isSelected = selectedMethod === method.id;
              return (
                <div 
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-300 border-2 bg-white dark:bg-white/5 ${isSelected ? `${method.borderColor} ${method.bgTint} shadow-sm` : 'border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Method Logo / Text */}
                    <div className={`font-black text-lg italic tracking-tighter w-16 ${isSelected ? method.color.replace('bg-', 'text-') : 'text-slate-400 dark:text-slate-500'}`}>
                      {method.logo}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-slate-900 dark:text-white">৳{plan.price}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? method.borderColor : 'border-slate-300 dark:border-slate-600'}`}>
                      <div className={`w-3 h-3 rounded-full ${method.color} transition-transform duration-300 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION: AUTO RENEWAL */}
        <div className="bg-white dark:bg-[#13111C] rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-white/10 flex items-center justify-between mb-8">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {isBn ? 'প্রতি মাসে স্বয়ংক্রিয়ভাবে নবায়ন হবে' : 'Auto-renew every cycle'}
          </span>
          <button 
            onClick={() => setAutoRenew(!autoRenew)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex ${autoRenew ? themeClasses.toggleBg : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoRenew ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* SECTION: ACTION BUTTON */}
        <div className="mt-auto pb-6">
          <button
            onClick={() => setActiveGateway(selectedMethod)}
            className={`w-full py-4 rounded-xl font-bold text-base text-white transition-all shadow-lg hover:-translate-y-0.5 hover:shadow-xl ${themeClasses.buttonBg} ${themeClasses.shadow} flex items-center justify-center gap-2`}
          >
            {isBn ? 'এখনই পেমেন্ট করুন' : 'Pay Now'} &rarr;
          </button>
          
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
            <Lock size={14} className="text-emerald-500" />
            {isBn ? 'নিরাপদ এনক্রিপ্টেড পেমেন্ট' : 'Secure Encrypted Payment'}
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
      {activeGateway === 'rocket' && (
        <BkashGateway amount={plan.price} onPay={handlePaySuccess} onClose={() => setActiveGateway(null)} />
      )}
      {activeGateway === 'card' && (
        <CardGateway amount={plan.price} onPay={handlePaySuccess} onClose={() => setActiveGateway(null)} />
      )}
    </div>
  );
};

export default CheckoutPage;

