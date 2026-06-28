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
} from 'lucide-react';
import { motion } from 'framer-motion';

import { tenantService } from '../services/tenantService';
import { useAuth } from '../context/AuthContext.jsx';
import TrustGauge from './shared/TrustGauge';
import VerifStep  from './shared/VerifStep';

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
            <div className="flex justify-between items-end -mt-20 md:-mt-24 mb-6 relative z-10">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-[2.2rem] opacity-70 group-hover:opacity-100 blur transition-opacity duration-300"></div>
                <img
                  src={avatar}
                  alt={tenant.name}
                  className="relative w-36 h-36 md:w-44 md:h-44 rounded-[2rem] border-[6px] border-white bg-white object-cover shadow-xl"
                />
                {verif.idVerified && (
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

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{tenant.name}</h1>
                  {verif.idVerified && <BadgeCheck size={28} className="text-blue-500 drop-shadow-sm" />}
                </div>
                {tagline && <p className="text-gray-500 font-bold text-sm md:text-base mt-1.5">{tagline}</p>}

                {(verif.idVerified || isNewTenant) && (
                  <div className="flex flex-wrap gap-2.5 mt-5">
                    {verif.idVerified && (
                      <span className="text-xs font-black px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-2 uppercase tracking-widest shadow-sm">
                        <BadgeCheck size={14} /> Verified Tenant
                      </span>
                    )}
                    {isNewTenant && !verif.idVerified && (
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

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 pt-8 border-t border-gray-100/50">
              <div className="p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-2 text-blue-600 bg-blue-50 w-10 h-10 mx-auto rounded-full">
                  <Calendar size={18} />
                </div>
                <span className="block text-xl font-black text-gray-900 mb-1">{memberSince}</span>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member Since</p>
              </div>

              <div className="p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex items-center justify-center gap-2 mb-2 text-indigo-600 bg-indigo-50 w-10 h-10 mx-auto rounded-full">
                  {phone ? <Phone size={18} /> : <Lock size={18} className="text-gray-400" />}
                </div>
                <p className={`text-sm font-bold truncate ${phone ? 'text-gray-900' : 'text-gray-400'}`}>
                  {phone || 'Locked'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Phone</p>
              </div>

              <div className="p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex items-center justify-center gap-2 mb-2 text-violet-600 bg-violet-50 w-10 h-10 mx-auto rounded-full">
                  {email ? <Mail size={18} /> : <Lock size={18} className="text-gray-400" />}
                </div>
                <p className={`text-sm font-bold truncate ${email ? 'text-gray-900' : 'text-gray-400'}`}>
                  {email || 'Locked'}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Email</p>
              </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            
            {bio && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-8">
                <h3 className="text-xl font-black text-gray-900 mb-4">About</h3>
                <p className="text-gray-600 font-medium leading-relaxed text-base">
                  {bio}
                </p>
              </motion.div>
            )}

            {tenant.professionType && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-8">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Briefcase size={20} />
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
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Institution</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.institution || '—'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Student ID</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.studentId || '—'}</span>
                      </div>
                    </>
                  )}
                  {isUnlocked && tenant.professionType === 'job' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Company</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.company || '—'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Designation</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.designation || '—'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Office ID</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.officeId || '—'}</span>
                      </div>
                    </>
                  )}
                  {isUnlocked && tenant.professionType === 'businessman' && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 sm:mb-0">Business</span>
                        <span className="text-[15px] font-bold text-gray-900">{professionDetails.company || '—'}</span>
                      </div>
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
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-8">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <ShieldCheck size={20} />
                  </div>
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Name</span>
                    <span className="text-base font-bold text-gray-900">{emergencyContact.name}</span>
                  </div>
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Relation</span>
                    <span className="text-base font-bold text-gray-900">{emergencyContact.relation || '—'}</span>
                  </div>
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone</span>
                    <span className="text-base font-bold text-gray-900">{emergencyContact.phone || '—'}</span>
                  </div>
                  <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                    <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Address</span>
                    <span className="text-base font-bold text-gray-900">{emergencyContact.address || '—'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="lg:col-span-5">
            {/* ── Trust + Verification ──────── */}
            <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8 sticky top-24">
              <div className="flex justify-center mb-8 pb-8 border-b border-gray-100/80">
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