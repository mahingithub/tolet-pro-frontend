/**
 * TenantProfile — public trust card for a tenant.
 *
 * Mirrors LandlordProfile.jsx in structure (cover → avatar → identity →
 * stats grid → bio → trust+verification). Three views are returned by the
 * backend (`GET /api/tenants/:id`) depending on who is asking:
 *
 *   • anonymous / non-landlord caller → "public" view:
 *       name, avatar, cover, bio, trust score, verification badges
 *       (no phone, no email, no employment specifics)
 *
 *   • landlord with an active inquiry/booking → "unlocked" view:
 *       everything above + phone, email, employmentVerified, references
 *
 *   • the tenant themselves → "self" view:
 *       same as unlocked (no need to hide their own data)
 *
 * The page never branches on "shape" — the backend always returns the same
 * keys, and missing-because-locked fields come back as null. The "Locked"
 * chip on contact rows is driven by `tenant.unlocked === false`.
 *
 * Roadmap-v2 / tenant-roadmap §T3 — privacy-gated contact unlock.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, MessageCircle, Phone, Mail,
  Calendar, Briefcase, ShieldCheck, Share2, Lock, Award,
  Wallet, Receipt, Banknote, CheckCircle2, Clock, Home,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { tenantService } from '../services/tenantService';
import { listHostBookings } from '../services/bookingService';
import { useAuth } from '../context/AuthContext.jsx';
import TrustGauge from './shared/TrustGauge';
import VerifStep  from './shared/VerifStep';

// ── Payment helpers (module scope, pure) ────────────────────────────────────
const bdt = (n) => `৳ ${(Number(n) || 0).toLocaleString('en-IN')}`;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthKeyLabel = (key) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  if (!m) return String(key || '');
  return `${MONTHS_SHORT[Number(m[2]) - 1] || '?'} ${m[1]}`;
};
const prettyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const TenantProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [tenant, setTenant]   = useState(null);
  const [loading, setLoading] = useState(true);
  // Bookings this host holds for the tenant — powers the Payment section.
  const [tenantBookings, setTenantBookings] = useState([]);

  // `isSelf` — viewer তার নিজেরই profile দেখছে কিনা।
  const isSelf =
    !!authUser &&
    (String(authUser.id) === String(id) || String(authUser._id) === String(id));

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    (async () => {
      setLoading(true);
      const t = await tenantService.getTenant(id);
      if (!cancelled) {
        setTenant(t || null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Load the host's bookings for THIS tenant (Payment section) ────────────
  // listHostBookings returns bookings the signed-in landlord owns; we keep only
  // the ones for this tenant (by linked user id, or phone as a fallback for
  // manual bookings). A random viewer / the tenant themselves gets nothing here,
  // so the section only shows to the host who actually created the booking.
  useEffect(() => {
    if (!authUser || isSelf) { setTenantBookings([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listHostBookings();
        if (cancelled) return;
        const tenantPhone = tenant?.phone ? String(tenant.phone).replace(/\D/g, '') : '';
        const mine = (rows || []).filter((b) => {
          if (b.status === 'cancelled') return false;
          const byId = b.tenantId && String(b.tenantId) === String(id);
          const byPhone = tenantPhone && b.tenantPhone && String(b.tenantPhone).replace(/\D/g, '') === tenantPhone;
          return byId || byPhone;
        });
        setTenantBookings(mine);
      } catch (err) {
        if (!cancelled) setTenantBookings([]);
        console.warn('[tenant-profile] booking load failed:', err?.message || err);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, isSelf, id, tenant?.phone]);

  useEffect(() => {
    if (!isSelf || !authUser || !tenant) return;
    setTenant((prev) => {
      if (!prev) return prev;
      const same =
        prev.avatar === (authUser.avatar || prev.avatar) &&
        prev.name   === (authUser.name   || authUser.fullName || prev.name);
      if (same) return prev;
      return {
        ...prev,
        avatar: authUser.avatar || prev.avatar,
        name:   authUser.name || authUser.fullName || prev.name,
        phone:  authUser.phone || prev.phone,
        email:  authUser.email || prev.email,
      };
    });
  }, [isSelf, authUser, tenant?.id]);

  if (loading) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-600 text-sm font-semibold">Loading tenant…</p>
        </div>
      </div>
    );
  }

  if (!id || !tenant) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl shadow-blue-500/5 border border-gray-100">
          <h2 className="text-2xl font-black text-slate-900 mb-2">Tenant not found</h2>
          <p className="text-sm text-slate-600 mb-6">
            This tenant profile is unavailable or has been removed.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-full bg-blue-500 text-white text-sm font-black hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95"
          >
            Go back
          </button>
        </motion.div>
      </div>
    );
  }

  const coverImage  = tenant.coverImage  || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2000';
  const avatar      = tenant.avatar      || `https://ui-avatars.com/api/?name=${encodeURIComponent(tenant.name || 'Tenant')}&background=dbeafe&color=2563eb&size=256`;
  const tagline     = tenant.tagline     || '';
  const bio         = tenant.bio         || '';
  const memberSince = tenant.memberSince || new Date().getFullYear().toString();
  const trustScore  = tenant.trustScore  ?? 0;
  const trustTier   = tenant.trustTier   || '';
  const verif       = tenant.verification || {};

  const phoneStatus =
    verif.phoneVerified === true ||
    tenant.phoneVerified === true ||
    !!tenant.phone ||
    !!(tenant.id || tenant._id)
      ? 'verified'
      : 'unverified';

  const hasEmail   = !!(tenant.email || verif.email);
  const emailStatus = verif.emailVerified === true
    ? 'verified'
    : (hasEmail ? 'unverified' : 'none');

  const idStatus =
    verif.idStatus
    || verif.status
    || (verif.idVerified ? 'verified' : 'unverified');

  const employmentStatus =
    verif.employmentStatus
    || (verif.employmentVerified ? 'verified' : 'unverified');

  const isNewTenant = !!tenant.isNew;
  const isUnlocked = tenant.unlocked === true;
  const phone = isUnlocked ? (tenant.phone || '') : '';
  const email = isUnlocked ? (tenant.email || '') : '';
  const professionDetails = isUnlocked ? (tenant.professionDetails || {}) : {};
  const emergencyContact  = isUnlocked ? (tenant.emergencyContact || {}) : {};
  const familySize        = isUnlocked ? (tenant.familySize || '') : '';

  // Achievement badges shown under the tenant's name. The backend has no
  // explicit `badges` array, so we derive one from the verification + trust
  // signals it does return. Previously this variable was referenced but never
  // defined, which threw a ReferenceError and tripped the global ErrorBoundary
  // ("Something went wrong") the moment a verified/new tenant profile opened.
  const badges = Array.isArray(tenant.badges)
    ? tenant.badges
    : (() => {
        const out = [];
        if (idStatus === 'verified') out.push('ID Verified');
        if (phoneStatus === 'verified') out.push('Phone Verified');
        if (emailStatus === 'verified') out.push('Email Verified');
        if (employmentStatus === 'verified') out.push('Employment Verified');
        if (trustTier && !/^bronze$/i.test(trustTier)) {
          out.push(`${trustTier.charAt(0).toUpperCase()}${trustTier.slice(1)} Tenant`);
        }
        return out;
      })();

  // ── Payment summary — derived from the host's bookings for this tenant. ────
  // Auto-updates whenever a booking is created (the Payment section re-reads
  // listHostBookings). Each paid/partial ledger month becomes a receipt row.
  const paymentBookings = Array.isArray(tenantBookings) ? tenantBookings : [];
  const paymentReceipts = paymentBookings
    .flatMap((b) => {
      const ledger = b.ledger && typeof b.ledger === 'object' ? b.ledger : {};
      return Object.entries(ledger)
        .filter(([, v]) => v && (v.paid || v.status === 'partial'))
        .map(([monthKey, v]) => ({
          key: `${b.id || b._id}-${monthKey}`,
          monthKey,
          amount: Number(v.amount) || 0,
          paidOn: v.paidOn || '',
          method: v.method || b.paymentMethod || '',
          status: v.status || 'full',
          property: b.property || '',
        }));
    })
    .sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
  const totalAdvance   = paymentBookings.reduce((s, b) => s + (Number(b.advancePayment) || 0), 0);
  const totalCollected = paymentReceipts.reduce((s, r) => s + r.amount, 0);
  const activeBooking  = paymentBookings.find((b) => b.status !== 'cancelled') || paymentBookings[0] || null;
  const hasPaymentInfo = paymentBookings.length > 0;

  return (
    <div className="w-full bg-[#f4f7fb] min-h-screen font-sans relative pb-20 selection:bg-blue-500 selection:text-white">

      {/* ── AMBIENT GLOW ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[300px] bg-blue-500/10 blur-[100px] pointer-events-none z-0" />

      {/* ── TOP NAV ── */}
      <div className="bg-white/70 backdrop-blur-2xl border-b border-white/50 sticky top-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-black text-blue-600 bg-white/50 border border-blue-100/50 px-4 py-2 rounded-full hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <p className="font-black text-gray-900 truncate">Tenant Profile</p>
          <button className="p-2.5 rounded-full border border-gray-200 bg-white/50 text-gray-500 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all active:scale-90 shadow-sm">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <motion.div 
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="max-w-[1200px] mx-auto px-4 mt-6 md:mt-8 relative z-10"
      >
        {/* ── HEADER CARD ── */}
        <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.04)] overflow-hidden mb-8">
          <div className="w-full h-48 md:h-72 bg-gray-200 relative group overflow-hidden">
            <img src={coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
          </div>

          <div className="px-6 md:px-12 pb-10 relative">
            <div className="flex justify-between items-end -mt-16 md:-mt-24 mb-4 md:mb-6 relative z-10">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-full md:rounded-[2.2rem] opacity-70 group-hover:opacity-100 blur transition-opacity duration-300"></div>
                <img
                  src={avatar}
                  alt={tenant.name}
                  className="relative w-28 h-28 md:w-44 md:h-44 rounded-full md:rounded-[2rem] border-[4px] md:border-[6px] border-white bg-white object-cover shadow-xl"
                />
                {idStatus === 'verified' && (
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-tr from-blue-600 to-blue-400 text-white p-2.5 rounded-full border-4 border-white shadow-lg">
                    <ShieldCheck size={20} />
                  </div>
                )}
              </div>

              <div className="hidden md:flex items-center gap-4">
                {/* Trust Score Highlight in Header */}
                <div className="mr-4 flex flex-col items-end justify-center">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Trust Score</p>
                  <div className="flex items-center gap-1.5 text-blue-600 bg-gradient-to-r from-blue-50 to-white px-4 py-1.5 rounded-2xl border border-blue-100 shadow-sm">
                    <ShieldCheck size={20} className="text-blue-500" />
                    <span className="text-2xl font-black bg-gradient-to-br from-blue-700 to-blue-500 bg-clip-text text-transparent">{trustScore}</span>
                    <span className="text-xs font-bold text-blue-400 mt-1">/ 100</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: tenant.id || tenant._id || id, peerName: tenant.name, peerAvatar: avatar, mode: 'call', callType: 'voice' } })}
                  className="bg-white text-gray-800 py-3.5 px-6 rounded-2xl font-black text-sm border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-600 shadow-sm transition-all flex items-center gap-2 group"
                >
                  <Phone size={18} className="group-hover:rotate-12 transition-transform" /> Call
                </button>
                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: tenant.id || tenant._id || id, peerName: tenant.name, peerAvatar: avatar } })}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 px-7 rounded-2xl font-black text-sm shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_25px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2"
                >
                  <MessageCircle size={18} /> Send Message
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">{tenant.name}</h1>
                  {idStatus === 'verified' && <BadgeCheck size={24} className="text-blue-500 drop-shadow-sm md:w-7 md:h-7" />}
                </div>
                {tagline && <p className="text-gray-500 font-bold text-sm md:text-base mt-1.5">{tagline}</p>}

                {(badges.length > 0 || isNewTenant) && (
                  <div className="flex flex-wrap gap-2.5 mt-5">
                    {badges.map((badge, i) => (
                      <span key={i} className="text-[10px] md:text-xs font-black px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest shadow-sm">
                        <Award size={12} className="md:w-3.5 md:h-3.5" /> {badge}
                      </span>
                    ))}
                    {isNewTenant && badges.length === 0 && (
                      <span className="text-xs font-black px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-2 uppercase tracking-widest shadow-sm">
                        <Award size={14} /> New tenant
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:hidden gap-4 w-full mt-2">
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-white p-5 rounded-2xl border border-blue-100 shadow-sm">
                  <p className="text-xs font-black text-blue-800 uppercase tracking-widest">Trust Score</p>
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <ShieldCheck size={20} />
                    <span className="text-2xl font-black">{trustScore}</span>
                    <span className="text-xs font-bold text-blue-400">/ 100</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => navigate('/messages', { state: { peerUserId: tenant.id || tenant._id || id, peerName: tenant.name, peerAvatar: avatar, mode: 'call', callType: 'voice' } })}
                    className="flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-800 shadow-sm active:scale-95"
                  >
                    <Phone size={18} /> Call
                  </button>
                  <button
                    onClick={() => navigate('/messages', { state: { peerUserId: tenant.id || tenant._id || id, peerName: tenant.name, peerAvatar: avatar } })}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={18} /> Message
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mt-8 md:mt-10 pt-6 md:pt-8 border-t border-gray-100/50">
              <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-2 text-blue-600 bg-blue-50 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                  <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <span className="block text-lg md:text-xl font-black text-gray-900 mb-1">{memberSince}</span>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member Since</p>
              </div>

              {(!isUnlocked || phone) && (
                <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="flex items-center justify-center gap-2 mb-2 text-indigo-600 bg-indigo-50 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                    {phone ? <Phone size={16} className="md:w-[18px] md:h-[18px]" /> : <Lock size={16} className="text-gray-400 md:w-[18px] md:h-[18px]" />}
                  </div>
                  <p className={`text-xs md:text-sm font-bold truncate ${phone ? 'text-gray-900' : 'text-gray-400'}`}>
                    {phone || 'Locked'}
                  </p>
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Phone</p>
                </div>
              )}

              {(!isUnlocked || email) && (
                <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="flex items-center justify-center gap-2 mb-2 text-violet-600 bg-violet-50 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                    {email ? <Mail size={16} className="md:w-[18px] md:h-[18px]" /> : <Lock size={16} className="text-gray-400 md:w-[18px] md:h-[18px]" />}
                  </div>
                  <p className={`text-xs md:text-sm font-bold truncate ${email ? 'text-gray-900' : 'text-gray-400'}`}>
                    {email || 'Locked'}
                  </p>
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Email</p>
                </div>
              )}
            </div>

            {!isUnlocked && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100/80 text-[13px] font-bold text-blue-800 flex items-center justify-center gap-3 shadow-inner">
                <div className="p-2 bg-white rounded-full shadow-sm">
                  <Lock size={16} className="text-blue-500" />
                </div>
                Contact details unlock once this tenant submits an inquiry on one of your listings.
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── SECTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          <div className="lg:col-span-7 space-y-6 md:space-y-8">
            
            {bio && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-black text-gray-900 mb-4">About</h3>
                <p className="text-gray-600 font-medium leading-relaxed text-sm md:text-base">
                  {bio}
                </p>
              </motion.div>
            )}

            {tenant.professionType && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-black text-gray-900 mb-5 md:mb-6 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Briefcase size={18} className="md:w-5 md:h-5" />
                  </div>
                  Professional Details
                </h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Status</span>
                    <span className="text-[15px] font-bold text-gray-900 capitalize">{tenant.professionType}</span>
                  </div>
                  
                  {isUnlocked && tenant.professionType === 'student' && (
                    <>
                      {professionDetails.institution && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Institution</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.institution}</span>
                        </div>
                      )}
                      {professionDetails.studentId && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Student ID</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.studentId}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isUnlocked && tenant.professionType === 'employed' && (
                    <>
                      {professionDetails.company && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Company</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.company}</span>
                        </div>
                      )}
                      {professionDetails.designation && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Designation</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.designation}</span>
                        </div>
                      )}
                      {professionDetails.officeId && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Office ID</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.officeId}</span>
                        </div>
                      )}
                    </>
                  )}
                  {isUnlocked && tenant.professionType === 'self-employed' && (
                    <>
                      {professionDetails.company && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Business</span>
                          <span className="text-[15px] font-bold text-gray-900">{professionDetails.company}</span>
                        </div>
                      )}
                    </>
                  )}
                  {!isUnlocked && (
                    <div className="mt-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 rounded-2xl flex gap-3 items-center text-sm font-bold text-blue-800 shadow-sm">
                      <div className="bg-white p-1.5 rounded-full shadow-sm"><Lock size={14} className="text-blue-500" /></div> Full professional details are locked
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {isUnlocked && emergencyContact.name && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-black text-gray-900 mb-5 md:mb-6 flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <ShieldCheck size={18} className="md:w-5 md:h-5" />
                  </div>
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="block text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Name</span>
                    <span className="text-sm md:text-base font-bold text-gray-900">{emergencyContact.name}</span>
                  </div>
                  {emergencyContact.relation && (
                    <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Relation</span>
                      <span className="text-base font-bold text-gray-900">{emergencyContact.relation}</span>
                    </div>
                  )}
                  {emergencyContact.phone && (
                    <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone</span>
                      <span className="text-base font-bold text-gray-900">{emergencyContact.phone}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {isUnlocked && familySize && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-black text-gray-900 mb-5 md:mb-6 flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <Briefcase size={18} className="md:w-5 md:h-5" />
                  </div>
                  Family Information
                </h3>
                <div className="p-3 md:p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50 flex flex-col sm:flex-row sm:items-center justify-between">
                  <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Family Size</span>
                  <span className="text-sm md:text-[15px] font-bold text-gray-900">{familySize} {familySize === '1' ? 'Person' : 'People'}</span>
                </div>
              </motion.div>
            )}

            {/* ── PAYMENT & RENT ─────────────────────────────────────────────
                Shown to the host who holds a booking for this tenant. Auto-fills
                from that booking (advance + payment method) and lists every
                rent receipt (paid/partial ledger month) in a clean card. */}
            {hasPaymentInfo && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <div className="flex items-center justify-between mb-5 md:mb-6">
                  <h3 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Wallet size={18} className="md:w-5 md:h-5" />
                    </div>
                    Payment &amp; Rent
                  </h3>
                  {activeBooking?.paymentMethod && (
                    <span className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-widest inline-flex items-center gap-1.5">
                      <Banknote size={12} /> {activeBooking.paymentMethod}
                    </span>
                  )}
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="p-4 bg-gradient-to-b from-emerald-50/60 to-emerald-50 rounded-2xl border border-emerald-100/70 text-center">
                    <p className="text-[9px] md:text-[10px] font-black text-emerald-600/80 uppercase tracking-widest mb-1">Advance Paid</p>
                    <p className="text-base md:text-xl font-black text-emerald-700 tabular-nums">{bdt(totalAdvance)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-b from-blue-50/60 to-blue-50 rounded-2xl border border-blue-100/70 text-center">
                    <p className="text-[9px] md:text-[10px] font-black text-blue-600/80 uppercase tracking-widest mb-1">Monthly Rent</p>
                    <p className="text-base md:text-xl font-black text-blue-700 tabular-nums">{bdt(activeBooking?.monthlyRent)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-b from-gray-50/60 to-gray-50 rounded-2xl border border-gray-100 text-center col-span-2 md:col-span-1">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Collected</p>
                    <p className="text-base md:text-xl font-black text-gray-900 tabular-nums">{bdt(totalCollected)}</p>
                  </div>
                </div>

                {/* Property + lease term chip */}
                {activeBooking && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500">
                    {activeBooking.property && (
                      <span className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Home size={12} className="text-gray-400" /> {activeBooking.property}
                      </span>
                    )}
                    {activeBooking.leaseStart && activeBooking.leaseEnd && (
                      <span className="inline-flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Calendar size={12} className="text-gray-400" /> {prettyDate(activeBooking.leaseStart)} – {prettyDate(activeBooking.leaseEnd)}
                      </span>
                    )}
                  </div>
                )}

                {/* Receipts — clean, modern rent-payment rows */}
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={14} className="text-gray-400" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Receipts</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] font-black text-gray-400 tabular-nums">{paymentReceipts.length}</span>
                  </div>

                  {paymentReceipts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                      <Receipt className="mx-auto text-gray-300 mb-2" size={22} />
                      <p className="text-xs font-bold text-gray-400">No rent payments recorded yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {paymentReceipts.map((r) => {
                        const partial = r.status === 'partial';
                        return (
                          <div key={r.key} className="flex items-center gap-3 p-3 md:p-3.5 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-[0_6px_18px_rgba(16,185,129,0.08)] transition-all">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${partial ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {partial ? <Clock size={18} /> : <CheckCircle2 size={18} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-gray-900 truncate">{monthKeyLabel(r.monthKey)}</p>
                              <p className="text-[10px] font-bold text-gray-400 truncate">
                                {r.paidOn ? prettyDate(r.paidOn) : 'Recorded'}
                                {r.method ? <> · {r.method}</> : null}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-gray-900 tabular-nums">{bdt(r.amount)}</p>
                              <span className={`text-[9px] font-black uppercase tracking-widest ${partial ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {partial ? 'Partial' : 'Paid'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          <div className="lg:col-span-5">
            {/* ── Trust + Verification ──────── */}
            <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8 sticky top-24">
              <div className="flex justify-center mb-6 md:mb-8 pb-6 md:pb-8 border-b border-gray-100/80">
                <TrustGauge score={trustScore} tier={trustTier} label="Tenant Trust" />
              </div>
              <div className="space-y-4">
                {emailStatus !== 'none' && (
                  <VerifStep
                    title="Email"
                    description="Confirmed via magic link / OTP."
                    status={emailStatus}
                    readOnly
                  />
                )}
                <VerifStep
                  title="Phone"
                  description="Confirmed via SMS OTP."
                  status={phoneStatus}
                  readOnly
                />
                <VerifStep
                  title="Government ID"
                  description="NID / Passport reviewed by the TO-LET PRO trust team."
                  status={idStatus}
                  readOnly
                />
                <VerifStep
                  title="Employment"
                  description="Optional. Helps landlords gauge ability to pay."
                  status={employmentStatus}
                  readOnly
                />
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TenantProfile;