import { countryFromInternational, toNationalNumber, toE164, DEFAULT_PHONE_COUNTRY } from '../constants/phoneCountries.js';

/**
 * validators.js
 * ─────────────────────────────────────────────────────────────────────────
 * One validator per field type. Each returns { ok, msg } where:
 *   ok  : boolean
 *   msg : { bn, en } — i18n-ready error message
 *
 * Centralising validators means a phone-format change is one edit, not 15.
 * The companion `useValidation` hook implements the Stripe-style state
 * machine (pristine → editing → invalid/valid → fixing).
 */

/**
 * Reduce anything a BD user might realistically type into the bare 10-digit
 * national part of a mobile number. All of these become `1712345678`:
 *   `+8801712345678` · `8801712345678` · `01712345678` · `1712345678`
 *   `+880 1712-345678` (spaces / hyphens are stripped)
 */
export function toBdNationalPhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.startsWith('880')) digits = digits.slice(3);
  // A national part always begins with 1, so stripping leading zeros can
  // never eat a meaningful digit.
  return digits.replace(/^0+/, '');
}

/** Bangladesh-only helper retained for explicitly domestic fields. */
export const BD_MOBILE_NATIONAL_RE = /^1[3-9]\d{8}$/;

export function isBdMobile(v) {
  return BD_MOBILE_NATIONAL_RE.test(toBdNationalPhone(v));
}

/**
 * Shared contact fields have no country picker: international numbers must
 * include +/00 and a listed country code. Unprefixed legacy inputs mean BD.
 * Return a canonical identity, never a suffix shared by several countries.
 */
export function normalizeMobilePhone(value) {
  const raw = String(value || '').trim();
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  const international = /^(\+|00)/.test(raw);
  const country = international ? countryFromInternational(raw) : DEFAULT_PHONE_COUNTRY;
  if (!country) return null;
  const national = toNationalNumber(raw, country);
  return country.mobile.test(national) ? toE164(national, country) : null;
}

export const isSupportedMobile = (value) => normalizeMobilePhone(value) !== null;

/**
 * Password rules, mirrored 1:1 from the backend
 * (tolet-pro-backend/validators/auth.validators.js → passwordSchema):
 * 8-128 chars, at least one ASCII letter, at least one ASCII digit.
 *
 * Both regexes are ASCII-only and unicode-flag-free on the server too, so
 * Bengali letters and Bengali numerals (০-৯) do NOT satisfy them — the UI has
 * to say so out loud. There is no uppercase or symbol rule; inventing one here
 * would reject passwords the server accepts.
 */
export function passwordChecks(v) {
  const s = String(v || '');
  return {
    minLength: s.length >= 8 && s.length <= 128,
    letter: /[A-Za-z]/.test(s),
    digit: /\d/.test(s),
  };
}

export function isStrongEnoughPassword(v) {
  const c = passwordChecks(v);
  return c.minLength && c.letter && c.digit;
}

export const validators = {
  // Listed international mobiles, plus existing Bangladesh input formats.
  phone: (v) => ({
    ok: isSupportedMobile(v),
    msg: {
      bn: 'সঠিক মোবাইল নম্বর দিন। বিদেশি নম্বরে দেশের কোড দিন, যেমন +6581234567',
      en: 'Enter a valid mobile number. Include the country code for international numbers, e.g. +6581234567',
    },
  }),

  // Account password — matches the backend rules exactly.
  password: (v) => {
    const c = passwordChecks(v);
    return {
      ok: c.minLength && c.letter && c.digit,
      msg: {
        bn: 'পাসওয়ার্ডে অন্তত ৮টি অক্ষর, একটি ইংরেজি অক্ষর ও একটি সংখ্যা থাকতে হবে',
        en: 'Password needs at least 8 characters, one English letter and one number',
      },
    };
  },

  // Generic non-empty text 2–80 chars (workplace, employer name, etc.).
  workPlace: (v) => {
    const t = String(v || '').trim();
    return {
      ok: t.length >= 2 && t.length <= 80,
      msg: {
        bn: 'কমপক্ষে ২ অক্ষর লিখুন',
        en: 'At least 2 characters',
      },
    };
  },

  // Person's name — supports any unicode letter (Bengali, Arabic etc.),
  // spaces, dots, apostrophes, hyphens. 2–80 chars.
  name: (v) => {
    const t = String(v || '').trim();
    return {
      ok: /^[\p{L}\s.'-]{2,80}$/u.test(t),
      msg: {
        bn: 'বৈধ নাম লিখুন (২-৮০ অক্ষর)',
        en: 'Enter a valid name (2–80 characters)',
      },
    };
  },

  // Optional email — empty is OK, but if filled must look like an email.
  email: (v) => {
    const t = String(v || '').trim();
    if (!t) return { ok: true,  msg: { bn: '', en: '' } };
    return {
      ok: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t),
      msg: { bn: 'বৈধ ইমেইল ঠিকানা দিন', en: 'Enter a valid email' },
    };
  },

  // Service charge — non-negative integer up to 1 lakh.
  serviceCharge: (v) => {
    if (v === '' || v == null) return { ok: true, msg: { bn: '', en: '' } };
    const n = Number(v);
    return {
      ok: !Number.isNaN(n) && Number.isFinite(n) && n >= 0 && n <= 100000,
      msg: {
        bn: '০ থেকে ১,০০,০০০ টাকার মধ্যে দিন',
        en: 'Between 0 and 100,000 BDT',
      },
    };
  },

  // Currency / rent — non-negative integer up to 10 lakh.
  rent: (v) => {
    if (v === '' || v == null) return { ok: false, msg: { bn: 'ভাড়ার অঙ্ক দিন', en: 'Enter the rent amount' } };
    const n = Number(v);
    return {
      ok: !Number.isNaN(n) && n > 0 && n <= 1_000_000,
      msg: {
        bn: '১ থেকে ১০ লাখ টাকার মধ্যে দিন',
        en: 'Between 1 and 10 lakh BDT',
      },
    };
  },
};

/**
 * useValidation — Stripe-style state machine for a single field.
 *
 * States:
 *   'pristine'  — never touched, no UI feedback (don't show errors yet)
 *   'editing'   — user is typing, suppress error chatter
 *   'invalid'   — blurred with bad value → show red border + msg
 *   'valid'     — blurred with good value → show green check
 *   'fixing'    — previously invalid, user typing again → no error until next blur
 *
 * Usage:
 *   const { state, msg, onFocus, onBlur, onChange } = useValidation(value, validators.phone, language);
 *   <input value={value} onFocus={onFocus} onBlur={onBlur} onChange={(e) => { onChange(e.target.value); setValue(e.target.value); }} />
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export function useValidation(value, validator, language = 'বাংলা') {
  const [state, setState] = useState('pristine');
  const isBn = language === 'বাংলা';

  // Run validation on demand. We never validate on every keystroke — that
  // hammers the validator AND nags the user mid-typing. Only on blur.
  const validate = useCallback(() => {
    if (!validator) return { ok: true, msg: { bn: '', en: '' } };
    const t = typeof value === 'string' ? value : String(value ?? '');
    if (!t.trim()) {
      // Empty fields stay pristine — let the parent decide if empty is OK.
      return { ok: true, msg: { bn: '', en: '' }, empty: true };
    }
    return validator(t);
  }, [value, validator]);

  const onFocus = useCallback(() => {
    setState((s) => (s === 'invalid' ? 'fixing' : s === 'pristine' ? 'editing' : s));
  }, []);

  const onBlur = useCallback(() => {
    const r = validate();
    if (r.empty) return setState('pristine');
    setState(r.ok ? 'valid' : 'invalid');
  }, [validate]);

  // Optional change handler — flips an invalid field into "fixing" the
  // moment the user changes anything, hiding the error until next blur.
  const onChange = useCallback(() => {
    setState((s) => (s === 'invalid' ? 'fixing' : s === 'pristine' ? 'editing' : s));
  }, []);

  // Imperative reset (e.g. after a successful save we want to clear state).
  const reset = useCallback(() => setState('pristine'), []);

  const msg = (() => {
    if (state !== 'invalid') return '';
    const r = validate();
    return r.msg[isBn ? 'bn' : 'en'] || r.msg.en;
  })();

  return { state, msg, onFocus, onBlur, onChange, reset, validate };
}

/**
 * useDebounced — utility for autocomplete inputs.
 * Returns a debounced copy of `value` that only updates after `delay` ms
 * of quiet typing. 150ms is the sweet spot for autocomplete — fast enough
 * to feel instant, slow enough to not run the search on every keystroke.
 */
export function useDebounced(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}