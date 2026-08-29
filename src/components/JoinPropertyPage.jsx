/*
 * JoinPropertyPage.jsx — /join/:token
 * ──────────────────────────────────────────────────────────────────────────
 * The tenant's half of self-onboarding: the screen a QR code opens.
 *
 * WHAT IT IS REPLACING
 * A landlord typing eleven fields and photographing an ID card, off a paper
 * form the tenant had already filled in by hand. Every one of those fields
 * belongs to the person standing in front of them, who is the only one who can
 * spell their own father's name correctly.
 *
 * THREE DECISIONS WORTH KNOWING ABOUT
 *
 * 1. THE WELCOME IS PUBLIC, THE FORM IS NOT.
 *    The link lands on a phone that may have no account. Putting a signup wall
 *    in front of "whose building is this?" is how a shared link dies in a group
 *    chat — so the building name, the host's name and the room list render
 *    logged out, and the login is asked for at the moment it starts to matter:
 *    when they commit to a room. Their choice survives the round-trip through
 *    sessionStorage, so they come back to where they were, not to step one.
 *
 * 2. THE FORM OBEYS tenantFields.js, NOT ITS OWN RULES.
 *    That file is explicit that every writer of a tenant record imports the
 *    same rulebook, because when the manual form and the AI scanner each had
 *    their own idea of "required" they drifted, and a tenant valid on one
 *    screen was rejected on another. This is the third writer. It imports.
 *
 * 3. আছে / নেই IS A COMPLETE ANSWER HERE TOO.
 *    A tenant with no NID can finish this form. That is the whole design of the
 *    underlying record, and a self-service version that quietly demanded an ID
 *    would lock out exactly the people the paper খাতা never did.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2, DoorOpen, User, Phone, Calendar, MapPin, Briefcase, IdCard, PhoneCall,
  Camera, Loader2, Check, AlertTriangle, ChevronRight, ChevronLeft, ShieldCheck, X, Clock,
  ArrowLeftRight, KeyRound,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { resolveInvite, submitOnboarding } from '../services/inviteService';
import { privateUpload } from '../services/cloudinaryUpload';
import {
  TENANT_TYPES, GOVT_ID_TYPES, MARITAL_STATUSES, HAS_STATUS,
  tenantTypeById, emptyTenantProfile, validateTenantProfile,
} from '../utils/tenantFields';

// Where a half-finished choice waits while the tenant goes and logs in.
const draftKey = (token) => `invite:draft:${token}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

// ── Presentational pieces ───────────────────────────────────────────────────
// These live at MODULE scope, not inside the component, and that is load-
// bearing rather than stylistic. A component defined inside a render body is a
// brand-new function on every render, so React treats it as a different type,
// unmounts the old tree and mounts a fresh one — which for a wrapper around an
// <input> means the field is destroyed and rebuilt on every keystroke, and the
// caret jumps out of it after each character. Hoisting them keeps the identity
// stable and the focus where the user put it.

const labelCls = 'block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5';
const inputCls = 'w-full px-3.5 py-3 rounded-xl border-2 border-gray-100 bg-white text-sm font-bold text-gray-900 placeholder:text-gray-300 placeholder:font-medium focus:border-gray-900 focus:outline-none transition-colors';

// The bottom padding is not decoration. MobileBottomNav is `fixed bottom-0`
// with a 64px bar (plus its own fade strip above it) and /join/:token is not in
// its hideOnRoutes list, so on a phone it floats over the last stretch of this
// page — which is exactly where every step of this flow puts its primary
// button. Ending the page above the bar keeps "পরবর্তী" reachable instead of
// hidden behind it. The bar is md:hidden, so the reserve is too.
const Shell = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <div className="max-w-lg mx-auto px-4 pt-6 sm:pt-10 pb-[calc(64px+env(safe-area-inset-bottom)+1.5rem)] md:pb-10">
      {children}
    </div>
  </div>
);

const Field = ({ label, Icon, children }) => (
  <div>
    <label className={`${labelCls} flex items-center gap-1`}>
      {Icon && <Icon size={11} className="text-gray-300" />} {label}
    </label>
    {children}
  </div>
);

const Section = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
      {subtitle && <p className="text-[10px] font-bold text-gray-300 mt-0.5 leading-relaxed">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// The আছে / নেই pair. Identical semantics to the landlord's form, because it
// writes the same fields into the same record.
const HasToggle = ({ isBn, value, onPick, clearKeys = [] }) => (
  <div className="grid grid-cols-2 gap-2">
    {[{ id: HAS_STATUS.HAS, bn: 'আছে', en: 'Yes' }, { id: HAS_STATUS.NONE, bn: 'নেই', en: 'No' }].map((opt) => {
      const on = value === opt.id;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onPick({
            status: opt.id,
            ...(opt.id === HAS_STATUS.NONE
              ? Object.fromEntries(clearKeys.map((k) => [k, '']))
              : {}),
          })}
          className={`px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
            on
              ? (opt.id === HAS_STATUS.HAS
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-gray-900 text-white border-gray-900')
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {on && <Check size={12} strokeWidth={3.5} className="shrink-0" />}
          {isBn ? opt.bn : opt.en}
        </button>
      );
    })}
  </div>
);

export default function JoinPropertyPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, activeRole, roles, addRole, setActiveRole } = useAuth();
  const { language } = useLanguage();
  const isBn = language === 'বাংলা';
  const L = (bn, en) => (isBn ? bn : en);

  const [invite, setInvite]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // 'select' → pick a room (universal link only) · 'form' → details · 'done'
  const [step, setStep] = useState('select');
  const [unitId, setUnitId] = useState('');
  const [form, setForm] = useState(() => ({ ...emptyTenantProfile(), moveInDate: todayIso() }));
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState('');
  const [result, setResult] = useState(null);
  const [switching, setSwitching] = useState(false);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // ── Landlord mode ─────────────────────────────────────────────────────────
  // This form writes a TENANT record. A landlord scanning a QR is a normal
  // thing to happen for two different reasons, and they need different answers:
  //
  //   • They are renting somewhere themselves. Half the landlords on this app
  //     also rent a flat, and the QR on their own landlord's wall is the whole
  //     point of the feature. They just have to be in tenant mode first, so
  //     the record lands on the right side of their account — hence a one-tap
  //     switch, in place, with nothing retyped afterwards.
  //   • It is their OWN building — almost always someone testing the code they
  //     just printed. submitOnboarding refuses this outright, so switching
  //     modes would walk them through an eleven-field form to a rejection at
  //     the end. Say it up front instead.
  const myId = String(user?.id || user?._id || '');
  const isOwnBuilding = !!(myId && invite?.hostId && String(invite.hostId) === myId);
  const isLandlordMode = isAuthenticated
    && (activeRole === 'landlord' || activeRole === 'host');

  // Grant the tenant role if this account has never held it, then activate it.
  // No navigation: `activeRole` flips, this component re-renders, and the gate
  // below gives way to the room picker / form with their draft intact. Mirrors
  // the Navbar pill and InquiryModal's landlord notice.
  const switchToTenant = async () => {
    if (switching) return;
    setSwitching(true);
    setError('');
    try {
      if (!(Array.isArray(roles) && roles.includes('tenant'))) await addRole?.('tenant');
      await setActiveRole?.('tenant');
    } catch (err) {
      setError(err?.message || L('মোড বদলানো গেল না। আবার চেষ্টা করুন।', 'Could not switch mode. Please try again.'));
    } finally {
      setSwitching(false);
    }
  };

  // ── Resolve the token ─────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await resolveInvite(token);
        if (!alive) return;
        setInvite(data);
        // A unit link has already decided the room; there is nothing to pick.
        if (data.scope === 'unit') {
          setUnitId(data.unit?.id || '');
          setStep('form');
        }
      } catch (err) {
        if (alive) setError(err.message || L('লিংকটি খোলা গেল না।', 'Could not open this link.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Restore anything left behind by a login round-trip ────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(token));
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.unitId) setUnitId(draft.unitId);
      if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
      if (draft.step) setStep(draft.step);
    } catch { /* a corrupt draft is not worth failing the page over */ }
  }, [token]);

  // Prefill from the account. Someone who is already signed in should not
  // retype the name and number the app knows.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setForm((prev) => ({
      ...prev,
      name:  prev.name  || user.name  || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [isAuthenticated, user]);

  const stash = useCallback((extra = {}) => {
    try {
      sessionStorage.setItem(draftKey(token), JSON.stringify({ unitId, form, step, ...extra }));
    } catch { /* private mode / quota — the draft is a convenience, not state */ }
  }, [token, unitId, form, step]);

  // The login gate. Called at the moment a room is chosen, not on arrival.
  const requireLogin = (nextStep) => {
    stash({ step: nextStep });
    navigate(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  };

  const rooms = invite?.rooms || [];
  const selectedRoom = useMemo(
    () => (invite?.scope === 'unit' ? invite.unit : rooms.find((r) => r.id === unitId)) || null,
    [invite, rooms, unitId],
  );

  const missing = useMemo(() => validateTenantProfile(form), [form]);
  const isMissing = (k) => touched && missing.includes(k);

  // ── Photo ─────────────────────────────────────────────────────────────────
  // Uploaded PRIVATELY (Cloudinary type:'authenticated'), the same handling the
  // landlord's intake photo and NID scans get: the raw URL is useless without a
  // signature, and the server only signs it for the landlord this submission
  // was addressed to.
  const handlePhoto = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError(L('ছবি ফাইল দিন', 'Please choose an image file'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(L('ছবি ৫ MB এর কম হতে হবে', 'Image must be under 5 MB'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const { secureUrl, publicId } = await privateUpload(file, { folder: 'tolet/tenant-photos' });
      set({ photoUrl: secureUrl, photoPublicId: publicId });
      setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    } catch {
      setError(L('ছবি আপলোড ব্যর্থ হয়েছে।', 'Photo upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async () => {
    setTouched(true);
    if (missing.length) {
      setError(L('লাল দাগ দেওয়া ঘরগুলো পূরণ করুন।', 'Please complete the highlighted fields.'));
      return;
    }
    if (!isAuthenticated) { requireLogin('form'); return; }
    if (!unitId) { setError(L('আপনার রুম নির্বাচন করুন।', 'Please select your room.')); return; }

    setSubmitting(true);
    setError('');
    try {
      const { name, phone, moveInDate, ...tenantProfile } = form;
      const onboarding = await submitOnboarding(token, {
        unitId, name, phone, moveInDate, tenantProfile,
      });
      setResult(onboarding);
      setStep('done');
      try { sessionStorage.removeItem(draftKey(token)); } catch { /* no-op */ }
    } catch (err) {
      setError(err.message || L('জমা দেওয়া যায়নি।', 'Could not submit.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Only errCls stays here: it closes over `touched` and the live validation
  // result, so unlike the pieces above it genuinely belongs to this render.
  const errCls = (k) => (isMissing(k) ? '!border-[#ba0036] bg-red-50/40' : '');

  // ── Loading / dead link ───────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="py-24 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={26} className="animate-spin" />
          <p className="text-[11px] font-black uppercase tracking-widest">
            {L('খোলা হচ্ছে', 'Opening')}
          </p>
        </div>
      </Shell>
    );
  }

  if (!invite) {
    return (
      <Shell>
        <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#ba0036] flex items-center justify-center mx-auto">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-black text-gray-900">
            {L('লিংকটি কাজ করছে না', 'This link is not working')}
          </h1>
          <p className="text-xs font-bold text-gray-500 leading-relaxed">
            {error || L('বাড়িওয়ালার কাছ থেকে নতুন লিংক নিন।', 'Ask your landlord for a new link.')}
          </p>
          <Link
            to="/"
            className="inline-block mt-1 px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black transition-colors"
          >
            {L('হোমে যান', 'Go home')}
          </Link>
        </div>
      </Shell>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    const pending = result?.status === 'pending';
    return (
      <Shell>
        <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center space-y-4">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto ${
            pending ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {pending ? <Clock size={30} /> : <Check size={30} strokeWidth={3} />}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-black text-gray-900 leading-tight">
              {pending
                ? L('তথ্য জমা হয়েছে', 'Details submitted')
                : L('আপনি যুক্ত হয়েছেন!', "You're connected!")}
            </h1>
            <p className="text-xs font-bold text-gray-500 leading-relaxed">
              {pending
                ? L(`${invite.buildingName} — রুম ${selectedRoom?.roomNumber || ''} · বাড়িওয়ালা অনুমোদন দিলেই আপনার ভাড়ার হিসাব দেখতে পাবেন। অনুমোদন হলে আপনাকে জানানো হবে।`,
                    `${invite.buildingName} — room ${selectedRoom?.roomNumber || ''}. Once your landlord approves, your rent details appear in your dashboard. We'll notify you.`)
                : L(`${invite.buildingName} — রুম ${selectedRoom?.roomNumber || ''} এ আপনি যুক্ত হয়ে গেছেন।`,
                    `You've joined ${invite.buildingName} — room ${selectedRoom?.roomNumber || ''}.`)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/tenant-dashboard')}
            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all"
          >
            {L('আমার ড্যাশবোর্ডে যান', 'Go to my dashboard')}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Header shared by the two working steps ────────────────────────────────
  const Header = () => (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#ba0036]/10 text-[#ba0036] shrink-0 flex items-center justify-center">
          <Building2 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {L('স্বাগতম', 'Welcome to')}
          </p>
          <h1 className="text-lg font-black text-gray-900 leading-tight truncate">{invite.buildingName}</h1>
          {invite.address && (
            <p className="text-[11px] font-bold text-gray-400 mt-0.5 truncate flex items-center gap-1">
              <MapPin size={10} /> {invite.address}
            </p>
          )}
          {invite.hostName && (
            <p className="text-[11px] font-bold text-gray-500 mt-1">
              {L('বাড়িওয়ালা: ', 'Landlord: ')}<span className="text-gray-900">{invite.hostName}</span>
            </p>
          )}
        </div>
      </div>

      {selectedRoom && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
          <DoorOpen size={14} className="text-blue-500 shrink-0" />
          <span className="text-xs font-black text-gray-900">
            {selectedRoom.floorLabel} · {L('রুম', 'Room')} {selectedRoom.roomNumber}
          </span>
          {invite.scope === 'building' && (
            <button
              type="button"
              onClick={() => { setStep('select'); setTouched(false); }}
              className="ml-auto text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
            >
              {L('বদলান', 'Change')}
            </button>
          )}
        </div>
      )}
    </div>
  );

  const ErrorBar = () => (error ? (
    <div className="rounded-2xl bg-red-50 border border-red-100 p-3.5 flex items-start gap-2.5 mb-4">
      <AlertTriangle size={15} className="text-[#ba0036] shrink-0 mt-0.5" />
      <p className="text-xs font-bold text-red-900 leading-relaxed flex-1">{error}</p>
      <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-[#ba0036]">
        <X size={14} />
      </button>
    </div>
  ) : null);

  // ── Gate: their own building ──────────────────────────────────────────────
  // Checked before the mode gate, because switching to tenant mode does not
  // help here — the server refuses either way.
  if (isOwnBuilding) {
    return (
      <Shell>
        <Header />
        <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <KeyRound size={28} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-gray-900 leading-tight">
              {L('এটি আপনার নিজের বিল্ডিং', 'This is your own building')}
            </h2>
            <p className="text-xs font-bold text-gray-500 leading-relaxed">
              {L('আপনার QR / লিংক ঠিকঠাক কাজ করছে। আপনার ভাড়াটিয়ারা এটি স্ক্যান করে নিজেরাই তথ্য পূরণ করতে পারবেন — আপনি নিজে ভাড়াটিয়া হিসেবে যুক্ত হতে পারবেন না।',
                 "Your QR / link is working. Your tenants can scan this and fill in their own details — you can't join your own building as a tenant.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/host-dashboard?tab=bookings')}
            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all"
          >
            {L('ভাড়াটিয়াদের তালিকায় যান', 'Go to my tenants')}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Gate: landlord mode ───────────────────────────────────────────────────
  // One tap, no navigation, nothing retyped. See switchToTenant() above.
  if (isLandlordMode) {
    return (
      <Shell>
        <Header />
        <ErrorBar />
        <div className="bg-white rounded-3xl border border-gray-100 p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[#ba0036]/10 text-[#ba0036] flex items-center justify-center mx-auto">
            <ArrowLeftRight size={26} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-gray-900 leading-tight">
              {L('আপনি এখন বাড়িওয়ালা মোডে আছেন', "You're in landlord mode")}
            </h2>
            <p className="text-xs font-bold text-gray-500 leading-relaxed">
              {L('এই ফর্মটি ভাড়াটিয়ার তথ্য জমা দেয়। ভাড়াটিয়া মোডে গেলে আপনি নিজের তথ্য পূরণ করে এই বাড়িতে যুক্ত হতে পারবেন। আপনার বাড়িওয়ালার হিসাব আগের মতোই থাকবে।',
                 'This form submits a tenant’s details. Switch to tenant mode and you can fill in your own and join this property. Your landlord account stays exactly as it is.')}
            </p>
          </div>
          <button
            type="button"
            onClick={switchToTenant}
            disabled={switching}
            className="w-full py-3.5 rounded-xl bg-[#ba0036] text-white font-black text-[11px] uppercase tracking-widest hover:bg-[#9a002d] active:scale-[0.99] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {switching
              ? <Loader2 size={14} className="animate-spin" />
              : <ArrowLeftRight size={14} />}
            {switching
              ? L('বদলানো হচ্ছে…', 'Switching…')
              : L('ভাড়াটিয়া মোডে যান', 'Switch to tenant mode')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/host-dashboard')}
            className="w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
          >
            {L('বাতিল করুন', 'Not now')}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Step: pick a room (universal link only) ───────────────────────────────
  if (step === 'select') {
    return (
      <Shell>
        <Header />
        <ErrorBar />
        <div className="bg-white rounded-3xl border border-gray-100 p-5 space-y-3">
          <div>
            <h2 className="text-sm font-black text-gray-900">
              {L('আপনার রুম / ফ্ল্যাট বেছে নিন', 'Select your room / flat')}
            </h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5 leading-relaxed">
              {L('আপনি যেখানে থাকেন সেটি বেছে নিন। বাড়িওয়ালা যাচাই করে অনুমোদন দেবেন।',
                 'Pick where you live. Your landlord will check and approve it.')}
            </p>
          </div>

          {rooms.length === 0 && (
            <p className="text-xs font-bold text-gray-400 py-6 text-center">
              {L('এই বিল্ডিংয়ে এখনো কোনো রুম যোগ করা হয়নি।', 'No rooms have been added to this building yet.')}
            </p>
          )}

          <div className="space-y-2 max-h-[45vh] overflow-y-auto -mx-1 px-1">
            {rooms.map((r) => {
              const on = unitId === r.id;
              // A full room is still selectable. The landlord may be about to
              // free a seat, and the person standing in the room knows better
              // than the seat count does — but they are told, so a wrong pick
              // is an informed one.
              const full = r.free <= 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setUnitId(r.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.99] flex items-center gap-3 ${
                    on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}
                >
                  <DoorOpen size={16} className={on ? 'text-white/70' : 'text-gray-300'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black leading-tight">
                      {L('রুম', 'Room')} {r.roomNumber}
                    </p>
                    <p className={`text-[10px] font-bold mt-0.5 ${on ? 'text-white/60' : 'text-gray-400'}`}>
                      {r.floorLabel}
                      {r.capacity > 1 && ` · ${r.free}/${r.capacity} ${L('সিট খালি', 'seats free')}`}
                    </p>
                  </div>
                  {full && (
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      on ? 'bg-white/15 text-white/80' : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {L('পূর্ণ', 'Full')}
                    </span>
                  )}
                  {on && <Check size={16} strokeWidth={3} className="shrink-0" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!unitId}
            onClick={() => {
              if (!isAuthenticated) { requireLogin('form'); return; }
              setStep('form');
              setError('');
            }}
            className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-black active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          >
            {L('পরবর্তী', 'Continue')} <ChevronRight size={14} />
          </button>

          {!isAuthenticated && (
            <p className="text-[10px] font-bold text-gray-400 text-center leading-relaxed">
              {L('পরের ধাপে লগইন করতে হবে — যাতে আপনার ভাড়ার হিসাব আপনার নিজের অ্যাকাউন্টে থাকে।',
                 "You'll sign in on the next step, so your rent records live in your own account.")}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ── Step: the form ────────────────────────────────────────────────────────
  const type = tenantTypeById(form.tenantType);
  const photoSrc = localPreview || form.photoUrl || '';

  return (
    <Shell>
      <Header />
      <ErrorBar />

      {invite.needsApproval && (
        <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-3.5 mb-4 flex items-start gap-2.5">
          <ShieldCheck size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
            {L('আপনার তথ্য বাড়িওয়ালার অনুমোদনের পরে যুক্ত হবে।',
               "Your details go to your landlord for approval before you're added.")}
          </p>
        </div>
      )}

      <div className="space-y-3">

        <Section
          title={L('আবশ্যক তথ্য', 'Required')}
          subtitle={L('শুধু এই তিনটি ঘর অবশ্যই পূরণ করতে হবে।', 'Only these three fields are required.')}
        >
          <Field label={L('আপনার পূর্ণ নাম', 'Your full name')} Icon={User}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={L('যেমন: আশরাফ আলম', 'e.g. Asraf Alom')}
              className={`${inputCls} ${errCls('name')}`}
            />
          </Field>
          <Field label={L('মোবাইল নম্বর', 'Mobile number')} Icon={Phone}>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="01XXXXXXXXX"
              className={`${inputCls} ${errCls('phone')}`}
            />
          </Field>
          <Field label={L('কবে থেকে থাকছেন', 'Move-in date')} Icon={Calendar}>
            <input
              type="date"
              value={form.moveInDate}
              onChange={(e) => set({ moveInDate: e.target.value })}
              className={`${inputCls} ${errCls('moveInDate')}`}
            />
          </Field>
        </Section>

        <Section title={L('আপনার ছবি', 'Your photo')}>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-300">
              {photoSrc ? <img src={photoSrc} alt="" className="w-full h-full object-cover" /> : <User size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 active:scale-[0.98] transition-all cursor-pointer">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                {photoSrc ? L('ছবি বদলান', 'Change photo') : L('ছবি দিন', 'Add photo')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
              </label>
              <p className="text-[10px] font-bold text-gray-300 mt-1.5 leading-relaxed">
                {L('ছবিটি শুধু আপনার বাড়িওয়ালা দেখতে পাবেন।', 'Only your landlord can see this photo.')}
              </p>
            </div>
          </div>
        </Section>

        <Section title={L('ব্যক্তিগত তথ্য', 'Personal details')} subtitle={L('ঐচ্ছিক', 'Optional')}>
          <Field label={L('পিতার নাম', "Father's name")}>
            <input type="text" value={form.fatherName} onChange={(e) => set({ fatherName: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={L('জন্ম তারিখ', 'Date of birth')}>
              <input type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} className={inputCls} />
            </Field>
            <Field label={L('বৈবাহিক অবস্থা', 'Marital status')}>
              <select value={form.maritalStatus} onChange={(e) => set({ maritalStatus: e.target.value })} className={inputCls}>
                <option value="">{L('নির্বাচন করুন', 'Select')}</option>
                {MARITAL_STATUSES.map((m) => (
                  <option key={m.id} value={m.id}>{isBn ? m.bn : m.en}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={L('স্থায়ী ঠিকানা', 'Permanent address')} Icon={MapPin}>
            <textarea
              rows={2}
              value={form.permanentAddress}
              onChange={(e) => set({ permanentAddress: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        <Section title={L('পেশা', 'Profession')} subtitle={L('ঐচ্ছিক', 'Optional')}>
          <Field label={L('আপনি কী করেন', 'What do you do')} Icon={Briefcase}>
            <select
              value={form.tenantType}
              onChange={(e) => set({ tenantType: e.target.value, tenantTypeOther: '' })}
              className={inputCls}
            >
              <option value="">{L('নির্বাচন করুন', 'Select')}</option>
              {TENANT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{isBn ? t.bn : t.en}</option>
              ))}
            </select>
          </Field>

          {type?.showCustomLabel && (
            <Field label={L('আপনার পেশা লিখুন', 'Write your profession')}>
              <input
                type="text"
                value={form.tenantTypeOther}
                onChange={(e) => set({ tenantTypeOther: e.target.value })}
                className={`${inputCls} ${errCls('tenantTypeOther')}`}
              />
            </Field>
          )}

          {type && (
            <>
              <Field label={isBn ? type.orgLabel.bn : type.orgLabel.en}>
                <input type="text" value={form.organization} onChange={(e) => set({ organization: e.target.value })} className={inputCls} />
              </Field>
              {type.showDepartment && (
                <Field label={L('ডিপার্টমেন্ট', 'Department')}>
                  <input type="text" value={form.department} onChange={(e) => set({ department: e.target.value })} className={inputCls} />
                </Field>
              )}
              <Field label={`${isBn ? type.idLabel.bn : type.idLabel.en} ${L('আছে?', 'available?')}`}>
                <HasToggle
                  isBn={isBn}
                  value={form.professionalIdStatus}
                  clearKeys={['professionalIdNumber']}
                  onPick={({ status, ...clear }) => set({ professionalIdStatus: status, ...clear })}
                />
              </Field>
              {form.professionalIdStatus === HAS_STATUS.HAS && (
                <Field label={isBn ? type.idLabel.bn : type.idLabel.en}>
                  <input
                    type="text"
                    value={form.professionalIdNumber}
                    onChange={(e) => set({ professionalIdNumber: e.target.value })}
                    className={`${inputCls} ${errCls('professionalIdNumber')}`}
                  />
                </Field>
              )}
            </>
          )}
        </Section>

        {/* NID / passport. Gated entirely on আছে / নেই — "নেই" finishes the
            question, it does not defer it. */}
        <Section title={L('পরিচয়পত্র', 'Identity document')} subtitle={L('ঐচ্ছিক', 'Optional')}>
          <Field label={L('NID বা পাসপোর্ট আছে?', 'Do you have an NID or passport?')} Icon={IdCard}>
            <HasToggle
              isBn={isBn}
              value={form.govtIdStatus}
              clearKeys={['govtIdType', 'govtIdNumber']}
              onPick={({ status, ...clear }) => set({ govtIdStatus: status, ...clear })}
            />
          </Field>
          {form.govtIdStatus === HAS_STATUS.HAS && (
            <>
              <Field label={L('কোনটি', 'Which one')}>
                <select
                  value={form.govtIdType}
                  onChange={(e) => set({ govtIdType: e.target.value })}
                  className={`${inputCls} ${errCls('govtIdType')}`}
                >
                  <option value="">{L('নির্বাচন করুন', 'Select')}</option>
                  {GOVT_ID_TYPES.map((g) => (
                    <option key={g.id} value={g.id}>{isBn ? g.bn : g.en}</option>
                  ))}
                </select>
              </Field>
              <Field label={L('নম্বর', 'Number')}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.govtIdNumber}
                  onChange={(e) => set({ govtIdNumber: e.target.value })}
                  className={`${inputCls} ${errCls('govtIdNumber')}`}
                />
              </Field>
            </>
          )}
        </Section>

        <Section
          title={L('জরুরি যোগাযোগ', 'Emergency contact')}
          subtitle={L('বিপদে কাকে ফোন করা হবে', 'Who to call in an emergency')}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={L('নাম', 'Name')} Icon={PhoneCall}>
              <input type="text" value={form.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} className={inputCls} />
            </Field>
            <Field label={L('সম্পর্ক', 'Relation')}>
              <input
                type="text"
                value={form.emergencyRelation}
                onChange={(e) => set({ emergencyRelation: e.target.value })}
                placeholder={L('যেমন: পিতা', 'e.g. Father')}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label={L('মোবাইল নম্বর', 'Mobile number')}>
            <input
              type="tel"
              inputMode="numeric"
              value={form.emergencyPhone}
              onChange={(e) => set({ emergencyPhone: e.target.value })}
              placeholder="01XXXXXXXXX"
              className={`${inputCls} ${errCls('emergencyPhone')}`}
            />
          </Field>
          <Field label={L('ঠিকানা', 'Address')}>
            <textarea
              rows={2}
              value={form.emergencyAddress}
              onChange={(e) => set({ emergencyAddress: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </Section>

        <div className="flex items-center gap-2">
          {invite.scope === 'building' && (
            <button
              type="button"
              onClick={() => { setStep('select'); setError(''); }}
              className="shrink-0 px-4 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-500 font-black text-[11px] uppercase tracking-widest hover:border-gray-900 hover:text-gray-900 active:scale-[0.98] transition-all inline-flex items-center gap-1"
            >
              <ChevronLeft size={14} /> {L('পেছনে', 'Back')}
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || uploading}
            className="flex-1 py-3.5 rounded-xl bg-[#ba0036] text-white font-black text-[11px] uppercase tracking-widest hover:bg-[#9a002d] active:scale-[0.99] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
            {isAuthenticated
              ? L('প্রপার্টিতে যুক্ত হোন', 'Connect to property')
              : L('লগইন করে জমা দিন', 'Sign in and submit')}
          </button>
        </div>
      </div>
    </Shell>
  );
}
