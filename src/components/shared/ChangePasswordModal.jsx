/**
 * ChangePasswordModal — in-settings "Change / forgot password" flow.
 * ──────────────────────────────────────────────────────────────────────────
 * Reuses the backend's existing OTP reset endpoints so no server change is
 * needed:
 *
 *   1. On open → POST /auth/forgot-password { phoneNumber }  (texts a 6-digit OTP)
 *   2. User enters OTP + a new password
 *   3. POST /auth/reset-password { phoneNumber, otp, newPassword }
 *
 * The backend bumps `passwordChangedAt`, which invalidates the current session
 * token, so on success we ask the user to sign in again (handled by the parent
 * through `onSuccess`).
 *
 * Only works for phone-verified accounts — the backend only issues a reset OTP
 * when `phoneVerified === true`, so we guard the UI accordingly.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, ShieldCheck, KeyRound, Eye, EyeOff, Loader2, CheckCircle2,
  ArrowRight, RefreshCcw, Phone, AlertTriangle,
} from 'lucide-react';
import { forgotPassword, resetPassword } from '../../services/authService.js';

const RESEND_COOLDOWN_S = 45;

// user.phone is already stored E.164 — this is just a defensive normaliser.
const toE164 = (p) => {
  if (!p) return '';
  const s = String(p).trim();
  if (s.startsWith('+')) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.startsWith('880')) return `+${digits}`;
  if (digits.startsWith('0')) return `+880${digits.slice(1)}`;
  return `+${digits}`;
};

const passwordValid = (pw) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

const maskPhone = (p) => {
  const s = String(p || '');
  if (s.length < 5) return s;
  return `${s.slice(0, 5)}••••${s.slice(-2)}`;
};

const ChangePasswordModal = ({ open, onClose, phone, phoneVerified = false, bn = false, onSuccess }) => {
  const e164 = toE164(phone);

  const [step, setStep] = useState('otp'); // 'otp' | 'done'
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const inputsRef = useRef([]);

  // ── Reset everything whenever the modal (re)opens, then auto-send the OTP.
  const sendOtp = useCallback(async () => {
    if (!phoneVerified || !e164) return;
    setSending(true);
    setError('');
    try {
      await forgotPassword({ phoneNumber: e164 });
      setResendIn(RESEND_COOLDOWN_S);
    } catch {
      setError(bn ? 'কোড পাঠানো যায়নি। আবার চেষ্টা করুন।' : 'Could not send the code. Please try again.');
    } finally {
      setSending(false);
    }
  }, [e164, phoneVerified, bn]);

  useEffect(() => {
    if (!open) return;
    setStep('otp');
    setOtp(['', '', '', '', '', '']);
    setPw('');
    setPw2('');
    setShowPw(false);
    setError('');
    setResendIn(0);
    sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  // ── Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  // ── OTP box helpers ───────────────────────────────────────────────────────
  const handleOtpChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    if (val !== '' && digit === '') return;
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    setOtp(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const code = otp.join('');
  const otpComplete = code.length === 6;
  const pwOk = passwordValid(pw);
  const pwMatch = pw === pw2 && pw2.length > 0;
  const canSubmit = otpComplete && pwOk && pwMatch && !loading;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await resetPassword({ phoneNumber: e164, otp: code, newPassword: pw });
      setStep('done');
      toast.success(bn ? 'পাসওয়ার্ড পরিবর্তন হয়েছে।' : 'Password changed.');
    } catch (err) {
      const server = err?.serverMessage;
      const isOtp = err?.code === 'otp_invalid';
      setError(
        server
        || (isOtp
          ? (bn ? 'OTP ভুল বা মেয়াদ শেষ। আবার চেষ্টা করুন।' : 'The code is wrong or expired. Try again.')
          : (bn ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।' : 'Could not change the password.')),
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Shared button classes (nice pressed / focus feedback) ──────────────────
  const primaryBtn =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#ba0036] px-5 py-3 text-sm font-black text-white shadow-[0_6px_18px_-6px_rgba(186,0,54,0.6)] transition-all duration-150 hover:bg-[#a10030] active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#ba0036]/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none [-webkit-tap-highlight-color:transparent]';
  const ghostBtn =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 py-3 text-sm font-black text-gray-700 transition-all duration-150 hover:bg-gray-200 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 select-none [-webkit-tap-highlight-color:transparent]';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-tp-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose?.(); }}
    >
      <div className="w-full md:max-w-md bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl animate-tp-modal-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-rose-50 text-[#ba0036] flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-gray-900 tracking-tight truncate">
                {bn ? 'পাসওয়ার্ড পরিবর্তন' : 'Change password'}
              </h2>
              <p className="text-[11px] font-bold text-gray-400 truncate">
                {bn ? 'ফোনে পাঠানো কোড দিয়ে যাচাই' : 'Verify with a code sent to your phone'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            aria-label={bn ? 'বন্ধ করুন' : 'Close'}
            className="p-2 rounded-xl bg-gray-100 text-gray-600 transition-all duration-150 hover:bg-gray-200 active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300/60 [-webkit-tap-highlight-color:transparent]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* ── Not phone-verified: block the flow with guidance ───────────── */}
          {!phoneVerified ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-amber-900">
                  {bn ? 'আগে ফোন নম্বর যাচাই করুন' : 'Verify your phone first'}
                </p>
                <p className="text-xs font-bold text-amber-800 mt-1">
                  {bn
                    ? 'পাসওয়ার্ড পরিবর্তনের কোড শুধু যাচাইকৃত নম্বরে পাঠানো হয়।'
                    : 'A password reset code can only be sent to a verified phone number.'}
                </p>
              </div>
            </div>
          ) : step === 'done' ? (
            /* ── Success ──────────────────────────────────────────────────── */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-black text-gray-900">
                {bn ? 'পাসওয়ার্ড পরিবর্তন হয়েছে' : 'Password changed'}
              </h3>
              <p className="text-sm font-bold text-gray-500 mt-1 mb-6">
                {bn
                  ? 'নিরাপত্তার জন্য আবার লগইন করুন নতুন পাসওয়ার্ড দিয়ে।'
                  : 'For your security, please sign in again with your new password.'}
              </p>
              <button type="button" onClick={() => onSuccess?.()} className={`${primaryBtn} w-full`}>
                {bn ? 'আবার লগইন করুন' : 'Sign in again'} <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* ── OTP + new password ───────────────────────────────────────── */
            <form onSubmit={submit}>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 mb-4">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <p className="text-xs font-bold text-gray-500 truncate">
                  {bn ? 'কোড পাঠানো হয়েছে ' : 'Code sent to '}
                  <span className="text-gray-900 font-black">{maskPhone(e164)}</span>
                </p>
                {sending && <Loader2 size={14} className="text-gray-400 animate-spin ml-auto" />}
              </div>

              {/* OTP boxes */}
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {bn ? '৬-সংখ্যার কোড' : '6-digit code'}
              </label>
              <div className="flex items-center justify-between gap-2 mb-4" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    aria-label={`${bn ? 'কোড অঙ্ক' : 'Code digit'} ${i + 1}`}
                    className="w-11 h-12 md:w-12 md:h-14 text-center text-lg font-black text-gray-900 rounded-xl border-2 border-gray-200 bg-white transition-all duration-150 focus:outline-none focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/15"
                  />
                ))}
              </div>

              {/* New password */}
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {bn ? 'নতুন পাসওয়ার্ড' : 'New password'}
              </label>
              <div className="relative mb-1">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={bn ? 'নতুন পাসওয়ার্ড' : 'Enter a new password'}
                  autoComplete="new-password"
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-3.5 py-3 pr-11 text-sm font-bold text-gray-900 transition-all duration-150 focus:outline-none focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? (bn ? 'পাসওয়ার্ড লুকান' : 'Hide password') : (bn ? 'পাসওয়ার্ড দেখান' : 'Show password')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 transition-colors hover:text-gray-700 hover:bg-gray-100 active:scale-90 [-webkit-tap-highlight-color:transparent]"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className={`text-[11px] font-bold mb-3 ${pw.length === 0 || pwOk ? 'text-gray-400' : 'text-amber-600'}`}>
                {bn ? 'কমপক্ষে ৮ অক্ষর, একটি বর্ণ ও একটি সংখ্যা।' : 'At least 8 characters, with a letter and a number.'}
              </p>

              {/* Confirm password */}
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">
                {bn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm new password'}
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder={bn ? 'আবার লিখুন' : 'Re-enter the password'}
                autoComplete="new-password"
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-3.5 py-3 text-sm font-bold text-gray-900 transition-all duration-150 focus:outline-none focus:border-[#ba0036] focus:ring-4 focus:ring-[#ba0036]/15"
              />
              {pw2.length > 0 && !pwMatch && (
                <p className="text-[11px] font-bold text-red-500 mt-1.5">
                  {bn ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.'}
                </p>
              )}

              {error && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-bold text-red-600 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 flex flex-col gap-3">
                <button type="submit" disabled={!canSubmit} className={`${primaryBtn} w-full`}>
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" /> {bn ? 'পরিবর্তন হচ্ছে…' : 'Changing…'}</>
                    : <><ShieldCheck size={16} /> {bn ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change password'}</>}
                </button>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={resendIn > 0 || sending}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#ba0036] transition-colors hover:text-[#90002a] disabled:text-gray-400 disabled:cursor-not-allowed [-webkit-tap-highlight-color:transparent]"
                  >
                    <RefreshCcw size={13} className={sending ? 'animate-spin' : ''} />
                    {resendIn > 0
                      ? (bn ? `আবার পাঠান (${resendIn}s)` : `Resend code (${resendIn}s)`)
                      : (bn ? 'কোড আবার পাঠান' : 'Resend code')}
                  </button>
                  <button type="button" onClick={() => !loading && onClose?.()} className="text-xs font-black text-gray-400 hover:text-gray-600 [-webkit-tap-highlight-color:transparent]">
                    {bn ? 'বাতিল' : 'Cancel'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
