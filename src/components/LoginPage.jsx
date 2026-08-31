import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import {
  User, Phone, Lock, ArrowLeft, Loader2, CheckCircle2,
  Home, ShieldCheck, Building2, MessageCircle, ChevronRight,
  Check, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { resolveHome } from '../utils/homeSurface';
import {
  signupStart,
  signupVerify,
  forgotPassword,
  resetPassword,
} from '../services/authService.js';
import {
  toBdNationalPhone,
  BD_MOBILE_NATIONAL_RE,
  passwordChecks,
} from '../utils/validators.js';

const RESEND_COOLDOWN_S = 30;

/**
 * Reduce whatever the user typed or pasted to the 10-digit national part that
 * sits after the `+880` prefix shown in the field. Handles the leading 0 a BD
 * user habitually types (`01742…` → `1742…`) and a full pasted number
 * (`+8801742…` → `1742…`), which the old digits-only version mangled into
 * `8801742345`.
 */
function normalizePhoneInput(raw) {
  return toBdNationalPhone(raw);
}

function toE164(localPart) {
  return `+880${localPart}`;
}

/**
 * Why this exists: the backend only enforces generic E.164 (`+` then 8-15
 * digits), so `1234567890` used to sail straight through to the OTP screen —
 * an SMS was requested for a number that cannot exist, the rate-limit quota
 * was spent, and the user sat waiting for a code that would never arrive.
 * We now block that here and say exactly what is wrong.
 *
 * Returns null when the number is a valid BD mobile, otherwise { en, bn }.
 */
function phoneProblem(local) {
  if (!local) {
    return { en: 'Enter your mobile number.', bn: 'আপনার মোবাইল নম্বর দিন।' };
  }
  if (local.length < 10) {
    return {
      en: `Too short — ${10 - local.length} more digit${10 - local.length > 1 ? 's' : ''} to go. Example: 1712345678`,
      bn: `আরও ${10 - local.length}টি সংখ্যা বাকি। যেমন: ১৭১২৩৪৫৬৭৮`,
    };
  }
  if (!BD_MOBILE_NATIONAL_RE.test(local)) {
    return {
      en: 'This is not a Bangladeshi mobile number. After +880 it must start with 13, 14, 15, 16, 17, 18 or 19.',
      bn: 'এটি বাংলাদেশি মোবাইল নম্বর নয়। +৮৮০ এর পরে নম্বরটি ১৩, ১৪, ১৫, ১৬, ১৭, ১৮ বা ১৯ দিয়ে শুরু হতে হবে।',
    };
  }
  return null;
}

/**
 * The password rules as a live checklist rather than one line of prose.
 * Previously the hint said "at least 8 characters, with letters and numbers"
 * while the input only enforced minLength=8 — so `abcdefgh` submitted fine and
 * the user's first hint about the missing digit was a Bangla server error after
 * the round trip. Each rule now ticks green the moment it is satisfied.
 *
 * The rules mirror the backend exactly: 8-128 chars, one ASCII letter, one
 * ASCII digit. We say "English letter / number" out loud because the server's
 * regexes are ASCII-only, so Bengali script and Bengali numerals don't count.
 */
const PasswordRules = ({ checks, isBn }) => {
  const rules = [
    {
      ok: checks.minLength,
      label: isBn ? '৮ বা তার বেশি অক্ষর' : '8 characters or more',
    },
    {
      ok: checks.letter,
      label: isBn ? 'অন্তত একটি ইংরেজি অক্ষর (a-z)' : 'At least one English letter (a-z)',
    },
    {
      ok: checks.digit,
      label: isBn ? 'অন্তত একটি সংখ্যা (0-9)' : 'At least one number (0-9)',
    },
  ];

  return (
    <ul className="mt-2 ml-1 space-y-1" aria-live="polite">
      {rules.map(({ ok, label }) => (
        <li
          key={label}
          className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${ok ? 'text-emerald-600' : 'text-gray-500'}`}
        >
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors ${ok ? 'bg-emerald-100' : 'bg-gray-200'}`}
            aria-hidden="true"
          >
            {ok
              ? <Check size={9} strokeWidth={4} className="text-emerald-600" />
              : <span className="w-1 h-1 rounded-full bg-gray-400" />}
          </span>
          <span className="sr-only">{ok ? (isBn ? 'পূরণ হয়েছে:' : 'Met:') : (isBn ? 'বাকি আছে:' : 'Not met:')}</span>
          {label}
        </li>
      ))}
    </ul>
  );
};

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
  const goBack = useGoBack('/');
  const [searchParams] = useSearchParams();
  const { login, refresh, roles } = useAuth();
  const { settings } = useSettings();

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

  // ─── Role-selection popup ───────────────────────────────────────────────
  // On entering the login / signup screen we prompt the user to say whether
  // they're a tenant or a landlord, so they never have to guess which side
  // they registered on. We skip it when the URL already carries an explicit
  // role (e.g. the navbar "I'm a landlord" CTA → ?role=landlord) or on the
  // forgot-password flow where role is irrelevant. The in-form toggle stays
  // available as a quick way to change the choice afterwards.
  const hasExplicitRole = requestedRole === 'landlord' || requestedRole === 'tenant';
  const [showRolePicker, setShowRolePicker] = useState(
    !hasExplicitRole && requestedMode !== 'forgot',
  );
  const chooseRole = (r) => {
    setRole(r);
    setShowRolePicker(false);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  // Set to the role the account ACTUALLY owns after a wrong-side login attempt,
  // so we can offer a one-tap "switch and try again" instead of leaving the
  // user to work out which tab they were supposed to use.
  const [roleMismatch, setRoleMismatch] = useState(null);

  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);

  // Field-level feedback. We only surface a phone error once the user has left
  // the field or pressed submit, so we're not nagging them at the 3rd digit.
  // The password checklist, by contrast, is visible from the start — the rules
  // should be known before you invent a password, not after it's rejected.
  const [phoneTouched, setPhoneTouched] = useState(false);

  const phoneIssue = phoneProblem(formData.phone);
  const phoneError = phoneTouched && phoneIssue ? L(phoneIssue.en, phoneIssue.bn) : '';

  // Signup and reset must satisfy the backend's password rules; login must not
  // (a legacy account whose password predates those rules would be locked out
  // of our own gate before the request ever left the browser).
  const signupPwChecks = passwordChecks(formData.password);
  const signupPwOk = signupPwChecks.minLength && signupPwChecks.letter && signupPwChecks.digit;
  const resetPwChecks = passwordChecks(newPassword);
  const resetPwOk = resetPwChecks.minLength && resetPwChecks.letter && resetPwChecks.digit;

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
      return;
    }
    // Same rules as a cold app open (utils/homeSurface.js) rather than a second
    // hardcoded copy — signing in and reopening the app should not land you on
    // two different screens. `hasBooking: true` on the 'auto' path because a
    // tenant who just signed in deliberately is better served by their
    // dashboard than by the marketing homepage; the cold-boot guard is the one
    // that has to be careful not to move someone who was already browsing.
    const defaultHome = settings?.app?.defaultHome || 'auto';
    navigate(resolveHome({ activeRole: resolvedRole, roles, defaultHome, hasBooking: true }), { replace: true });
  };

  const handlePhoneChange = (e) =>
    setFormData((d) => ({ ...d, phone: normalizePhoneInput(e.target.value).slice(0, 10) }));

  /**
   * Hard gate in front of every request that sends an SMS or attempts a login.
   * Marks the field touched so the inline reason appears, mirrors it into the
   * banner, and returns false to abort the submit.
   */
  const blockOnBadPhone = () => {
    if (!phoneIssue) return false;
    setPhoneTouched(true);
    setInfoMsg('');
    setRoleMismatch(null);
    setErrorMsg(L(phoneIssue.en, phoneIssue.bn));
    return true;
  };

  // Changing the tenant/landlord tab clears a previous wrong-side error so the
  // stale "You are not a landlord." message doesn't sit above the other tab.
  const selectRole = (r) => {
    setRole(r);
    setRoleMismatch(null);
    setErrorMsg('');
  };

  const switchMode = (m) => {
    setMode(m);
    setStep(STEPS.FORM);
    setErrorMsg('');
    setInfoMsg('');
    setRoleMismatch(null);
    setOtp(['', '', '', '', '', '']);
    setFormData({ name: '', phone: '', password: '' });
    setNewPassword('');
    setPhoneTouched(false);
  };

  // ─── LOGIN flow (no OTP) ──────────────────────────────────────────────────
  const submitLogin = async (e) => {
    e.preventDefault();
    if (blockOnBadPhone()) return;
    // Login only needs a non-empty password. We deliberately do NOT apply the
    // signup strength rules here — an older account whose password predates
    // them would be locked out by our own gate before the request went out.
    if (!formData.password) {
      setInfoMsg('');
      setErrorMsg(L('Enter your password.', 'আপনার পাসওয়ার্ড দিন।'));
      return;
    }
    setIsLoading(true); setErrorMsg(''); setInfoMsg(''); setRoleMismatch(null);
    try {
      const loggedInUser = await login({ phone: toE164(formData.phone), password: formData.password }, role);
      if (['super_admin', 'moderator', 'support_agent'].includes(loggedInUser?.role)) {
        goToNextOrDashboard('admin');
      } else {
        goToNextOrDashboard(role);
      }
    } catch (err) {
      // The account exists and the password is right, but it doesn't own the
      // role selected above. Say so plainly and point at the side they DO own,
      // instead of a generic "login failed" that looks like a wrong password.
      if (err?.code === 'ROLE_MISMATCH') {
        const owns = Array.isArray(err.actualRoles) ? err.actualRoles : [];
        const otherSide = owns.includes('landlord') ? 'landlord'
          : owns.includes('tenant') ? 'tenant'
          : null;
        setErrorMsg(
          role === 'tenant'
            ? L('You are not a tenant.', 'আপনি ভাড়াটিয়া নন।')
            : L('You are not a landlord.', 'আপনি বাড়িওয়ালা নন।'),
        );
        setRoleMismatch(otherSide);
        return;
      }
      handleError(err, 'লগইন করা যায়নি। নম্বর ও পাসওয়ার্ড দেখে নিন।', 'Could not log in. Check your number and password.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── SIGNUP flow (with OTP) ───────────────────────────────────────────────
  const submitSignupStart = async (e) => {
    e.preventDefault();
    // Every gate runs BEFORE the network call, so an unusable number or a
    // password the server would reject can never advance us to the OTP screen.
    if (formData.name.trim().length < 2) {
      setInfoMsg('');
      setErrorMsg(L(
        'Enter your full name (at least 2 characters).',
        'আপনার পুরো নাম লিখুন (অন্তত ২ অক্ষর)।',
      ));
      return;
    }
    if (blockOnBadPhone()) return;
    if (!signupPwOk) {
      setInfoMsg('');
      setErrorMsg(L(
        'Please meet all the password requirements listed below.',
        'নিচে দেখানো পাসওয়ার্ডের সব শর্ত পূরণ করুন।',
      ));
      return;
    }
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
      handleError(err, 'সাইন আপ শুরু করা যায়নি। আবার চেষ্টা করুন।', 'Could not start signup. Please try again.');
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
      handleError(err, 'অ্যাকাউন্ট তৈরি করা যায়নি। কোডটি দেখে আবার দিন।', 'Could not create your account. Check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT-PASSWORD flow (with OTP) ──────────────────────────────────────
  const submitForgotStart = async (e) => {
    e.preventDefault();
    if (blockOnBadPhone()) return;
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      // Constant 202 response — never reveals whether the account exists.
      await forgotPassword({ phoneNumber: toE164(formData.phone) });
      setStep(STEPS.OTP);
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      handleError(err, 'কোড পাঠানো যায়নি। আবার চেষ্টা করুন।', 'Could not send the code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot flow verifies the OTP AND sets the new password in one backend call.
  const submitReset = async (e) => {
    e.preventDefault();
    if (!resetPwOk) {
      setInfoMsg('');
      setErrorMsg(L(
        'Please meet all the password requirements listed below.',
        'নিচে দেখানো পাসওয়ার্ডের সব শর্ত পূরণ করুন।',
      ));
      return;
    }
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      await resetPassword({
        phoneNumber: toE164(formData.phone),
        otp: otp.join(''),
        newPassword,
      });
      switchMode(MODES.LOGIN);
      setInfoMsg(isBn
        ? 'পাসওয়ার্ড বদলে গেছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
        : 'Your password is changed. Log in with the new one.');
    } catch (err) {
      handleError(err, 'পাসওয়ার্ড বদলানো যায়নি। কোডটি দেখে আবার চেষ্টা করুন।', 'Could not change the password. Check the code and try again.');
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
      setInfoMsg(isBn ? 'নতুন কোড পাঠানো হয়েছে।' : 'A new code is on its way.');
    } catch (err) {
      handleError(err, 'কোড পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।', 'Could not send the code. Please try again in a moment.');
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
    mode === MODES.SIGNUP ? L('Create your account', 'নতুন অ্যাকাউন্ট খুলুন')
      : mode === MODES.FORGOT ? L('Set a new password', 'নতুন পাসওয়ার্ড দিন')
      : L('Welcome back', 'আবার স্বাগতম');
  const formSub =
    mode === MODES.SIGNUP ? L('It only takes a minute', 'মাত্র এক মিনিটের কাজ')
      : mode === MODES.FORGOT ? L("Give us your number and we'll text you a code", 'আপনার নম্বর দিন, আমরা এসএমএসে একটি কোড পাঠাবো')
      : L('Log in to your account', 'আপনার অ্যাকাউন্টে লগইন করুন');

  const trustChips = [
    { icon: ShieldCheck, label: L('Verified landlords', 'যাচাই করা বাড়িওয়ালা') },
    { icon: Building2, label: L('No fake ads', 'ভুয়া বিজ্ঞাপন নেই') },
    { icon: MessageCircle, label: L('Chat or call directly', 'সরাসরি চ্যাট ও কল') },
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
      {/* ── ROLE PICKER POPUP ──
          Appears on entry to login/signup so the user explicitly picks whether
          they're a tenant or a landlord (they don't have to remember which side
          they signed up on). Skipped when a role is already set via the URL or
          on the forgot-password screen. Picking an option preselects the role
          and reveals the form; the in-form toggle can still change it. */}
      {showRolePicker && mode !== MODES.FORGOT && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setShowRolePicker(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.25)] w-full max-w-sm overflow-hidden animate-[floatIn_0.3s_ease-out]">
            {/* Brand header */}
            <div className="relative bg-gradient-to-br from-[#BA0036] to-[#7A0024] px-6 pt-7 pb-7 text-white text-center overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <img src="/icons/logo.svg" alt="To-Let Pro" className="w-14 h-14 mx-auto mb-3 shadow-lg rounded-2xl" />
              <h3 className="text-xl font-black tracking-tight">
                {mode === MODES.SIGNUP
                  ? L('Are you a tenant or a landlord?', 'আপনি ভাড়াটিয়া, না বাড়িওয়ালা?')
                  : L('Log in as a tenant or a landlord?', 'ভাড়াটিয়া, না বাড়িওয়ালা হিসেবে লগইন করবেন?')}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {L('Pick one to continue', 'একটি বেছে নিন')}
              </p>
            </div>

            {/* Options */}
            <div className="p-5 grid gap-3">
              <button
                type="button"
                onClick={() => chooseRole('tenant')}
                className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brandRed hover:bg-red-50/40 transition-all text-left active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <User size={22} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-gray-900">{L('Tenant', 'ভাড়াটিয়া')}</p>
                  <p className="text-xs text-gray-500">{L("I'm looking for a home", 'আমি বাসা খুঁজছি')}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-brandRed group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => chooseRole('landlord')}
                className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-100 hover:border-brandRed hover:bg-red-50/40 transition-all text-left active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Building2 size={22} className="text-brandRed" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-gray-900">{L('Landlord', 'বাড়িওয়ালা')}</p>
                  <p className="text-xs text-gray-500">{L('I want to list my property', 'আমি বাড়ি ভাড়া দিতে চাই')}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-brandRed group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

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
            <img src="/icons/logo.svg" alt="To-Let Pro" className="w-10 h-10 shadow-sm rounded-xl" />
            <span className="text-lg font-black tracking-tight">
              TO-LET <span className="text-white/70">PRO</span>
            </span>
          </div>

          {/* Headline */}
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest py-1.5 px-3 rounded-full ring-1 ring-white/20 mb-5">
              <ShieldCheck size={13} />
              {L('Rent without the worry', 'নিশ্চিন্তে বাসা ভাড়া')}
            </div>
            <h1 className="text-4xl xl:text-[2.9rem] font-black leading-[1.1] tracking-tight mb-4">
              {isBn ? (
                <>পছন্দের বাসা খুঁজুন,<br /><span className="text-[#FFC2D1]">ঝামেলা ছাড়াই।</span></>
              ) : (
                <>Find the right home,<br /><span className="text-[#FFC2D1]">without the hassle.</span></>
              )}
            </h1>
            <p className="text-white/75 text-base max-w-md leading-relaxed mb-8">
              {L(
                'Flats, sublets, shops and offices from all over Bangladesh. Every listing is checked, and you talk to the owner yourself.',
                'বাংলাদেশের সব জায়গার ফ্ল্যাট, সাবলেট, দোকান ও অফিস এক জায়গায়। প্রতিটি বিজ্ঞাপন যাচাই করা, আর মালিকের সাথে আপনি নিজেই কথা বলবেন।',
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
          onClick={() => (step !== STEPS.FORM ? setStep(STEPS.FORM) : goBack())}
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
              <img src="/icons/logo.svg" alt="To-Let Pro" className="w-16 h-16 mb-3 shadow-lg rounded-2xl" />
              <h1 className="text-lg font-black tracking-tight text-gray-900">
                TO-LET <span className="text-brandRed">PRO</span>
              </h1>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">
                {L('Home rentals across Bangladesh', 'বাংলাদেশজুড়ে বাসা ভাড়ার ঠিকানা')}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600 text-center">
                {errorMsg}
                {/* Wrong side: offer the correct one so the user isn't stuck
                    guessing which tab their account lives on. */}
                {roleMismatch && (
                  <button
                    type="button"
                    onClick={() => selectRole(roleMismatch)}
                    className="block w-full mt-2 text-xs font-bold text-brandRed underline"
                  >
                    {roleMismatch === 'landlord'
                      ? L('This account is a landlord — log in as landlord', 'এই অ্যাকাউন্টটি বাড়িওয়ালার — বাড়িওয়ালা হিসেবে লগইন করুন')
                      : L('This account is a tenant — log in as tenant', 'এই অ্যাকাউন্টটি ভাড়াটিয়ার — ভাড়াটিয়া হিসেবে লগইন করুন')}
                  </button>
                )}
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
                      onClick={() => selectRole('tenant')}
                      className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'tenant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {L('Tenant', 'ভাড়াটিয়া')}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectRole('landlord')}
                      className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'landlord' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {L('Landlord', 'বাড়িওয়ালা')}
                    </button>
                  </div>
                )}

                {/* noValidate: our own checks are the single source of truth so
                    every message is in the user's chosen language. The browser's
                    native bubbles ignore the language toggle and would fire
                    before our handlers could explain the real problem. */}
                <form
                  noValidate
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
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none"
                          required
                          minLength={2}
                          maxLength={80}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-phone" className="block text-[11px] font-bold text-gray-700 mb-1 ml-1 uppercase tracking-wider">
                      {L('Mobile number', 'মোবাইল নম্বর')}
                    </label>
                    <div
                      className={`relative flex items-center bg-gray-50 border rounded-xl transition-all overflow-hidden ${
                        phoneError
                          ? 'border-red-400 ring-2 ring-red-100'
                          : 'border-gray-200 focus-within:bg-white focus-within:border-brandRed focus-within:ring-2 focus-within:ring-brandRed/20'
                      }`}
                    >
                      <div className={`pl-3.5 pr-2.5 ${phoneError ? 'text-red-400' : 'text-gray-400'}`}><Phone size={16} /></div>
                      <div className="px-1.5 py-3 border-l border-gray-300 text-gray-600 font-bold text-sm">+880</div>
                      <input
                        id="auth-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        onBlur={() => setPhoneTouched(true)}
                        maxLength={10}
                        placeholder={mode === MODES.SIGNUP ? 'ex- whatsapp number' : 'ex - your number'}
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-invalid={phoneError ? 'true' : 'false'}
                        aria-describedby="auth-phone-help"
                        className="flex-1 min-w-0 bg-transparent py-3 pl-2 pr-4 text-sm font-bold text-gray-900 outline-none tracking-wide"
                        required
                      />
                    </div>
                    {/* One slot for both the hint and the reason it's rejected,
                        so the field never jumps as the message swaps. */}
                    <div
                      id="auth-phone-help"
                      className={`mt-1 ml-1 text-[11px] font-semibold flex flex-col items-start gap-1 ${phoneError ? 'text-red-600' : 'text-gray-500'}`}
                      aria-live="polite"
                    >
                      {phoneError ? (
                        <div className="flex items-start gap-1">
                          <AlertCircle size={12} className="mt-[1px] shrink-0" />
                          <span>{phoneError}</span>
                        </div>
                      ) : (
                        mode === MODES.SIGNUP ? (
                          <span>
                            {L(
                              'Type the 10 digits after +880 (skip the first 0). We text your code here.',
                              '+৮৮০ এর পরের ১০টি সংখ্যা লিখুন (শুরুর ০ বাদ দিন)। এই নম্বরেই এসএমএসে কোড যাবে।'
                            )}
                          </span>
                        ) : null
                      )}
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
                          autoComplete={mode === MODES.SIGNUP ? 'new-password' : 'current-password'}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none tracking-widest"
                          required
                          minLength={mode === MODES.SIGNUP ? 8 : 1}
                          maxLength={mode === MODES.SIGNUP ? 128 : undefined}
                        />
                      </div>
                      {mode === MODES.SIGNUP && (
                        <>
                          <p className="text-[11px] font-semibold text-gray-600 mt-2 ml-1">
                            {L('Your password must have:', 'আপনার পাসওয়ার্ডে থাকতে হবে:')}
                          </p>
                          <PasswordRules checks={signupPwChecks} isBn={isBn} />
                        </>
                      )}
                    </div>
                  )}

                  {/* Deliberately NOT disabled on invalid input. A dead button
                      tells the user nothing; letting the click through means
                      the submit handler can name the exact problem. The
                      handlers gate the request, so nothing invalid is sent. */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-brandRed text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(186,0,54,0.2)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(186,0,54,0.3)] active:translate-y-0 transition-all disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} />
                      : mode === MODES.LOGIN ? L('Log in', 'লগইন করুন')
                      : mode === MODES.SIGNUP ? L('Send verification code', 'যাচাই কোড পাঠান')
                      : L('Send code', 'কোড পাঠান')}
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
                      {L('Already have an account?', 'আগে থেকেই অ্যাকাউন্ট আছে?')}
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
                  {L('Every number is verified by SMS', 'প্রতিটি নম্বর এসএমএসে যাচাই করা হয়')}
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
                    ? L('Set a new password', 'নতুন পাসওয়ার্ড দিন')
                    : L('Verify your number', 'নম্বর যাচাই করুন')}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  {L('We sent a 6-digit code by SMS to', 'এই নম্বরে এসএমএসে ৬ সংখ্যার একটি কোড পাঠানো হয়েছে')} <br />
                  <span className="font-bold text-gray-800">+880 {formData.phone}</span>
                </p>

                <form noValidate onSubmit={mode === MODES.FORGOT ? submitReset : submitSignupOtp} className="flex flex-col items-center">
                  <div className="flex justify-center gap-2 sm:gap-4 mb-4" onPaste={handleOtpPaste}>
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
                        className="w-10 h-12 sm:w-14 sm:h-14 text-center text-lg sm:text-xl font-black text-brandRed bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-brandRed focus:bg-white transition-all shadow-sm"
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
                          autoComplete="new-password"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:border-brandRed focus:ring-2 focus:ring-brandRed/20 transition-all outline-none tracking-widest"
                          required
                          minLength={8}
                          maxLength={128}
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-gray-600 mt-2 ml-1">
                        {L('Your new password must have:', 'নতুন পাসওয়ার্ডে থাকতে হবে:')}
                      </p>
                      <PasswordRules checks={resetPwChecks} isBn={isBn} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendIn > 0 || isLoading}
                    className="mb-4 text-xs font-bold text-gray-500 hover:text-brandRed transition-colors disabled:opacity-50"
                  >
                    {resendIn > 0
                      ? L(`You can ask for a new code in ${resendIn}s`, `${resendIn} সেকেন্ড পরে আবার কোড চাইতে পারবেন`)
                      : L("Didn't get the code? Send it again", 'কোড পাননি? আবার পাঠান')}
                  </button>

                  {/* The six boxes make an incomplete code self-evident, so
                      gating on that is fair. The password is NOT gated here —
                      submitReset names the unmet rule instead. */}
                  <button
                    type="submit"
                    disabled={isLoading || otp.join('').length < 6}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="animate-spin" size={18} />
                      : mode === MODES.FORGOT ? L('Save new password', 'নতুন পাসওয়ার্ড সেভ করুন')
                      : <><CheckCircle2 size={18} /> {L('Verify', 'যাচাই করুন')}</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep(STEPS.FORM); setOtp(['', '', '', '', '', '']); setNewPassword(''); setErrorMsg(''); }}
                    className="mt-4 text-sm font-bold text-gray-400 hover:text-brandRed transition-colors"
                  >
                    ← {L('Use a different number', 'অন্য নম্বর দিন')}
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
