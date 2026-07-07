import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Phone, Lock, ArrowLeft, Loader2, CheckCircle2,
  Home, ShieldCheck, Building2, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import {
  signupStart,
  signupVerify,
  forgotPassword,
  resetPassword,
} from '../services/authService.js';

const RESEND_COOLDOWN_S = 30;

/**
 * Strip the leading 0 a BD user often types, so `01742...` becomes `1742...`
 * and the resulting E.164 is `+8801742...`. Also drop anything non-numeric.
 */
function normalizePhoneInput(raw) {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

function toE164(localPart) {
  return `+880${localPart}`;
}

const MODES = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  FORGOT: 'forgot',
};
const STEPS = {
  FORM: 'form',
  OTP: 'otp', // signup: verify code · forgot: verify code + set new password
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, refresh } = useAuth();

  // ─── Language ──────────────────────────────────────────────────────────────
  // We capture the whole context so we can update the GLOBAL app language on
  // toggle (so the dashboard opens in the same language), while ALSO keeping a
  // local source of truth that always drives this page even if the context's
  // setter is named differently. `isBn` below is derived from the local state,
  // so every existing handler that reads `isBn` keeps working and follows the
  // toggle.
  const langCtx = useLanguage();
  const { t, language } = langCtx;
  const [uiLang, setUiLang] = useState(language === 'বাংলা' ? 'bn' : 'en');
  const isBn = uiLang === 'bn';
  const L = (en, bn) => (isBn ? bn : en);

  // Keep the page in sync if the global language changes elsewhere.
  useEffect(() => {
    setUiLang(language === 'বাংলা' ? 'bn' : 'en');
  }, [language]);

  const setLang = (target) => {
    if (target === uiLang) return;
    setUiLang(target);
    const val = target === 'bn' ? 'বাংলা' : 'English';
    // Propagate to the global app language if the context exposes a setter.
    // The local state above already guarantees this page updates regardless.
    try {
      if (typeof langCtx.setLanguage === 'function') langCtx.setLanguage(val);
      else if (typeof langCtx.toggleLanguage === 'function') langCtx.toggleLanguage();
      else if (typeof langCtx.changeLanguage === 'function') langCtx.changeLanguage(val);
      else if (typeof langCtx.setLang === 'function') langCtx.setLang(val);
    } catch { /* local state still drives the page */ }
  };

  const handleError = (err, defaultBn, defaultEn) => {
    // Backend ApiError → { code, message }. Prefer the server's own (Bangla)
    // message, then a local translation by code, then a localized default.
    const byCode = err?.code ? t[err.code] : null;
    setErrorMsg(err?.serverMessage || byCode || (isBn ? defaultBn : defaultEn));
  };

  const nextUrl = searchParams.get('next');

  // Honour the auth screen requested via the URL so the navbar / menu
  // "Log In" and "Sign Up" buttons open the correct side, and "I'm a
  // landlord" preselects the landlord signup role.
  //   /login              → login
  //   /login?mode=signup  → signup
  //   /login?mode=signup&role=landlord → signup as landlord
  const requestedMode = searchParams.get('mode');
  const requestedRole = searchParams.get('role');

  const [mode, setMode] = useState(
    requestedMode === 'signup' ? MODES.SIGNUP
      : requestedMode === 'forgot' ? MODES.FORGOT
        : MODES.LOGIN,
  );
  const [step, setStep] = useState(STEPS.FORM);
  const [role, setRole] = useState(requestedRole === 'landlord' ? 'landlord' : 'tenant');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Tick the resend countdown
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const goToNextOrDashboard = (resolvedRole) => {
    if (nextUrl) {
      try {
        navigate(decodeURIComponent(nextUrl), { replace: true });
        return;
      } catch { /* fall through */ }
    }
    if (resolvedRole === 'admin') {
      navigate('/admin', { replace: true });
    } else {
      navigate(resolvedRole === 'landlord' ? '/host-dashboard' : '/tenant-dashboard', { replace: true });
    }
  };

  const handlePhoneChange = (e) =>
    setFormData((d) => ({ ...d, phone: normalizePhoneInput(e.target.value).slice(0, 10) }));

  const switchMode = (m) => {
    setMode(m);
    setStep(STEPS.FORM);
    setErrorMsg('');
    setInfoMsg('');
    setOtp(['', '', '', '', '', '']);
    setFormData({ name: '', phone: '', password: '' });
    setNewPassword('');
  };

  // ─── LOGIN flow (no OTP) ──────────────────────────────────────────────────
  const submitLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      const loggedInUser = await login({ phone: toE164(formData.phone), password: formData.password }, role);
      if (['super_admin', 'moderator', 'support_agent'].includes(loggedInUser?.role)) {
        goToNextOrDashboard('admin');
      } else {
        goToNextOrDashboard(role);
      }
    } catch (err) {
      handleError(err, 'লগইন ব্যর্থ হয়েছে।', 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── SIGNUP flow (with OTP) ───────────────────────────────────────────────
  const submitSignupStart = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      // Backend validates input, ensures no existing verified account, stores
      // name + hashed password in a SignupIntent, and texts a 6-digit OTP via
      // sms.net.bd. A 202 means "OTP on its way".
      await signupStart({
        name: formData.name,
        phone: toE164(formData.phone),
        password: formData.password,
        role,
      });
      setStep(STEPS.OTP);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      handleError(err, 'সাইনআপ শুরু করা যায়নি।', 'Failed to start signup.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitSignupOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    const code = otp.join('');
    try {
      await signupVerify({ phoneNumber: toE164(formData.phone), otp: code });
      const newUser = refresh ? await refresh() : null;
      window.dispatchEvent(
        new CustomEvent('triggerWelcomeRobot', {
          detail: {
            role: newUser?.role || role,
            name: newUser?.name || formData.name,
            type: 'signup',
          },
        }),
      );
      goToNextOrDashboard(role);
    } catch (err) {
      handleError(err, 'অ্যাকাউন্ট তৈরি করা যায়নি।', 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT-PASSWORD flow (with OTP) ──────────────────────────────────────
  const submitForgotStart = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      // Constant 202 response — never reveals whether the account exists.
      await forgotPassword({ phoneNumber: toE164(formData.phone) });
      setStep(STEPS.OTP);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      handleError(err, 'OTP পাঠানো যায়নি।', 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot flow verifies the OTP AND sets the new password in one backend call.
  const submitReset = async (e) => {
    e.preventDefault();
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      await resetPassword({
        phoneNumber: toE164(formData.phone),
        otp: otp.join(''),
        newPassword,
      });
      switchMode(MODES.LOGIN);
      setInfoMsg(isBn ? 'পাসওয়ার্ড পরিবর্তন সফল। এবার লগইন করুন।' : 'Password changed successfully. Please log in.');
    } catch (err) {
      handleError(err, 'পাসওয়ার্ড পরিবর্তন ব্যর্থ।', 'Failed to change password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-request the OTP. Re-calls the same "start" endpoint, which upserts and
  // re-texts a fresh code (signup) or re-sends the reset code (forgot).
  const handleResend = async () => {
    if (resendIn > 0) return;
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      if (mode === MODES.SIGNUP) {
        await signupStart({
          name: formData.name,
          phone: toE164(formData.phone),
          password: formData.password,
          role,
        });
      } else {
        await forgotPassword({ phoneNumber: toE164(formData.phone) });
      }
      setOtp(['', '', '', '', '', '']);
      setResendIn(RESEND_COOLDOWN_S);
      setInfoMsg(isBn ? 'নতুন OTP পাঠানো হয়েছে।' : 'New OTP sent.');
    } catch (err) {
      handleError(err, 'OTP পাঠানো যায়নি।', 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OTP box helpers (type / backspace / paste) ───────────────────────────
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1); // keep only the last digit typed
    if (value !== '' && digit === '') return;         // ignore non-numeric input
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i += 1) next[i] = digits[i];
    setOtp(next);
    document.getElementById(`otp-${Math.min(digits.length, 5)}`)?.focus();
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  const formTitle =
    mode === MODES.SIGNUP ? L('Create your account', 'অ্যাকাউন্ট তৈরি করুন')
      : mode === MODES.FORGOT ? L('Reset password', 'পাসওয়ার্ড রিসেট করুন')
      : L('Welcome back', 'আবার স্বাগতম');
  const formSub =
    mode === MODES.SIGNUP ? L('Join TO-LET PRO today', 'আজই TO-LET PRO-তে যোগ দিন')
      : mode === MODES.FORGOT ? L("Enter your phone — we'll send an OTP", 'ফোন নম্বর দিন — আমরা একটি OTP পাঠাবো')
      : L('Sign in to continue', 'চালিয়ে যেতে সাইন ইন করুন');

  const trustChips = [
    { icon: ShieldCheck, label: L('Verified hosts', 'যাচাইকৃত বাড়িওয়ালা') },
    { icon: Building2, label: L('Real listings', 'আসল লিস্টিং') },
    { icon: MessageCircle, label: L('Chat & calls', 'চ্যাট ও কল') },
  ];

  // Reusable language pill (top-right of the form column on every layout).
  const LangToggle = (
    <div className="absolute top-5 right-5 z-30 flex items-center gap-0.5 bg-gray-100 rounded-full p-1 border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setLang('bn')}
        className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${isBn ? 'bg-white text-brandRed shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
      >
        বাংলা
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${!isBn ? 'bg-white text-brandRed shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
      >
        EN
      </button>
    </div>
  );

  return (
    <div className="h-screen w-full flex bg-[#f8f9fa] font-sans overflow-hidden">
      {/* ── LEFT SIDE: DESKTOP BRAND PANEL ── */}
      <div className="hidden lg:flex lg:w-[46%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-105 animate-[slowPan_24s_ease-in-out_infinite_alternate]"
        />
        {/* Crimson-tinted gradient — on-brand, not the generic black-photo wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#BA0036]/85 via-[#420014]/85 to-black/90" />

        <div className="relative z-10 flex flex-col justify-between w-full p-10 xl:p-14 text-white">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25">
              <Home size={20} strokeWidth={2.5} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">
              TO-LET <span className="text-white/70">PRO</span>
            </span>
          </div>

          {/* Headline */}
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest py-1.5 px-3 rounded-full ring-1 ring-white/20 mb-5">
              <ShieldCheck size={13} />
              {L('Trusted home rentals', 'বিশ্বস্ত বাসা ভাড়া')}
            </div>
            <h1 className="text-4xl xl:text-[2.9rem] font-black leading-[1.1] tracking-tight mb-4">
              {isBn ? (
                <>পছন্দের বাসা খুঁজুন,<br /><span className="text-[#FFC2D1]">সহজেই।</span></>
              ) : (
                <>Find your next home,<br /><span className="text-[#FFC2D1]">the easy way.</span></>
              )}
            </h1>
            <p className="text-white/75 text-base max-w-md leading-relaxed mb-8">
              {L(
                'Browse verified apartments, sublets and commercial spaces across Bangladesh — chat and call owners directly.',
                'বাংলাদেশজুড়ে যাচাইকৃত ফ্ল্যাট, সাবলেট ও কমার্শিয়াল স্পেস দেখুন — মালিকের সাথে সরাসরি চ্যাট ও কল করুন।',
              )}
            </p>

            {/* Trust row — content-true (verification, real listings, chat/call all exist) */}
            <div className="flex flex-wrap gap-2.5">
              {trustChips.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm py-1.5 px-3 rounded-full ring-1 ring-white/15 text-[13px] font-semibold"
                >
                  <Icon size={14} className="text-[#FFC2D1]" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDE: FORM ── */}
      <div className="w-full lg:w-[54%] relative bg-white flex flex-col">
        <button
          onClick={() => (step !== STEPS.FORM ? setStep(STEPS.FORM) : navigate(-1))}
          className="absolute top-5 left-5 z-30 text-gray-400 hover:text-brandRed transition-colors p-2 rounded-full hover:bg-gray-100"
          aria-label={L('Back', 'পিছনে')}
        >
          <ArrowLeft size={22} />
        </button>

        {LangToggle}

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-center items-center px-6 sm:px-10 py-16">
          <div className="w-full max-w-sm animate-[floatIn_0.5s_ease-out]">
            {/* Mobile-only brand block (desktop shows the left panel instead) */}
            <div className="lg:hidden flex flex-col items-center text-center mb-7">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#BA0036] to-[#7A0024] flex items-center justify-center shadow-[0_8px_22px_rgba(186,0,54,0.32)] mb-3">
                <Home size={26} strokeWidth={2.5} className="text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tight text-gray-900">
                TO-LET <span className="text-brandRed">PRO</span>
              </h1>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">
                {L('Trusted home rentals in Bangladesh', 'বাংলাদেশের বিশ্বস্ত বাসা ভাড়ার ঠিকানা')}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600 text-center">
                {errorMsg}
              </div>
            )}
            {infoMsg && !errorMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 text-center">
                {infoMsg}
              </div>
            )}

            {/* ── FORM STEP ── */}
            {step === STEPS.FORM && (
              <>
                <div className="mb-6 text-center lg:text-left">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{formTitle}</h2>
                  <p className="text-sm text-gray-500 mt-1">{formSub}</p>
                </div>

                {mode !== MODES.FORGOT && (
                  <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
                    <button
                      type="button"
                      onClick={() => setRole('tenant')}
                      className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'tenant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {L('Tenant', 'ভাড়াটিয়া')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('landlord')}
                      className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'landlord' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {L('Landlord', 'বাড়িওয়ালা')}
                    </button>
                  </div>
                )}

                <form
                  className="space-y-3.5"
                  onSubmit={
                    mode === MODES.LOGIN ? submitLogin :
                    mode === MODES.SIGNUP ? submitSignupStart :
                    submitForgotStart
                  }
                >
                  {mode === MODES.SIGNUP && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">
                        {L('Full name', 'পুরো নাম')}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <User size={16} />
                        </div>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={L('Your name', 'আপনার নাম')}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none"
                          required
                          minLength={2}
                          maxLength={80}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">
                      {L('Phone number', 'ফোন নম্বর')}
                    </label>
                    <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-xl focus-within:bg-white focus-within:border-brandRed focus-within:ring-2 focus-within:ring-brandRed/20 transition-all overflow-hidden">
                      <div className="pl-3.5 pr-2.5 text-gray-400"><Phone size={16} /></div>
                      <div className="px-1.5 py-3 border-l border-gray-300 text-gray-600 font-bold text-sm">+880</div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        maxLength={10}
                        placeholder="1XXXXXXXXX"
                        inputMode="numeric"
                        className="w-full bg-transparent py-3 pl-2 pr-4 text-sm font-bold outline-none tracking-wide"
                        required
                      />
                    </div>
                  </div>

                  {mode !== MODES.FORGOT && (
                    <div>
                      <div className="flex justify-between items-center mb-1 ml-1">
                        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                          {L('Password', 'পাসওয়ার্ড')}
                        </label>
                        {mode === MODES.LOGIN && (
                          <button
                            type="button"
                            onClick={() => switchMode(MODES.FORGOT)}
                            className="text-[11px] font-bold text-brandRed hover:underline"
                          >
                            {L('Forgot?', 'ভুলে গেছেন?')}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Lock size={16} />
                        </div>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none tracking-widest"
                          required
                          minLength={mode === MODES.SIGNUP ? 8 : 1}
                        />
                      </div>
                      {mode === MODES.SIGNUP && (
                        <p className="text-[10px] text-gray-500 mt-1 ml-1">
                          {L('At least 8 characters, with letters and numbers.', 'কমপক্ষে ৮ অক্ষর — অক্ষর ও সংখ্যা থাকতে হবে।')}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || formData.phone.length < 10}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-brandRed text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(186,0,54,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(186,0,54,0.3)] active:translate-y-0 transition-all disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} />
                      : mode === MODES.LOGIN ? L('Log in', 'লগইন করুন')
                      : mode === MODES.SIGNUP ? L('Send OTP & sign up', 'OTP পাঠিয়ে সাইন আপ')
                      : L('Send OTP', 'OTP পাঠান')}
                  </button>
                </form>

                <div className="mt-7 text-center">
                  {mode === MODES.LOGIN && (
                    <p className="text-xs sm:text-sm font-semibold text-gray-500">
                      {L('New to TO-LET PRO?', 'TO-LET PRO-তে নতুন?')}
                      <button onClick={() => switchMode(MODES.SIGNUP)} className="text-brandRed font-black ml-1.5 hover:underline">{L('Sign up', 'সাইন আপ করুন')}</button>
                    </p>
                  )}
                  {mode === MODES.SIGNUP && (
                    <p className="text-xs sm:text-sm font-semibold text-gray-500">
                      {L('Already have an account?', 'অ্যাকাউন্ট আছে?')}
                      <button onClick={() => switchMode(MODES.LOGIN)} className="text-brandRed font-black ml-1.5 hover:underline">{L('Log in', 'লগইন করুন')}</button>
                    </p>
                  )}
                  {mode === MODES.FORGOT && (
                    <p className="text-xs sm:text-sm font-semibold text-gray-500">
                      {L('Remembered your password?', 'পাসওয়ার্ড মনে পড়েছে?')}
                      <button onClick={() => switchMode(MODES.LOGIN)} className="text-brandRed font-black ml-1.5 hover:underline">{L('Log in', 'লগইন করুন')}</button>
                    </p>
                  )}
                </div>

                {/* Trust line — true to the product (every account is OTP-verified) */}
                <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-gray-400">
                  <ShieldCheck size={13} className="text-gray-400" />
                  {L('Protected by OTP verification', 'OTP যাচাইয়ের মাধ্যমে সুরক্ষিত')}
                </div>
              </>
            )}

            {/* ── OTP STEP (signup verify · forgot verify + new password) ── */}
            {step === STEPS.OTP && (
              <div className="animate-[fadeIn_0.3s_ease-out] text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {mode === MODES.FORGOT
                    ? <Lock size={28} className="text-brandRed" />
                    : <Phone size={28} className="text-brandRed" />}
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1">
                  {mode === MODES.FORGOT
                    ? L('Reset your password', 'পাসওয়ার্ড রিসেট করুন')
                    : L('Verify your number', 'নম্বর যাচাই করুন')}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {L('Enter the 6-digit OTP sent to', '৬-সংখ্যার OTP দিন যা পাঠানো হয়েছে')} <br />
                  <span className="font-bold text-gray-800">+880 {formData.phone}</span>
                </p>

                <form onSubmit={mode === MODES.FORGOT ? submitReset : submitSignupOtp} className="flex flex-col items-center">
                  <div className="flex justify-center gap-3 sm:gap-4 mb-4" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl font-black text-brandRed bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-brandRed focus:bg-white transition-all shadow-sm"
                      />
                    ))}
                  </div>

                  {/* Forgot flow: the new password lives on the same screen as the OTP. */}
                  {mode === MODES.FORGOT && (
                    <div className="w-full mb-4 text-left">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">
                        {L('New password', 'নতুন পাসওয়ার্ড')}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                          <Lock size={16} />
                        </div>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none tracking-widest"
                          required
                          minLength={8}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 ml-1">
                        {L('At least 8 characters, with letters and numbers.', 'কমপক্ষে ৮ অক্ষর — অক্ষর ও সংখ্যা থাকতে হবে।')}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendIn > 0 || isLoading}
                    className="mb-4 text-xs font-bold text-gray-500 hover:text-brandRed transition-colors disabled:opacity-50"
                  >
                    {resendIn > 0
                      ? L(`Resend OTP in ${resendIn}s`, `আবার OTP পাঠান ${resendIn}s পরে`)
                      : L('Resend OTP', 'আবার OTP পাঠান')}
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isLoading
                      || otp.join('').length < 6
                      || (mode === MODES.FORGOT && newPassword.length < 8)
                    }
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} />
                      : mode === MODES.FORGOT ? L('Reset password', 'পাসওয়ার্ড রিসেট করুন')
                      : <><CheckCircle2 size={18} /> {L('Verify', 'যাচাই করুন')}</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep(STEPS.FORM); setOtp(['', '', '', '', '', '']); setNewPassword(''); setErrorMsg(''); }}
                    className="mt-4 text-sm font-bold text-gray-400 hover:text-brandRed transition-colors"
                  >
                    ← {L('Change number', 'নম্বর পরিবর্তন করুন')}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(12px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slowPan {
          from { transform: scale(1.05) translate(0, 0); }
          to { transform: scale(1.12) translate(-1.5%, -1.5%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 9999px; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
