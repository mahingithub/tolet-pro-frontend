import React, { useState } from 'react';
import { ShieldCheck, Lock, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const SimulationContainer = ({ onClose, children, bg }) => (
  <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
    <div className={`w-full max-w-sm h-full max-h-[700px] rounded-[2.5rem] overflow-hidden shadow-2xl relative flex flex-col ${bg} animate-[slideUp_0.3s_ease-out]`}>
      <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors">
        <X size={20} />
      </button>
      {children}
    </div>
  </div>
);

export const BkashGateway = ({ amount, onPay, onClose }) => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = (e) => {
    e.preventDefault();
    if (step === 1 && phone) setStep(2);
    else if (step === 2 && pin) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        onPay();
      }, 1500);
    }
  };

  return (
    <SimulationContainer onClose={onClose} bg="bg-[#e2136e]">
      <div className="flex-1 flex flex-col p-6 text-white text-center mt-12">
        <div className="w-20 h-20 mx-auto bg-white rounded-full p-4 mb-6 shadow-lg flex items-center justify-center">
           <div className="text-[#e2136e] font-black text-2xl italic tracking-tighter">bKash</div>
        </div>
        
        <div className="bg-white/10 rounded-2xl p-4 mb-8 border border-white/20">
          <p className="text-sm opacity-90">Tolet-Pro Subscription</p>
          <p className="text-3xl font-black mt-1">৳{amount}</p>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col">
          {step === 1 ? (
            <div className="text-left bg-white text-gray-900 rounded-2xl p-6 shadow-xl">
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Your bKash Account Number</label>
              <input 
                type="tel" 
                placeholder="e.g 017XXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-center text-xl font-bold border-b-2 border-[#e2136e] py-2 focus:outline-none focus:border-pink-600 mb-4"
                autoFocus
                required
              />
              <p className="text-[10px] text-gray-400 text-center leading-relaxed">By clicking proceed, you agree to the terms and conditions.</p>
            </div>
          ) : (
            <div className="text-left bg-white text-gray-900 rounded-2xl p-6 shadow-xl">
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Enter bKash PIN</label>
              <input 
                type="password" 
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full text-center text-3xl tracking-[1em] font-bold border-b-2 border-[#e2136e] py-2 focus:outline-none focus:border-pink-600 mb-4"
                autoFocus
                required
              />
            </div>
          )}

          <div className="mt-auto pt-6 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-black/20 hover:bg-black/30 rounded-2xl font-bold transition-colors">
              CLOSE
            </button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-white text-[#e2136e] hover:bg-gray-100 rounded-2xl font-bold transition-colors shadow-lg disabled:opacity-70">
              {isProcessing ? 'PROCESSING...' : (step === 1 ? 'PROCEED' : 'CONFIRM')}
            </button>
          </div>
        </form>
      </div>
    </SimulationContainer>
  );
};

export const NagadGateway = ({ amount, onPay, onClose }) => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = (e) => {
    e.preventDefault();
    if (step === 1 && phone) setStep(2);
    else if (step === 2 && pin) {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        onPay();
      }, 1500);
    }
  };

  return (
    <SimulationContainer onClose={onClose} bg="bg-gradient-to-b from-[#ed1c24] to-[#c6161d]">
      <div className="flex-1 flex flex-col p-6 text-white text-center">
        <div className="mt-8 mb-6 flex justify-center items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#ed1c24] font-black text-xl italic">N</div>
          <span className="text-3xl font-black italic tracking-tighter">নগদ</span>
        </div>
        
        <div className="mb-8 text-left bg-black/20 rounded-2xl p-5 border border-white/10 shadow-inner">
          <div className="flex justify-between text-sm mb-2"><span className="opacity-80">Merchant:</span> <b>TOLET-PRO</b></div>
          <div className="flex justify-between text-sm mb-2"><span className="opacity-80">Total Amount:</span> <b>BDT {amount}</b></div>
          <div className="flex justify-between text-sm"><span className="opacity-80">Charge:</span> <b>BDT 0.00</b></div>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col">
          {step === 1 ? (
            <div className="mb-4">
              <label className="block text-sm font-bold mb-3">Your Nagad Account Number</label>
              <input 
                type="tel" 
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-center text-xl font-bold bg-white text-gray-900 rounded-2xl py-4 focus:outline-none focus:ring-4 ring-white/30"
                autoFocus
                required
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-bold mb-3">Enter PIN</label>
              <input 
                type="password" 
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full text-center text-2xl tracking-[0.5em] font-bold bg-white text-gray-900 rounded-2xl py-4 focus:outline-none focus:ring-4 ring-white/30"
                autoFocus
                required
              />
            </div>
          )}

          <div className="mt-auto pt-4 flex gap-3">
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-white text-[#ed1c24] hover:bg-gray-100 rounded-2xl font-black uppercase transition-colors shadow-lg disabled:opacity-70">
              {isProcessing ? 'Processing...' : 'Proceed'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-black/20 hover:bg-black/30 rounded-2xl font-black uppercase transition-colors">
              Close
            </button>
          </div>
        </form>
      </div>
    </SimulationContainer>
  );
};

export const CardGateway = ({ amount, onPay, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNext = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onPay();
    }, 1500);
  };

  return (
    <SimulationContainer onClose={onClose} bg="bg-gray-900">
      <div className="flex-1 flex flex-col p-6 text-white text-center mt-8">
        <div className="flex justify-center gap-2 mb-6 opacity-70">
          <div className="w-10 h-6 bg-white/20 rounded"></div>
          <div className="w-10 h-6 bg-white/20 rounded"></div>
          <div className="w-10 h-6 bg-white/20 rounded"></div>
        </div>
        
        <div className="mb-8 flex justify-between items-end border-b border-white/20 pb-4">
          <div className="text-left">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Amount to Pay</p>
            <p className="text-3xl font-black mt-1">৳{amount}</p>
          </div>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col gap-4 text-left">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Card Number</label>
            <input type="text" placeholder="XXXX XXXX XXXX XXXX" className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 text-white font-mono" required />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1">Expiry</label>
              <input type="text" placeholder="MM/YY" className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 text-white font-mono" required />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-1">CVV</label>
              <input type="password" placeholder="123" className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 text-white font-mono" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">Cardholder Name</label>
            <input type="text" placeholder="John Doe" className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 text-white" required />
          </div>

          <div className="mt-auto pt-6">
            <button type="submit" disabled={isProcessing} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-colors shadow-lg disabled:opacity-70 flex items-center justify-center gap-2">
              <Lock size={16} />
              {isProcessing ? 'Processing Securely...' : `Pay ৳${amount}`}
            </button>
          </div>
        </form>
      </div>
    </SimulationContainer>
  );
};
