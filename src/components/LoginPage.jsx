import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';
import {
  User, Phone, Lock, ArrowLeft, Loader2, CheckCircle2,
  Home, ShieldCheck, Building2, MessageCircle, ChevronRight,
  Check, AlertCircle, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { resolveHome } from '../utils/homeSurface';
import {
  signupStart,
  forgotPassword,
  resetPassword,
} from '../services/authService.js';
import { createPhoneVerification, phoneAuthErrorMessage } from '../services/firebasePhoneAuth.js';
import { passwordChecks } from '../utils/validators.js';
import {
  PHONE_COUNTRIES,
  DEFAULT_PHONE_COUNTRY,
  findPhoneCountry,
  toNationalNumber,
  countryFromInternational,
  toE164,
  toBnDigits,
} from '../constants/phoneCountries.js';

const RESEND_COOLDOWN_S = 30;

// Where the chosen phone country is remembered on this device.
const PHONE_COUNTRY_KEY = 'auth:phoneCountry';

/**
 * Why this exists: the backend login only enforces generic E.164 (`+` then
 * 8-15 digits), so `1234567890` used to sail straight through to the OTP
 * screen — an SMS was requested for a number that cannot exist, the rate-limit
 * quota was spent, and the user sat waiting for a code that would never arrive.
 * We now block that here and say exactly what is wrong.
 *
 * `local` is the national number for `country` (see toNationalNumber), or a
 * `+…` number still being typed in full international form.
 *
 * Returns null when the number is a valid mobile there, otherwise { en, bn }.
 */
function phoneProblem(local, country) {
  if (!local) {
    return { en: 'Enter your mobile number.', bn: 'আপনার মোবাইল নম্বর দিন।' };
  }
  if (local.startsWith('+')) {
    // Only an unfinished or unlisted number stays in this form: a complete
    // mobile from a listed country converts the moment it matches.
    return {
      en: 'Choose your country on the left, then type the number without the country code.',
      bn: 'বাঁ পাশ থেকে আপনার দেশ বেছে নিন, তারপর দেশের কোড ছাড়া নম্বরটি লিখুন।',
    };
  }
  if (local.length < country.min) {
    const left = country.min - local.length;
    return {
      en: `Too short — ${left} more digit${left > 1 ? 's' : ''} to go. Example: ${country.example}`,
      bn: `আরও ${left}টি সংখ্যা বাকি। যেমন: ${toBnDigits(country.example)}`,
    };
  }
  if (!country.mobile.test(local)) {
    if (country.iso === 'BD') {
      return {
        en: 'This is not a Bangladeshi mobile number. After +880 it must start with 13, 14, 15, 16, 17, 18 or 19.',
        bn: 'এটি বাংলাদেশি মোবাইল নম্বর নয়। +৮৮০ এর পরে নম্বরটি ১৩, ১৪, ১৫, ১৬, ১৭, ১৮ বা ১৯ দিয়ে শুরু হতে হবে।',
      };
    }
    return {
      en: `This is not a ${country.en} mobile number. Example: +${country.dial} ${country.example}`,
      bn: `এটি ${country.bn}-এর মোবাইল নম্বর নয়। যেমন: +${toBnDigits(country.dial)} ${toBnDigits(country.example)}`,
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
 *
 * Shown in a tinted box with an example, because people skimmed past the old
 * grey list and only met the rules as an error. It turns green once all pass.
 */
const PasswordRules = ({ checks, isBn, title }) => {
  const allOk = checks.minLength && checks.letter && checks.digit;
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
    <div
      className={`mt-2 rounded-xl border px-3 py-2.5 transition-colors ${allOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
    >
      <p className={`flex items-center gap-1.5 text-xs font-bold ${allOk ? 'text-emerald-800' : 'text-amber-900'}`}>
        <Lock size={12} aria-hidden="true" className="shrink-0" />
        {title}
      </p>
      <ul className="mt-1.5 space-y-1" aria-live="polite">
        {rules.map(({ ok, label }) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${ok ? 'text-emerald-700' : 'text-gray-700'}`}
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
      <p className={`mt-1.5 text-[11px] font-semibold ${allOk ? 'text-emerald-700' : 'text-amber-800'}`}>
        {isBn ? 'যেমন: rahim2026' : 'Example: rahim2026'}
      </p>
    </div>
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

// How the six boxes look in each state. Green and red are the whole point of
// the feature, so they are strong enough to read at a glance on a cheap phone
// in daylight — but they are never the only signal (see the status line).
const OTP_BOX_STYLES = {
  idle:     'text-brandRed bg-gray-50 border-gray-200 focus:border-brandRed focus:bg-white',
  checking: 'text-gray-500 bg-gray-50 border-gray-300 opacity-70 cursor-wait',
  success:  'text-emerald-700 bg-emerald-50 border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
  wrong:    'text-red-600 bg-red-50 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
};

const OTP_STATUS_TEXT = {
  idle:     'text-gray-400',
  checking: 'text-gray-500',
  success:  'text-emerald-600',
  wrong:    'text-red-600',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const goBack = useGoBack('/');
  const [searchParams] = useSearchParams();
  const { login, completeSignup, roles } = useAuth();
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
    setErrorMsg(phoneAuthErrorMessage(err?.code, isBn) || err?.serverMessage || byCode || (isBn ? defaultBn : defaultEn));
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
  const [verifiedFirebaseToken, setVerifiedFirebaseToken] = useState(null);
  const verificationRef = useRef(null);
  const challengeRef = useRef(null);
  const cleanupRef = useRef(Promise.resolve());
  const attemptRef = useRef(0);
  const recaptchaRef = useRef(null);
  useEffect(() => () => {
    attemptRef.current += 1;
    void verificationRef.current?.dispose();
  }, []);
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

  // What the six boxes are currently saying:
  //   'idle'     — waiting for digits
  //   'checking' — the code is with the server
  //   'success'  — green: the server accepted it
  //   'wrong'    — red: the server rejected THIS code (not a network wobble)
  const [otpStatus, setOtpStatus] = useState('idle');
  const otpCode = otp.join('');
  const otpComplete = otpCode.length === 6 || !!verifiedFirebaseToken;
  const otpLocked = otpStatus === 'checking' || otpStatus === 'success';

  const focusOtpBox = (i) => {
    const el = document.getElementById(`otp-${i}`);
    if (!el) return;
    el.focus();
    // Select what's there so the next keystroke overwrites it. maxLength=1
    // otherwise swallows typing into a box that already holds a digit, which
    // reads as a dead keyboard.
    el.select?.();
  };

  const resetOtp = (status = 'idle') => {
    setOtp(['', '', '', '', '', '']);
    setOtpStatus(status);
    wasOtpCompleteRef.current = false;
  };

  // A rejected code stays on screen in red for a beat — you can't learn what you
  // mistyped from an empty row of boxes — and is then cleared for you.
  //
  // The timer is cancellable because the boxes stay editable while they're red:
  // someone who spots the bad digit and starts retyping immediately must not
  // have that work wiped out from under them 900ms later.
  const wrongTimerRef = useRef(null);
  const cancelWrongTimer = () => {
    if (!wrongTimerRef.current) return;
    clearTimeout(wrongTimerRef.current);
    wrongTimerRef.current = null;
  };
  useEffect(() => cancelWrongTimer, []);

  const flagWrongOtp = () => {
    setOtpStatus('wrong');
    cancelWrongTimer();
    wrongTimerRef.current = setTimeout(() => {
      wrongTimerRef.current = null;
      resetOtp('idle');
      focusOtpBox(0);
    }, 900);
  };

  // Field-level feedback. We only surface a phone error once the user has left
  // the field or pressed submit, so we're not nagging them at the 3rd digit.
  // The password checklist, by contrast, is visible from the start — the rules
  // should be known before you invent a password, not after it's rejected.
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Which country the number is in. Remembered on this device, so someone in
  // Singapore picks Singapore once rather than on every sign-in.
  const [phoneCountry, setPhoneCountry] = useState(() => {
    try { return findPhoneCountry(localStorage.getItem(PHONE_COUNTRY_KEY)); } catch { return DEFAULT_PHONE_COUNTRY; }
  });
  const pickCountry = (c) => {
    setPhoneCountry(c);
    try { localStorage.setItem(PHONE_COUNTRY_KEY, c.iso); } catch { /* storage blocked — just not remembered */ }
  };

  const phoneIssue = phoneProblem(formData.phone, phoneCountry);
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

  // A number pasted or autofilled in full international form (`+65 8123 4567`)
  // switches the country to match. One being TYPED that way keeps its `+`
  // until it is complete and then converts, so someone abroad who writes their
  // number the way they always do isn't read as a broken +880 number halfway
  // through. The input's maxLength is generous for the same reason: a browser
  // cuts a paste to maxLength before this handler ever sees it.
  const handlePhoneChange = (e) => {
    const raw = e.target.value;
    const intl = countryFromInternational(raw);
    if (intl) {
      pickCountry(intl);
      setFormData((d) => ({ ...d, phone: toNationalNumber(raw, intl) }));
      return;
    }
    const phone = /^\s*(\+|00)/.test(raw)
      ? `+${raw.replace(/\D/g, '').replace(/^00/, '').slice(0, 15)}`
      : toNationalNumber(raw, phoneCountry).slice(0, 15);
    setFormData((d) => ({ ...d, phone }));
  };

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

  const clearVerification = () => {
    attemptRef.current += 1;
    if (verificationRef.current) cleanupRef.current = verificationRef.current.dispose();
    verificationRef.current = null;
    challengeRef.current = null;
    setVerifiedFirebaseToken(null);
    setIsLoading(false);
  };

  const switchMode = (m) => {
    clearVerification();
    setMode(m);
    setStep(STEPS.FORM);
    setErrorMsg('');
    setInfoMsg('');
    setRoleMismatch(null);
    resetOtp();
    setFormData({ name: '', phone: '', password: '' });
    setNewPassword('');
    setPhoneTouched(false);
    setResendIn(0);
  };

  // Every code starts at the backend. For Bangladesh it texts the code itself;
  // abroad it issues a purpose-bound, expiring challenge for the Firebase SMS
  // this client then requests. A client-entered phone is never proof of identity.
  const startVerification = async ({ resend = false } = {}) => {
    const attempt = ++attemptRef.current;
    const previous = verificationRef.current;
    verificationRef.current = null;
    challengeRef.current = null;
    setVerifiedFirebaseToken(null);
    resetOtp();
    if (previous) cleanupRef.current = previous.dispose();
    await cleanupRef.current;
    if (attempt !== attemptRef.current) return false;
    const phoneNumber = toE164(formData.phone, phoneCountry);
    const challenge = mode === MODES.SIGNUP
      ? await signupStart({ name: formData.name, phone: phoneNumber, password: formData.password, role })
      : await forgotPassword({ phoneNumber });
    if (attempt !== attemptRef.current) return false;
    // Bangladesh: the server has already texted the code — straight to the boxes.
    if (challenge.provider === 'sms') {
      challengeRef.current = { provider: 'sms', phoneNumber, attempt };
      setStep(STEPS.OTP);
      setResendIn(RESEND_COOLDOWN_S);
      return true;
    }
    if (challenge.provider !== 'firebase' || !challenge.verificationId) {
      throw Object.assign(new Error('firebase_not_configured'), { code: 'firebase_not_configured' });
    }
    challengeRef.current = { provider: 'firebase', verificationId: challenge.verificationId, phoneNumber, attempt };
    const verification = createPhoneVerification({
      container: recaptchaRef.current,
      language: isBn ? 'bn' : 'en',
      onVerified: (token) => { if (attempt === attemptRef.current) setVerifiedFirebaseToken(token); },
      onError: (err) => {
        if (attempt === attemptRef.current) handleError(err, 'কোড পাঠানো যায়নি। আবার চেষ্টা করুন।', 'Could not send the code. Please try again.');
      },
    });
    verificationRef.current = verification;
    try {
      await verification.start(phoneNumber, { resend });
    } catch (err) {
      await verification.dispose();
      if (attempt === attemptRef.current) {
        verificationRef.current = null;
        challengeRef.current = null;
        throw err;
      }
      return false;
    }
    if (attempt !== attemptRef.current) return false;
    setStep(STEPS.OTP);
    setResendIn(RESEND_COOLDOWN_S);
    return true;
  };

  const verifiedIdentity = async (code) => {
    const challenge = challengeRef.current;
    if (challenge?.provider === 'sms') {
      if (!/^\d{6}$/.test(code || '')) {
        throw Object.assign(new Error('auth/invalid-verification-code'), { code: 'auth/invalid-verification-code' });
      }
      return { phoneNumber: challenge.phoneNumber, otp: code };
    }
    if (!verificationRef.current || !challenge) {
      throw Object.assign(new Error('auth/session-expired'), { code: 'auth/session-expired' });
    }
    const firebaseIdToken = verifiedFirebaseToken || await verificationRef.current.confirm(code);
    if (challenge.attempt !== attemptRef.current) {
      throw Object.assign(new Error('auth/cancelled'), { code: 'auth/cancelled' });
    }
    return { phoneNumber: challenge.phoneNumber, firebaseIdToken, verificationId: challenge.verificationId };
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
    const attempt = ++attemptRef.current;
    setIsLoading(true); setErrorMsg(''); setInfoMsg(''); setRoleMismatch(null);
    try {
      const loggedInUser = await login({ phone: toE164(formData.phone, phoneCountry), password: formData.password }, role);
      if (attempt !== attemptRef.current) return;
      if (['super_admin', 'moderator', 'support_agent'].includes(loggedInUser?.role)) {
        goToNextOrDashboard('admin');
      } else {
        goToNextOrDashboard(role);
      }
    } catch (err) {
      if (attempt !== attemptRef.current) return;
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
      if (attempt === attemptRef.current) setIsLoading(false);
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
    const attempt = attemptRef.current + 1;
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      await startVerification();
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      handleError(err, 'সাইন আপ শুরু করা যায়নি। আবার চেষ্টা করুন।', 'Could not start signup. Please try again.');
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
    }
  };

  // Verifying the code is the last step of signup — the new account is signed
  // in and goes straight to its dashboard. Nobody is sent back to type the
  // password they chose ninety seconds ago.
  //
  // Both the sixth digit landing and the button press come through here, so
  // there is one description of what verifying means.
  const runSignupVerify = async (code) => {
    if (isLoading || otpLocked) return;
    const attempt = attemptRef.current;
    setIsLoading(true); setErrorMsg(''); setInfoMsg(''); setOtpStatus('checking');
    try {
      const identity = await verifiedIdentity(code);
      const newUser = await completeSignup(identity);
      if (attempt !== attemptRef.current) return;
      await verificationRef.current?.dispose();
      if (attempt !== attemptRef.current) return;
      setOtpStatus('success');
      // Hold the green for a beat. The account is already made and the session
      // is already live — this pause only exists so the person who just typed
      // six digits gets told they got them right, instead of the screen
      // vanishing out from under them.
      await new Promise((resolve) => { setTimeout(resolve, 550); });
      if (attempt !== attemptRef.current) return;
      goToNextOrDashboard(['super_admin', 'moderator', 'support_agent'].includes(newUser?.role) ? 'admin' : newUser?.role || role);
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      handleError(err, 'অ্যাকাউন্ট তৈরি করা যায়নি। কোডটি দেখে আবার দিন।', 'Could not create your account. Check the code and try again.');
      // Red means "this code is wrong" and nothing else. A 429, an expired
      // signup session, an account that already exists — none of those are the
      // user mistyping, and wiping six correct digits over a rate limit would
      // be its own small cruelty. Those keep the digits and just show the
      // server's message.
      if (err?.code === 'otp_invalid' || err?.code === 'auth/invalid-verification-code') flagWrongOtp();
      else setOtpStatus('idle');
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
    }
  };

  const submitSignupOtp = (e) => {
    e.preventDefault();
    runSignupVerify(otpCode);
  };

  // ─── Auto-verify ──────────────────────────────────────────────────────────
  // The sixth digit is the whole message — there is nothing else on this screen
  // to fill in, so making the user then reach for a button is a step that only
  // ever costs time.
  //
  // It fires on the TRANSITION into a complete code, never on a re-render, so
  // one code is one request. That matters: /signup/verify is rate limited to 10
  // calls per IP per hour and repeated failures trip the OTP abuse guard, so a
  // loop here would lock a real user out of their own signup. Correcting a digit
  // takes the code back through "incomplete" and re-arms it, which is exactly
  // when a fresh check is wanted.
  //
  // The ref keeps the effect off the identity of runSignupVerify, which is
  // rebuilt every render and would otherwise re-run this on every keystroke.
  const runSignupVerifyRef = useRef(runSignupVerify);
  runSignupVerifyRef.current = runSignupVerify;

  const wasOtpCompleteRef = useRef(false);
  useEffect(() => {
    if (step !== STEPS.OTP || isLoading) return;
    const wasComplete = wasOtpCompleteRef.current;
    wasOtpCompleteRef.current = otpComplete;
    if (!otpComplete || wasComplete) return;
    // Forgot-password can't auto-verify: the server checks the code and sets
    // the new password in ONE call (there is no verify-only endpoint), so the
    // code alone isn't a complete request. Move to the password field instead —
    // that IS the next thing to do.
    if (mode === MODES.FORGOT) {
      document.getElementById('reset-new-password')?.focus();
      return;
    }
    runSignupVerifyRef.current(otpCode);
  }, [otpCode, otpComplete, mode, step, isLoading]);

  // ─── FORGOT-PASSWORD flow (with OTP) ──────────────────────────────────────
  const submitForgotStart = async (e) => {
    e.preventDefault();
    if (blockOnBadPhone()) return;
    const attempt = attemptRef.current + 1;
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      await startVerification();
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      handleError(err, 'কোড পাঠানো যায়নি। আবার চেষ্টা করুন।', 'Could not send the code. Please try again.');
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
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
    const attempt = attemptRef.current;
    setIsLoading(true); setErrorMsg(''); setInfoMsg(''); setOtpStatus('checking');
    try {
      const identity = await verifiedIdentity(otpCode);
      await resetPassword({ ...identity, newPassword });
      if (attempt !== attemptRef.current) return;
      setOtpStatus('success');
      switchMode(MODES.LOGIN);
      setInfoMsg(isBn
        ? 'পাসওয়ার্ড বদলে গেছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
        : 'Your password is changed. Log in with the new one.');
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      handleError(err, 'পাসওয়ার্ড বদলানো যায়নি। কোডটি দেখে আবার চেষ্টা করুন।', 'Could not change the password. Check the code and try again.');
      // Same rule as signup: red is reserved for a code the server actually
      // rejected, so a wrong code is visibly different from a weak password or
      // a rate limit — both of which leave the six digits alone.
      if (err?.code === 'otp_invalid' || err?.code === 'auth/invalid-verification-code') flagWrongOtp();
      else setOtpStatus('idle');
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
    }
  };

  // Re-request from the same start endpoint: Bangladesh gets a fresh texted
  // code; abroad gets a new challenge and a fresh Firebase SMS.
  const handleResend = async () => {
    if (resendIn > 0 || isLoading || otpLocked) return;
    const attempt = attemptRef.current + 1;
    setIsLoading(true); setErrorMsg(''); setInfoMsg('');
    try {
      if (!await startVerification({ resend: true })) return;
      focusOtpBox(0);
      setInfoMsg(isBn ? 'নতুন কোড পাঠানো হয়েছে।' : 'A new code is on its way.');
    } catch (err) {
      if (attempt !== attemptRef.current) return;
      handleError(err, 'কোড পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।', 'Could not send the code. Please try again in a moment.');
    } finally {
      if (attempt === attemptRef.current) setIsLoading(false);
    }
  };

  // ─── OTP box helpers (type / backspace / paste) ───────────────────────────
  // Any edit clears a previous red — the code on screen is no longer the code
  // the server rejected.
  const writeOtp = (next) => {
    cancelWrongTimer();
    setOtp(next);
    setOtpStatus((s) => (s === 'wrong' ? 'idle' : s));
  };

  const handleOtpChange = (index, value) => {
    if (isLoading || otpLocked) return;
    const digit = value.replace(/\D/g, '').slice(-1); // keep only the last digit typed
    if (value !== '' && digit === '') return;         // ignore non-numeric input
    const next = [...otp];
    next[index] = digit;
    writeOtp(next);
    if (digit && index < 5) focusOtpBox(index + 1);
  };

  /**
   * Backspace deletes one digit per press, wherever the caret happens to be.
   *
   * It used to delete nothing and only move focus back when the box was already
   * empty — so clearing a full code took two presses per box, and the first
   * press of each pair looked like the key was broken. People worked around it
   * by clicking box to box. We now own the key outright (preventDefault) rather
   * than half-owning it and letting the browser do the other half, which is
   * where the off-by-one came from: whether the native delete fired at all
   * depended on which side of the digit the caret had landed on.
   */
  const handleOtpKeyDown = (index, e) => {
    if (isLoading || otpLocked) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...otp];
      if (next[index]) {
        next[index] = '';          // clear this box, stay put
        writeOtp(next);
      } else if (index > 0) {
        next[index - 1] = '';      // already empty → clear the one before it
        writeOtp(next);
        focusOtpBox(index - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusOtpBox(index - 1);
    }
    if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusOtpBox(index + 1);
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    if (isLoading || otpLocked) return;
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i += 1) next[i] = digits[i];
    writeOtp(next);
    focusOtpBox(Math.min(digits.length, 5));
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
    // "/login" is in hideNavbarRoutes, so nothing above this reserves the status
    // bar — and h-screen + overflow-hidden means the login/signup form is sized
    // to the FULL screen including both system bars, putting the role picker
    // under the clock and the submit button under the gesture bar. Reserving
    // both insets here shrinks the box to the area we can actually use
    // (border-box, so h-screen minus the insets).
    <div
      className="h-screen w-full flex bg-[#f8f9fa] font-sans overflow-hidden"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div ref={recaptchaRef} id="auth-recaptcha" />
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
                      disabled={isLoading}
                      onClick={() => selectRole('tenant')}
                      className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${role === 'tenant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {L('Tenant', 'ভাড়াটিয়া')}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
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
                          disabled={isLoading}
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
                      {/* Country picker: a real <select> laid invisibly over the
                          flag and code. Closed, it is as compact as the old fixed
                          "+880"; open, it is the phone's own native list. */}
                      <div className="relative flex items-center gap-1 px-2 py-3 border-l border-gray-300 text-gray-600 font-bold text-sm">
                        <span aria-hidden="true">{phoneCountry.flag}</span>
                        <span>+{phoneCountry.dial}</span>
                        <ChevronDown size={12} aria-hidden="true" className="text-gray-400" />
                        <select
                          value={phoneCountry.iso}
                          disabled={isLoading}
                          onChange={(e) => pickCountry(findPhoneCountry(e.target.value))}
                          aria-label={L('Country', 'দেশ')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          {PHONE_COUNTRIES.map((c) => (
                            <option key={c.iso} value={c.iso}>
                              {`${c.flag} ${isBn ? c.bn : c.en} (+${c.dial})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        id="auth-phone"
                        type="tel"
                        value={formData.phone}
                        disabled={isLoading}
                        onChange={handlePhoneChange}
                        onBlur={() => setPhoneTouched(true)}
                        maxLength={20}
                        placeholder={phoneCountry.example}
                        inputMode="tel"
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
                            {phoneCountry.iso === 'BD'
                              ? L(
                                'Type the 10 digits after +880 (skip the first 0). We text your code here.',
                                '+৮৮০ এর পরের ১০টি সংখ্যা লিখুন (শুরুর ০ বাদ দিন)। এই নম্বরেই এসএমএসে কোড যাবে।'
                              )
                              : L(
                                `Type the number after +${phoneCountry.dial}, e.g. ${phoneCountry.example}. We text your code here.`,
                                `+${toBnDigits(phoneCountry.dial)} এর পরের নম্বরটি লিখুন, যেমন ${toBnDigits(phoneCountry.example)}। এই নম্বরেই এসএমএসে কোড যাবে।`
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
                          disabled={isLoading}
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
                        <PasswordRules
                          checks={signupPwChecks}
                          isBn={isBn}
                          title={L('Your password must have:', 'আপনার পাসওয়ার্ডে থাকতে হবে:')}
                        />
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
                  {verifiedFirebaseToken ? L('Your phone has been verified', 'আপনার ফোন যাচাই হয়েছে') : L('We sent a 6-digit code by SMS to', 'এই নম্বরে এসএমএসে ৬ সংখ্যার একটি কোড পাঠানো হয়েছে')} <br />
                  <span className="font-bold text-gray-800">+{phoneCountry.dial} {formData.phone}</span>
                </p>

                <form noValidate onSubmit={mode === MODES.FORGOT ? submitReset : submitSignupOtp} className="flex flex-col items-center">
                  <div
                    hidden={!!verifiedFirebaseToken}
                    className={`flex justify-center gap-2 sm:gap-4 mb-3 ${otpStatus === 'wrong' ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                    onPaste={handleOtpPaste}
                  >
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
                        onFocus={(e) => e.target.select()}
                        readOnly={isLoading || otpLocked || !!verifiedFirebaseToken}
                        aria-label={L(`Code digit ${index + 1}`, `কোডের ${index + 1} নম্বর সংখ্যা`)}
                        aria-invalid={otpStatus === 'wrong' ? 'true' : 'false'}
                        className={`w-10 h-12 sm:w-14 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl border-2 outline-none transition-all shadow-sm ${OTP_BOX_STYLES[otpStatus]}`}
                      />
                    ))}
                  </div>

                  {/* One line that always says where the code stands, right under
                      the boxes. The colour alone can't carry this — it is invisible
                      to a screen reader and to the ~8% of men here who won't read
                      red against green — so the state is written out too. */}
                  <div
                    className={`mb-4 h-5 flex items-center gap-1.5 text-xs font-bold ${OTP_STATUS_TEXT[otpStatus]}`}
                    aria-live="polite"
                  >
                    {otpStatus === 'checking' && (
                      <><Loader2 size={13} className="animate-spin" />{L('Checking your code…', 'কোড মিলিয়ে দেখছি…')}</>
                    )}
                    {otpStatus === 'success' && (
                      <><CheckCircle2 size={13} />{mode === MODES.FORGOT
                        ? L('Code accepted', 'কোড মিলে গেছে')
                        : L('Verified — signing you in', 'মিলে গেছে — লগইন করা হচ্ছে')}</>
                    )}
                    {otpStatus === 'wrong' && (
                      <><AlertCircle size={13} />{L('That code is not right', 'কোডটি ঠিক নয়')}</>
                    )}
                    {otpStatus === 'idle' && !otpComplete && (
                      <span className="text-gray-400">
                        {mode === MODES.FORGOT
                          ? L('Enter the 6 digits, then your new password', '৬ সংখ্যার কোড, তারপর নতুন পাসওয়ার্ড দিন')
                          : L('We check the code as soon as you finish typing', 'কোড লেখা শেষ হলেই আমরা নিজে থেকে মিলিয়ে নেবো')}
                      </span>
                    )}
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
                          id="reset-new-password"
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
                      <PasswordRules
                        checks={resetPwChecks}
                        isBn={isBn}
                        title={L('Your new password must have:', 'নতুন পাসওয়ার্ডে থাকতে হবে:')}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendIn > 0 || isLoading || otpLocked || !!verifiedFirebaseToken}
                    className="mb-4 text-xs font-bold text-gray-500 hover:text-brandRed transition-colors disabled:opacity-50"
                  >
                    {resendIn > 0
                      ? L(`You can ask for a new code in ${resendIn}s`, `${resendIn} সেকেন্ড পরে আবার কোড চাইতে পারবেন`)
                      : L("Didn't get the code? Send it again", 'কোড পাননি? আবার পাঠান')}
                  </button>

                  {/* The six boxes make an incomplete code self-evident, so
                      gating on that is fair. The password is NOT gated here —
                      submitReset names the unmet rule instead.
                      On signup this is now a fallback rather than the way
                      through — the code is checked the moment it's complete —
                      but it stays: Enter must still submit the form, and a
                      form whose only action is invisible is a worse form. */}
                  <button
                    type="submit"
                    disabled={isLoading || otpLocked || !otpComplete}
                    className={`w-full flex items-center justify-center gap-2 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_6px_15px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:hover:translate-y-0 ${otpStatus === 'success' ? 'bg-emerald-600' : 'bg-gray-900'}`}
                  >
                    {otpStatus === 'success' ? <><CheckCircle2 size={18} /> {L('Verified', 'মিলে গেছে')}</>
                      : isLoading ? <Loader2 className="animate-spin" size={18} />
                      : mode === MODES.FORGOT ? L('Save new password', 'নতুন পাসওয়ার্ড সেভ করুন')
                      : <><CheckCircle2 size={18} /> {L('Verify', 'যাচাই করুন')}</>}
                  </button>

                  <button
                    type="button"
                    disabled={otpLocked}
                    onClick={() => { clearVerification(); setStep(STEPS.FORM); resetOtp(); setNewPassword(''); setErrorMsg(''); }}
                    className="mt-4 text-sm font-bold text-gray-400 hover:text-brandRed transition-colors disabled:opacity-50"
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
        /* A wrong code moves, so it registers even before the colour is read. */
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
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
