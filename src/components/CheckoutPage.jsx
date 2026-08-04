import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Smartphone, CreditCard, Info } from 'lucide-react';
import { BkashGateway, NagadGateway, CardGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    color: 'bg-[#e2136e]',
    borderHover: 'hover:border-[#e2136e]',
    icon: <Smartphone size={24} strokeWidth={1.5} className="text-[#e2136e]" />
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    color: 'bg-[#f7941d]',
    borderHover: 'hover:border-[#f7941d]',
    icon: <Smartphone size={24} strokeWidth={1.5} className="text-[#f7941d]" />
  },
  { 
    id: 'rocket', 
    label: 'Rocket', 
    labelBn: 'রকেট',
    color: 'bg-[#8c1586]',
    borderHover: 'hover:border-[#8c1586]',
    icon: <Smartphone size={24} strokeWidth={1.5} className="text-[#8c1586]" />
  },
  { 
    id: 'card',   
    label: 'Card/Online Banking', 
    labelBn: 'কার্ড/অনলাইন ব্যাংকিং',
    color: 'bg-blue-600',
    borderHover: 'hover:border-blue-600',
    icon: <CreditCard size={24} strokeWidth={1.5} className="text-blue-600" />
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

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans relative overflow-hidden text-gray-900 pb-24">
      {/* Background decorations */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Toast Notification */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`backdrop-blur-2xl px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-white/20 flex items-center gap-3 ${toast?.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-gray-900/90 text-white'}`}>
          <Check size={18} className={toast?.type === 'error' ? 'text-white' : 'text-green-400'} />
          <span className="text-sm font-semibold tracking-wide">{toast?.msg}</span>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 pt-6 md:pt-10">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#ba0036] transition-colors mb-6 group"
        >
          <div className="bg-white p-2 rounded-full shadow-sm group-hover:shadow-md transition-all border border-gray-100">
            <ArrowLeft size={16} />
          </div>
          {isBn ? 'ফিরে যান' : 'Go Back'}
        </button>

        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          
          {/* LEFT: Order Summary Panel */}
          <div className="w-full lg:w-1/2 flex flex-col gap-5">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-6 md:p-8 border border-white flex flex-col h-full relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-[0.03] scale-150 rotate-12">
                <ShieldCheck size={300} />
              </div>

              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-8">
                {isBn ? 'অর্ডার সামারি' : 'Order Summary'}
              </h2>
              
              <div className="flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 mb-2">
                      {isBn ? plan.name.bn : plan.name.en}
                    </h3>
                    <span className="bg-[#ba0036]/10 text-[#ba0036] text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      {isBn ? plan.intervalLabel.bn : plan.intervalLabel.en}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-gray-900 tracking-tighter">
                      {plan.currency === 'BDT' ? '৳' : plan.currency}{plan.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mt-8">
                  <div className="flex justify-between text-sm font-bold border-b border-gray-100 pb-4">
                    <span className="text-gray-500">{isBn ? 'সাবটোটাল' : 'Subtotal'}</span>
                    <span className="text-gray-900">৳{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-b border-gray-100 pb-4">
                    <span className="text-gray-500">{isBn ? 'ভ্যাট / ট্যাক্স' : 'VAT / Tax'}</span>
                    <span className="text-gray-900">৳0</span>
                  </div>
                  <div className="flex justify-between text-lg font-black pt-2">
                    <span className="text-gray-900">{isBn ? 'সর্বমোট' : 'Total'}</span>
                    <span className="text-[#ba0036]">৳{plan.price.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 mt-8 relative z-10">
                <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-blue-800/80 leading-relaxed">
                  {isBn 
                    ? 'আপনার সাবস্ক্রিপশন পরবর্তী চক্রে স্বয়ংক্রিয়ভাবে পুনর্নবীকরণ হবে (যদি অটো-রিনিউ চালু থাকে)। আপনি যেকোনো সময় সেটিংসে গিয়ে এটি বন্ধ করতে পারেন।'
                    : 'Your subscription will auto-renew at the next cycle if auto-renewal is enabled. You can manage or cancel this anytime in settings.'}
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Payment Methods */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 p-6 md:p-8 border border-white h-full">
              
              <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-8">
                {isBn ? 'পেমেন্ট মেথড নির্বাচন করুন' : 'Choose Payment Method'}
              </h2>

              <div className="flex-1 space-y-4">
                {PAYMENT_METHODS.map(method => (
                  <div 
                    key={method.id}
                    className={`bg-white border-2 border-gray-100 rounded-2xl overflow-hidden transition-all duration-300 ${method.borderHover} hover:shadow-md cursor-pointer`}
                  >
                    <div 
                      className="p-5 flex items-center justify-between"
                      onClick={() => setActiveGateway(method.id)}
                    >
                      <div>
                        <h4 className="text-lg font-black text-gray-900">{method.label}</h4>
                        <p className="text-sm font-bold text-gray-500 mt-0.5">BDT {plan.price.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {method.icon}
                      </div>
                    </div>
                    
                    {/* Auto Renewal Toggle internal row */}
                    <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isBn ? 'অটো রিনিউয়াল' : 'Auto Renewal'}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setAutoRenew(!autoRenew); }}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex ${autoRenew ? method.color : 'bg-gray-300'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoRenew ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-6 border-t border-gray-100">
                <ShieldCheck size={14} className="text-emerald-500" />
                {isBn ? 'নিরাপদ পেমেন্ট গেটওয়ে' : 'Secure Payment Gateways'}
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
        // Reusing Nagad style gateway structure but adapting colors in MerchantGateways for a real impl.
        // I will use Bkash style as fallback or a Card Gateway for Rocket if missing.
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
