import React, { useState } from 'react';
import { ShieldCheck, Lock, X } from 'lucide-react';

// Wrapper for all payment modals to share the premium glassmorphism overlay
const SimulationContainer = ({ onClose, children, bg, themeMode = 'dark' }) => (
  <div className="fixed inset-0 z-[9999] bg-slate-900/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 transition-all animate-tp-fade-in">
    <div className={`w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col ${bg} animate-tp-modal-in border border-white/20 dark:border-white/10`}>
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-50 p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
      >
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
      <div className="flex-1 flex flex-col p-6 text-white text-center mt-10">
        <div className="w-16 h-16 mx-auto bg-white rounded-full p-2 mb-6 shadow-xl flex items-center justify-center transform hover:scale-105 transition-transform">
           <div className="text-[#e2136e] font-black text-xl italic tracking-tighter">bKash</div>
        </div>
        
        <div className="bg-black/10 rounded-2xl p-4 mb-8 border border-white/10 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Tolet-Pro Subscription</p>
          <p className="text-4xl font-display font-extrabold tracking-tight">৳{amount}</p>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col">
          {step === 1 ? (
            <div className="text-left bg-white text-slate-900 rounded-3xl p-6 shadow-xl relative mt-2">
              <div className="relative group">
                <input 
                  type="tel" 
                  id="bkash-phone"
                  placeholder=" "
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="peer w-full text-lg font-bold border-b-2 border-slate-200 focus:border-[#e2136e] py-3 bg-transparent focus:outline-none transition-colors"
                  autoFocus
                  required
                />
                <label 
                  htmlFor="bkash-phone"
                  className="absolute left-0 top-3 text-slate-400 font-bold transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#e2136e] peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-500"
                >
                  bKash Account Number
                </label>
              </div>
              <p className="text-[10px] text-slate-400 text-center leading-relaxed mt-6">By clicking proceed, you agree to the terms and conditions.</p>
            </div>
          ) : (
            <div className="text-left bg-white text-slate-900 rounded-3xl p-6 shadow-xl relative mt-2">
              <div className="relative group">
                <input 
                  type="password" 
                  id="bkash-pin"
                  placeholder=" "
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="peer w-full text-center text-3xl tracking-[1em] font-bold border-b-2 border-slate-200 focus:border-[#e2136e] py-2 bg-transparent focus:outline-none transition-colors"
                  autoFocus
                  required
                />
                <label 
                  htmlFor="bkash-pin"
                  className="absolute left-0 top-3 w-full text-center text-slate-400 font-bold transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#e2136e] peer-[:not(:placeholder-shown)]:-top-4 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-500"
                >
                  Enter bKash PIN
                </label>
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3 z-10">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-white/30 hover:bg-white/10 rounded-2xl font-bold transition-colors">
              CLOSE
            </button>
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-white text-[#e2136e] hover:bg-slate-50 rounded-2xl font-bold transition-colors shadow-xl shadow-black/10 disabled:opacity-70">
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
      <div className="flex-1 flex flex-col p-6 text-white text-center mt-6">
        <div className="mb-8 flex justify-center items-center gap-2 drop-shadow-md">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#ed1c24] font-black text-2xl italic">N</div>
          <span className="text-4xl font-black italic tracking-tighter">নগদ</span>
        </div>
        
        <div className="mb-8 text-left bg-black/10 rounded-2xl p-5 border border-white/10 shadow-inner backdrop-blur-sm">
          <div className="flex justify-between text-sm mb-2"><span className="opacity-80">Merchant:</span> <b className="tracking-widest">TOLET-PRO</b></div>
          <div className="flex justify-between text-sm mb-2"><span className="opacity-80">Total Amount:</span> <b className="text-lg">BDT {amount}</b></div>
          <div className="flex justify-between text-sm"><span className="opacity-80">Charge:</span> <b>BDT 0.00</b></div>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col">
          {step === 1 ? (
            <div className="mb-4 relative">
              <input 
                type="tel" 
                id="nagad-phone"
                placeholder=" "
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="peer w-full text-center text-xl font-bold bg-white text-slate-900 rounded-2xl py-4 pt-6 focus:outline-none focus:ring-4 ring-white/30 transition-all shadow-xl"
                autoFocus
                required
              />
              <label 
                htmlFor="nagad-phone"
                className="absolute left-0 top-5 w-full text-center text-slate-400 font-bold transition-all peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-[#ed1c24] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none"
              >
                Your Nagad Account Number
              </label>
            </div>
          ) : (
            <div className="mb-4 relative">
              <input 
                type="password" 
                id="nagad-pin"
                placeholder=" "
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="peer w-full text-center text-2xl tracking-[0.5em] font-bold bg-white text-slate-900 rounded-2xl py-4 pt-6 focus:outline-none focus:ring-4 ring-white/30 transition-all shadow-xl"
                autoFocus
                required
              />
              <label 
                htmlFor="nagad-pin"
                className="absolute left-0 top-5 w-full text-center text-slate-400 font-bold transition-all peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-[#ed1c24] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none"
              >
                Enter PIN
              </label>
            </div>
          )}

          <div className="mt-8 pt-4 flex gap-3 z-10">
            <button type="submit" disabled={isProcessing} className="flex-1 py-4 bg-white text-[#ed1c24] hover:bg-slate-50 rounded-2xl font-black uppercase transition-colors shadow-xl shadow-black/10 disabled:opacity-70">
              {isProcessing ? 'Processing...' : 'Proceed'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-white/30 hover:bg-white/10 rounded-2xl font-black uppercase transition-colors">
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
    <SimulationContainer onClose={onClose} bg="bg-[#0F172A]">
      <div className="flex-1 flex flex-col p-6 text-white text-center mt-8">
        <div className="flex justify-center gap-2 mb-6 opacity-70">
          <div className="w-10 h-6 bg-white/20 rounded"></div>
          <div className="w-10 h-6 bg-white/20 rounded"></div>
          <div className="w-10 h-6 bg-white/20 rounded"></div>
        </div>
        
        <div className="mb-8 flex justify-between items-end border-b border-white/10 pb-4">
          <div className="text-left">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Amount to Pay</p>
            <p className="text-4xl font-display font-extrabold mt-1">৳{amount}</p>
          </div>
        </div>

        <form onSubmit={handleNext} className="flex-1 flex flex-col gap-4 text-left">
          <div className="relative group">
            <input type="text" id="card-num" placeholder=" " className="peer w-full bg-white/5 border border-white/10 rounded-xl py-3 pt-5 px-4 focus:outline-none focus:border-blue-500 text-white font-mono transition-colors" required />
            <label htmlFor="card-num" className="absolute left-4 top-4 text-slate-400 font-bold transition-all peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none">Card Number</label>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 relative group">
              <input type="text" id="card-exp" placeholder=" " className="peer w-full bg-white/5 border border-white/10 rounded-xl py-3 pt-5 px-4 focus:outline-none focus:border-blue-500 text-white font-mono transition-colors" required />
              <label htmlFor="card-exp" className="absolute left-4 top-4 text-slate-400 font-bold transition-all peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none">MM/YY</label>
            </div>
            <div className="flex-1 relative group">
              <input type="password" id="card-cvv" placeholder=" " className="peer w-full bg-white/5 border border-white/10 rounded-xl py-3 pt-5 px-4 focus:outline-none focus:border-blue-500 text-white font-mono transition-colors" required />
              <label htmlFor="card-cvv" className="absolute left-4 top-4 text-slate-400 font-bold transition-all peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none">CVV</label>
            </div>
          </div>
          
          <div className="relative group">
            <input type="text" id="card-name" placeholder=" " className="peer w-full bg-white/5 border border-white/10 rounded-xl py-3 pt-5 px-4 focus:outline-none focus:border-blue-500 text-white transition-colors" required />
            <label htmlFor="card-name" className="absolute left-4 top-4 text-slate-400 font-bold transition-all peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-blue-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:text-slate-500 pointer-events-none">Cardholder Name</label>
          </div>

          <div className="mt-6 pt-4">
            <button type="submit" disabled={isProcessing} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-colors shadow-lg shadow-blue-900/50 disabled:opacity-70 flex items-center justify-center gap-2">
              <Lock size={16} />
              {isProcessing ? 'Processing Securely...' : `Pay ৳${amount}`}
            </button>
          </div>
        </form>
      </div>
    </SimulationContainer>
  );
};
