import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Info } from 'lucide-react';
import { BkashGateway, NagadGateway, CardGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    color: 'bg-[#e2136e]',
    borderHover: 'hover:border-[#e2136e]',
    textActive: 'text-[#e2136e]',
    logo: 'bKash' // Handled via styling in the card for simplicity, or we could use SVG
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    color: 'bg-[#f7941d]',
    borderHover: 'hover:border-[#f7941d]',
    textActive: 'text-[#f7941d]',
    logo: 'Nagad'
  },
  { 
    id: 'rocket', 
    label: 'Rocket', 
    labelBn: 'রকেট',
    color: 'bg-[#8c1586]',
    borderHover: 'hover:border-[#8c1586]',
    textActive: 'text-[#8c1586]',
    logo: 'Rocket'
  },
  { 
    id: 'card',   
    label: 'Card/Online Banking', 
    labelBn: 'কার্ড/অনলাইন ব্যাংকিং',
    color: 'bg-blue-600',
    borderHover: 'hover:border-blue-600',
    textActive: 'text-blue-600',
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
  const accentColor = isPro ? 'amber' : 'violet';
  
  // Tailwind dynamic classes (must map explicitly to avoid purging)
  const themeClasses = {
    text: isPro ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400',
    bg: isPro ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700',
    bgLight: isPro ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-violet-50 dark:bg-violet-500/10',
    border: isPro ? 'border-amber-200 dark:border-amber-500/30' : 'border-violet-200 dark:border-violet-500/30',
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] dark:bg-[#0A0A0F] font-sans relative overflow-hidden text-slate-900 dark:text-white pb-24 transition-colors duration-300">
      
      {/* Background decorations */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-violet-600/10 dark:bg-violet-600/15 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Toast Notification */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border flex items-center gap-3 ${toast?.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-slate-900/90 dark:bg-white/10 text-white border-white/20'}`}>
          <Check size={18} className={toast?.type === 'error' ? 'text-white' : 'text-emerald-400'} />
          <span className="text-sm font-semibold tracking-wide">{toast?.msg}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-12">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8 group"
        >
          <div className="bg-white dark:bg-white/10 dark:border-white/10 p-2 rounded-full shadow-sm group-hover:shadow-md transition-all border border-slate-200">
            <ArrowLeft size={16} />
          </div>
          {isBn ? 'ফিরে যান' : 'Go Back'}
        </button>

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          
          {/* LEFT: Order Summary Panel */}
          <div className="w-full lg:w-5/12 flex flex-col gap-5">
            <div className={`bg-white dark:bg-[#13111C] rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-6 md:p-8 border ${themeClasses.border} flex flex-col h-full relative overflow-hidden backdrop-blur-xl`}>
              <div className={`absolute -right-10 -bottom-10 opacity-[0.03] dark:opacity-5 scale-150 rotate-12 ${themeClasses.text}`}>
                <ShieldCheck size={300} />
              </div>

              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">
                {isBn ? 'অর্ডার সামারি' : 'Order Summary'}
              </h2>
              
              <div className="flex-1">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-display font-extrabold text-slate-900 dark:text-white mb-2">
                      {isBn ? plan.name.bn : plan.name.en}
                    </h3>
                    <span className={`${themeClasses.bgLight} ${themeClasses.text} text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full inline-block`}>
                      {isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-display font-extrabold text-slate-900 dark:text-white tracking-tighter">
                      {plan.currency === 'BDT' ? '৳' : plan.currency}{plan.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mt-8 bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/10">
                  <div className="flex justify-between text-sm font-bold border-b border-slate-200 dark:border-white/10 pb-4">
                    <span className="text-slate-500 dark:text-slate-400">{isBn ? 'সাবটোটাল' : 'Subtotal'}</span>
                    <span className="text-slate-900 dark:text-white">৳{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-b border-slate-200 dark:border-white/10 pb-4">
                    <span className="text-slate-500 dark:text-slate-400">{isBn ? 'ভ্যাট / ট্যাক্স' : 'VAT / Tax'}</span>
                    <span className="text-slate-900 dark:text-white">৳0</span>
                  </div>
                  <div className="flex justify-between text-xl font-display font-extrabold pt-2">
                    <span className="text-slate-900 dark:text-white">{isBn ? 'সর্বমোট' : 'Total'}</span>
                    <span className={themeClasses.text}>৳{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-500/10 rounded-2xl border border-blue-100/50 dark:border-blue-500/20 mt-8 relative z-10">
                <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-blue-800/80 dark:text-blue-300 leading-relaxed">
                  {isBn 
                    ? 'আপনার সাবস্ক্রিপশন পরবর্তী চক্রে স্বয়ংক্রিয়ভাবে পুনর্নবীকরণ হবে (যদি অটো-রিনিউ চালু থাকে)। আপনি যেকোনো সময় সেটিংসে গিয়ে এটি বন্ধ করতে পারেন।'
                    : 'Your subscription will auto-renew at the next cycle if auto-renewal is enabled. You can manage or cancel this anytime in settings.'}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Payment Methods */}
          <div className="w-full lg:w-7/12">
            <div className="bg-white dark:bg-white/5 rounded-3xl shadow-2xl shadow-slate-200/50 dark:shadow-none p-6 md:p-8 border border-slate-200 dark:border-white/10 h-full backdrop-blur-xl flex flex-col">
              
              <h2 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight mb-8">
                {isBn ? 'পেমেন্ট মেথড নির্বাচন করুন' : 'Select Payment Method'}
              </h2>

              <div className="flex-1 space-y-4">
                {PAYMENT_METHODS.map(method => {
                  const isSelected = selectedMethod === method.id;
                  return (
                    <div 
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`bg-white dark:bg-white/5 border-2 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${isSelected ? 'border-slate-800 dark:border-white shadow-md' : 'border-slate-100 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/30'}`}
                    >
                      <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-slate-600'}`}>
                            <div className={`w-2.5 h-2.5 rounded-full bg-slate-800 dark:bg-white transition-transform duration-300 ${isSelected ? 'scale-100' : 'scale-0'}`} />
                          </div>
                          <div>
                            <h4 className={`text-lg font-bold ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{method.label}</h4>
                          </div>
                        </div>
                        <div className={`font-black text-xl italic tracking-tighter ${method.textActive}`}>
                          {method.logo}
                        </div>
                      </div>
                      
                      {/* Auto Renewal Toggle */}
                      {isSelected && (
                        <div className="bg-slate-50 dark:bg-white/5 px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between animate-tp-fade-in">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{isBn ? 'অটো রিনিউয়াল' : 'Auto Renewal'}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAutoRenew(!autoRenew); }}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex ${autoRenew ? method.color : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoRenew ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/10">
                <button
                  onClick={() => setActiveGateway(selectedMethod)}
                  className={`w-full py-5 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all text-white shadow-xl hover:-translate-y-1 hover:shadow-2xl ${themeClasses.bg} ${isPro ? 'shadow-amber-500/30 hover:shadow-amber-500/40' : 'shadow-violet-500/30 hover:shadow-violet-500/40'}`}
                >
                  {isBn ? 'পেমেন্ট নিশ্চিত করুন' : 'Confirm & Pay'}
                </button>
                <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  {isBn ? 'নিরাপদ পেমেন্ট গেটওয়ে' : 'Secure Encrypted Gateway'}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Render Active Gateway Overlay */}
      {activeGateway === 'bkash' && (
        <BkashGateway 
          amount={plan.price} 
          onPay={handlePaySuccess} 
          onClose={() => setActiveGateway(null)} 
        />
      )}
      {activeGateway === 'nagad' && (
        <NagadGateway 
          amount={plan.price} 
          onPay={handlePaySuccess} 
          onClose={() => setActiveGateway(null)} 
        />
      )}
      {activeGateway === 'rocket' && (
        <BkashGateway 
          amount={plan.price} 
          onPay={handlePaySuccess} 
          onClose={() => setActiveGateway(null)} 
        />
      )}
      {activeGateway === 'card' && (
        <CardGateway 
          amount={plan.price} 
          onPay={handlePaySuccess} 
          onClose={() => setActiveGateway(null)} 
        />
      )}
    </div>
  );
};

export default CheckoutPage;
