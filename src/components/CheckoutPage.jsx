import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Info, Lock, CreditCard, Zap, CheckCircle2, Shield } from 'lucide-react';
import { BkashGateway, NagadGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    color: '#e2136e',
    gradientFrom: 'from-[#e2136e]',
    gradientTo: 'to-[#c01159]',
    borderColor: 'border-[#e2136e]',
    bgColor: 'bg-[#e2136e]',
    bgTint: 'bg-[#e2136e]/10',
    hoverBg: 'hover:bg-[#e2136e]/5',
    textColor: 'text-[#e2136e]',
    description: 'Mobile Wallet',
    descriptionBn: 'মোবাইল ওয়ালেট',
    logoPath: '/payment svg/bkash.svg',
    icon: (
      <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
        <img 
          src="/payment svg/bkash.svg" 
          alt="bKash" 
          className="w-[75%] h-[75%] object-contain" 
          onError={(e) => { 
            e.target.style.display = 'none'; 
            e.target.parentElement.innerHTML = '<span class="text-white font-black text-2xl tracking-tight">bKash</span>'; 
          }} 
        />
      </div>
    )
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    color: '#f7941d',
    gradientFrom: 'from-[#f7941d]',
    gradientTo: 'to-[#e67e0a]',
    borderColor: 'border-[#f7941d]',
    bgColor: 'bg-[#f7941d]',
    bgTint: 'bg-[#f7941d]/10',
    hoverBg: 'hover:bg-[#f7941d]/5',
    textColor: 'text-[#f7941d]',
    description: 'Mobile Wallet',
    descriptionBn: 'মোবাইল ওয়ালেট',
    logoPath: '/payment svg/nagad.png',
    icon: (
      <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
        <img 
          src="/payment svg/nagad.png" 
          alt="Nagad" 
          className="w-[70%] h-[70%] object-contain" 
          onError={(e) => { 
            e.target.style.display = 'none'; 
            e.target.parentElement.innerHTML = '<span class="text-white font-black text-2xl md:text-3xl tracking-wider">নগদ</span>'; 
          }} 
        />
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
  const selectedPaymentMethod = PAYMENT_METHODS.find(m => m.id === selectedMethod);
  
  // Theme variables
  const themeClasses = {
    badgeText: isPro ? 'text-amber-700 dark:text-amber-400' : 'text-violet-700 dark:text-violet-400',
    badgeBg: isPro ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-violet-100 dark:bg-violet-500/20',
    buttonBg: isPro ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700' : 'bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800',
    toggleBg: isPro ? 'bg-amber-500' : 'bg-violet-600',
    accentColor: isPro ? 'text-amber-600' : 'text-violet-600',
  };

  const benefitText = isPro 
    ? (isBn ? 'সীমাহীন বাড়ি, AI সহায়তা, সব ফিচার আনলক' : 'Unlimited listings, AI insights, all features unlocked')
    : (isBn ? '৩টি বাড়ি লিস্ট করুন, ভাড়া ট্র্যাক করুন' : 'List up to 3 properties, track rent');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-[#0A0A0F] dark:via-[#13111C] dark:to-[#1A1625] transition-colors duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-tp-modal-in">
          <div className={`backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            toast.type === 'error' 
              ? 'bg-red-500/95 text-white border-red-400' 
              : 'bg-emerald-500/95 text-white border-emerald-400'
          }`}>
            <Check size={20} strokeWidth={3} />
            <span className="text-sm font-bold">{toast.msg}</span>
          </div>
        </div>
      )}
        
      {/* Header */}
      <div className="w-full border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#13111C]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            className="w-10 h-10 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {isBn ? 'চেকআউট' : 'Checkout'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isBn ? 'আপনার সাবস্ক্রিপশন সম্পূর্ণ করুন' : 'Complete your subscription'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Desktop: Side by Side, Mobile/Tablet: Responsive Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          
          {/* LEFT COLUMN - Order Summary */}
          <div className="space-y-6">
            {/* Plan Details Card */}
            <div className="bg-white dark:bg-[#13111C] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-white/10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className={`inline-block px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${themeClasses.badgeBg} ${themeClasses.badgeText} mb-3`}>
                    {isBn ? plan.name.bn : plan.name.en}
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
                    {benefitText}
                  </p>
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-white/5 dark:to-white/10 rounded-2xl p-6 mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight">
                    ৳{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-lg text-slate-500 dark:text-slate-400 font-semibold">
                    {isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-semibold">
                    {isBn ? 'সক্রিয় হওয়ার পর' : 'Active immediately'}
                  </span>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-4 pb-6 border-b border-slate-200 dark:border-white/10">
                <div className="flex justify-between text-base">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{isBn ? 'সাবটোটাল' : 'Subtotal'}</span>
                  <span className="text-slate-900 dark:text-white font-bold">৳{plan.price.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{isBn ? 'ভ্যাট / ট্যাক্স' : 'VAT / Tax'}</span>
                  <span className="text-slate-900 dark:text-white font-bold">৳0</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{isBn ? 'প্রসেসিং ফি' : 'Processing Fee'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{isBn ? 'বিনামূল্যে' : 'Free'}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-6">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{isBn ? 'সর্বমোট' : 'Total Due'}</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white">৳{plan.price.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Features List */}
            <div className="bg-white dark:bg-[#13111C] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap size={20} className={themeClasses.accentColor} />
                {isBn ? 'এই প্ল্যানে যা পাবেন' : "What's Included"}
              </h3>
              <ul className="space-y-3">
                {['Unlimited property listings', 'AI-powered insights', 'Priority support', 'Advanced analytics', 'Custom branding'].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full ${themeClasses.badgeBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Check size={12} className={themeClasses.badgeText} strokeWidth={3} />
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN - Payment Methods */}
          <div className="space-y-6">
            {/* Payment Selection Card */}
            <div className="bg-white dark:bg-[#13111C] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <CreditCard size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isBn ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isBn ? 'আপনার পছন্দের মাধ্যম নির্বাচন করুন' : 'Choose your preferred method'}</p>
                </div>
              </div>

              {/* Payment Method Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {PAYMENT_METHODS.map(method => {
                  const isSelected = selectedMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`relative group p-6 rounded-2xl border-2 transition-all duration-300 ${
                        isSelected
                          ? `${method.borderColor} ${method.bgTint} shadow-lg scale-105`
                          : `border-slate-200 dark:border-white/10 ${method.hoverBg} hover:border-slate-300 dark:hover:border-white/20`
                      }`}
                    >
                      {isSelected && (
                        <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full ${method.bgColor} flex items-center justify-center shadow-md`}>
                          <Check size={16} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className="flex flex-col items-center text-center gap-4">
                        {method.icon}
                        <div>
                          <p className={`font-bold text-lg ${isSelected ? method.textColor : 'text-slate-900 dark:text-white'}`}>
                            {isBn ? method.labelBn : method.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {isBn ? method.descriptionBn : method.description}
                          </p>
                        </div>
                      </div>
                      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${method.bgTint}`} />
                    </button>
                  );
                })}
              </div>

              {/* Selected Method Info */}
              <div className={`p-4 rounded-xl ${selectedPaymentMethod.bgTint} border ${selectedPaymentMethod.borderColor} mb-6`}>
                <div className="flex items-center gap-3">
                  <Info size={20} className={selectedPaymentMethod.textColor} />
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {isBn 
                      ? `${selectedPaymentMethod.labelBn} দিয়ে পেমেন্ট করতে আপনার মোবাইল নম্বর প্রয়োজন হবে`
                      : `You'll need your ${selectedPaymentMethod.label} mobile number to complete payment`
                    }
                  </p>
                </div>
              </div>

              {/* Auto-Renewal Toggle */}
              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${autoRenew ? themeClasses.badgeBg : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <ShieldCheck size={20} className={autoRenew ? themeClasses.badgeText : 'text-slate-400'} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{isBn ? 'স্বয়ংক্রিয় নবায়ন' : 'Auto-renewal'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{isBn ? 'প্রতি চক্রে স্বয়ংক্রিয়ভাবে নবায়ন' : 'Renew automatically each cycle'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoRenew(!autoRenew)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${autoRenew ? themeClasses.toggleBg : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${autoRenew ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={() => setActiveGateway(selectedMethod)}
                className={`w-full py-5 rounded-2xl font-bold text-lg text-white shadow-lg transition-all hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 ${themeClasses.buttonBg} flex items-center justify-center gap-3 group`}
              >
                <Lock size={20} className="group-hover:rotate-12 transition-transform" />
                <span>{isBn ? 'নিরাপদ পেমেন্ট করুন' : 'Proceed to Secure Payment'}</span>
                <span className="text-2xl group-hover:translate-x-2 transition-transform">→</span>
              </button>

              {/* Security Badges */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{isBn ? 'SSL সুরক্ষিত' : 'SSL Secured'}</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{isBn ? 'এনক্রিপ্টেড' : 'Encrypted'}</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{isBn ? 'তাৎক্ষণিক' : 'Instant'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust Indicator */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/30">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-1">{isBn ? '১০০% নিরাপদ পেমেন্ট' : '100% Secure Payment'}</h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                    {isBn 
                      ? 'আপনার পেমেন্ট তথ্য ব্যাংক-স্তরের এনক্রিপশন দ্বারা সুরক্ষিত। আমরা কখনই আপনার পেমেন্ট তথ্য সংরক্ষণ করি না।'
                      : 'Your payment information is protected by bank-level encryption. We never store your payment details.'
                    }
                  </p>
                </div>
              </div>
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

