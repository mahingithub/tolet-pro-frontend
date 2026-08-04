import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, Check, X } from 'lucide-react';
import { BkashGateway, NagadGateway } from './payment/MerchantGateways';

const PAYMENT_METHODS = [
  { 
    id: 'bkash',  
    label: 'bKash', 
    labelBn: 'বিকাশ',
    logo: (
      <img 
        src="/payment svg/bkash.svg" 
        alt="bKash" 
        className="h-7 object-contain" 
        onError={(e) => { 
          e.target.style.display = 'none'; 
          e.target.parentElement.innerHTML = '<span class="text-pink-500 font-bold px-2">bKash</span>'; 
        }} 
      />
    )
  },
  { 
    id: 'nagad',  
    label: 'Nagad',  
    labelBn: 'নগদ',
    logo: (
      <img 
        src="/payment svg/nagad.png" 
        alt="Nagad" 
        className="h-7 object-contain" 
        onError={(e) => { 
          e.target.style.display = 'none'; 
          e.target.parentElement.innerHTML = '<span class="text-orange-500 font-bold px-2">Nagad</span>'; 
        }} 
      />
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
    <div className="min-h-screen bg-[#0F0F0F] text-white flex flex-col font-sans relative">
      
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

      {/* Top Header */}
      <div className="p-4 flex items-center">
        <button
          type="button"
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col">
        
        {/* Choose a plan */}
        <div className="px-6 mb-8 mt-4">
          <h2 className="text-center text-xl font-semibold mb-5 text-[#A0A0A5]">
            {isBn ? 'প্ল্যান নির্বাচন' : 'Choose a plan'}
          </h2>
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-xl p-4 md:p-5 flex items-center justify-between">
            <span className="text-slate-300 font-medium text-sm md:text-base">
              {isBn ? plan.name.bn : plan.name.en} 
              <span className="text-slate-500 ml-2">({plan.tier === 'pro' ? 'Pro' : 'Plus'})</span>
            </span>
            <span className="text-slate-300 font-bold text-sm md:text-base tracking-wide">
              BDT {plan.price.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Payment Bottom Sheet */}
        <div className="bg-[#18181A] rounded-t-3xl sm:rounded-3xl flex-1 flex flex-col p-6 border-t sm:border border-[#2C2C2E]">
          
          <div className="w-12 h-1 bg-[#3A3A3D] rounded-full mx-auto mb-6"></div>
          
          <h2 className="text-center text-xl font-bold mb-8 text-white tracking-wide">
            {isBn ? 'পেমেন্ট মাধ্যম নির্বাচন করুন' : 'Choose a Payment Method'}
          </h2>
          
          <div className="space-y-4">
            {PAYMENT_METHODS.map(method => (
              <button 
                key={method.id}
                onClick={() => setActiveGateway(method.id)}
                className="w-full bg-transparent hover:bg-[#252528] border border-[#3C3C3E] rounded-xl p-4 flex items-center justify-between transition-colors text-left group"
              >
                <div>
                  <div className="text-white font-bold text-lg md:text-xl tracking-wide group-hover:text-white transition-colors">{method.label}</div>
                  <div className="text-[#A0A0A5] text-sm md:text-base font-semibold mt-1">BDT {plan.price.toLocaleString('en-IN')}</div>
                </div>
                
                {/* Logo wrapper */}
                <div className="bg-transparent rounded px-2 py-1 flex items-center justify-center">
                   {method.logo}
                </div>
              </button>
            ))}
          </div>

          {/* Footer Terms */}
          <div className="mt-auto pt-8 pb-4 text-center">
            <p className="text-[13px] text-[#A0A0A5]">
              {isBn ? 'এগিয়ে যাওয়ার মাধ্যমে আপনি আমাদের ' : 'By continuing you are agreeing with our '}
              <Link to="/terms" className="underline underline-offset-2 hover:text-white transition-colors">Terms & Conditions</Link>
              {isBn ? ' এর সাথে সম্মত হচ্ছেন' : ''}
            </p>
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
