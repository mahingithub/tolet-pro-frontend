import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import { useLanguage } from '../context/LanguageContext';
import { subscriptionService, PLANS } from '../services/subscriptionService';
import { ArrowLeft, ShieldCheck, Check, Zap } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'bkash',  label: 'bKash',  color: 'bg-[#e2136e] text-white', hover: 'hover:opacity-90 hover:shadow-lg' },
  { id: 'nagad',  label: 'Nagad',  color: 'bg-[#f7941d] text-white', hover: 'hover:opacity-90 hover:shadow-lg' },
  { id: 'rocket', label: 'Rocket', color: 'bg-[#8c1586] text-white', hover: 'hover:opacity-90 hover:shadow-lg' },
  { id: 'card',   label: 'Credit/Debit Card', color: 'bg-blue-600 text-white', hover: 'hover:opacity-90 hover:shadow-lg' }
];

const CheckoutPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/subscription');
  const { language = 'English' } = useLanguage() || {};
  const isBn = language === 'বাংলা';

  const [toast, setToast] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const processSubscription = async (methodId) => {
    setIsProcessing(true);
    try {
      await subscriptionService.subscribe(planId);
      // Show success and redirect
      showToast(isBn ? 'পেমেন্ট সফল হয়েছে!' : 'Payment Successful!');
      setTimeout(() => navigate('/host-dashboard'), 1500);
    } catch (error) {
      showToast(error.message || 'Payment failed', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eaeff5] font-sans relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-gradient-to-br from-[#ba0036]/10 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-gradient-to-tl from-blue-600/5 to-transparent rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Toast */}
      <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${toast ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'}`}>
        <div className={`backdrop-blur-2xl px-5 py-3 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-white/10 flex items-center gap-3 ${toast?.type === 'error' ? 'bg-[#ba0036]/90 text-white' : 'bg-gray-900/90 text-white'}`}>
          <Check size={14} className={toast?.type === 'error' ? 'text-white' : 'text-green-400'} />
          <span className="text-xs font-bold tracking-wide">{toast?.msg}</span>
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#ba0036] transition-colors"
        >
          <ArrowLeft size={14} /> {isBn ? 'ফিরে যান' : 'Go Back'}
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Order Summary */}
          <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {isBn ? 'চেকআউট' : 'Checkout'}
            </h1>
            <div className="mt-4 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {isBn ? 'নির্বাচিত প্ল্যান' : 'Selected Plan'}
                </p>
                <p className="text-lg font-black text-[#ba0036] mt-1">
                  {isBn ? plan.name.bn : plan.name.en} ({isBn ? plan.intervalLabel.bn : plan.intervalLabel.en})
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-gray-900 tracking-tighter">
                  {plan.currency === 'BDT' ? '৳' : plan.currency} {plan.price.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="p-6 md:p-8">
            <p className="text-sm font-bold text-gray-500 mb-5 text-center">
              {isBn ? 'পেমেন্ট মেথড নির্বাচন করুন' : 'Select a payment method'}
            </p>
            <div className="space-y-3">
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method.id}
                  onClick={() => processSubscription(method.id)}
                  disabled={isProcessing}
                  className={`w-full py-4 px-6 rounded-2xl flex items-center justify-between transition-all ${method.color} ${method.hover} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="font-black tracking-wide text-sm">{method.label}</span>
                  {isProcessing ? <Zap size={16} className="animate-pulse" /> : <Check size={16} className="opacity-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Reassurance */}
          <div className="p-5 bg-gray-50 text-center border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" /> 
              {isBn ? 'নিরাপদ পেমেন্ট গেটওয়ে' : 'Secure Payment Gateway'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
