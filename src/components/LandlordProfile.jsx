import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Star, BadgeCheck, MessageCircle, Phone,
  MapPin, Calendar, Clock, Award, ShieldCheck, Share2,
  BedDouble, Bath, Square,
} from 'lucide-react';

import { propertyService } from '../services/Propertyservice';
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

const LandlordProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [landlord, setLandlord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ll, allProps] = await Promise.all([
          propertyService.getLandlord(id),
          propertyService.getProperties({}, 'Newest Listings'),
        ]);
        if (cancelled) return;
        setLandlord(ll || null);
        setProperties(
          (Array.isArray(allProps) ? allProps : []).filter(
            (p) => String(p.landlordId) === String(id),
          ),
        );
      } catch {
        if (!cancelled) { setLandlord(null); setProperties([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-[#ba0036]/30 border-t-[#ba0036] animate-spin" />
          <p className="text-slate-600 text-sm font-semibold">Loading landlord…</p>
        </div>
      </div>
    );
  }

  if (!id || !landlord) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl shadow-red-500/5 border border-gray-100">
          <h2 className="text-2xl font-black text-slate-900 mb-2">Landlord not found</h2>
          <p className="text-sm text-slate-600 mb-6">
            This landlord hasn't listed anything yet or their profile is unavailable.
          </p>
          <button
            onClick={() => navigate('/properties')}
            className="px-6 py-3 rounded-full bg-[#ba0036] text-white text-sm font-black hover:bg-[#7c0026] hover:shadow-lg hover:shadow-red-500/20 transition-all active:scale-95"
          >
            Browse properties
          </button>
        </motion.div>
      </div>
    );
  }

  const coverImage  = landlord.coverImage  || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000';
  const avatar      = landlord.avatar      || `https://ui-avatars.com/api/?name=${encodeURIComponent(landlord.name || 'Landlord')}&background=fce4ec&color=ba0036&size=256`;
  const tagline     = landlord.tagline     || '';
  const bio         = landlord.bio         || '';
  const badges      = landlord.badges      || [];
  const rating      = landlord.rating      || 0;
  const totalReviews = landlord.totalReviews || 0;
  const responseRate = landlord.responseRate ?? 0;
  const responseTime = landlord.responseTime || '—';
  const memberSince  = landlord.memberSince  || new Date().getFullYear().toString();
  const totalProperties = landlord.totalProperties ?? properties.length;
  
  const isNewHost = !!landlord.isNew && rating === 0 && totalReviews === 0;
  const trustScore   = landlord.trustScore   ?? 0;
  const trustTier    = landlord.trustTier    || '';
  const verification = landlord.verification || {};
  const vTenant      = verification.tenant   || {};
  const vLandlord    = verification.landlord || {};

  const phoneStatus =
    verification.phoneVerified === true ||
    landlord.phoneVerified    === true ||
    !!landlord.phone ||
    !!(landlord.id || landlord._id)
      ? 'verified'
      : 'unverified';

  const hasEmail   = !!(landlord.email || verification.email);
  const emailStatus = verification.emailVerified === true
    ? 'verified'
    : (hasEmail ? 'unverified' : 'none');

  const idStatus =
    vTenant.status
    || verification.idStatus
    || verification.status
    || (verification.idVerified ? 'verified' : 'unverified');

  const addressStatus =
    vLandlord.status
    || verification.addressStatus
    || (verification.addressVerified ? 'verified' : 'unverified');

  const isFullyVerified = idStatus === 'verified' && addressStatus === 'verified';

  return (
    <div className="w-full bg-[#f4f7fb] min-h-screen font-sans relative pb-20 selection:bg-[#ba0036] selection:text-white">

      {/* ── AMBIENT GLOW ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[300px] bg-[#ba0036]/10 blur-[100px] pointer-events-none z-0" />

      {/* ── TOP NAV ── */}
      <div className="bg-white/70 backdrop-blur-2xl border-b border-white/50 sticky top-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-black text-[#ba0036] bg-white/50 border border-red-100/50 px-4 py-2 rounded-full hover:bg-red-50 hover:border-red-200 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <p className="font-black text-gray-900 truncate">Landlord Profile</p>
          <button className="p-2.5 rounded-full border border-gray-200 bg-white/50 text-gray-500 hover:border-[#ba0036] hover:text-[#ba0036] hover:bg-red-50 transition-all active:scale-90 shadow-sm">
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
        {/* ── PROFILE HEADER CARD ── */}
        <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] border border-white/80 shadow-[0_8px_40px_rgba(0,0,0,0.04)] overflow-hidden mb-8">
          <div className="w-full h-48 md:h-72 bg-gray-200 relative group overflow-hidden">
            <img src={coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent" />
          </div>

          <div className="px-6 md:px-12 pb-10 relative">
            <div className="flex justify-between items-end -mt-16 md:-mt-24 mb-4 md:mb-6 relative z-10">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-tr from-[#ba0036] to-pink-500 rounded-full md:rounded-[2.2rem] opacity-70 group-hover:opacity-100 blur transition-opacity duration-300"></div>
                <img
                  src={avatar}
                  alt={landlord.name}
                  className="relative w-28 h-28 md:w-44 md:h-44 rounded-full md:rounded-[2rem] border-[4px] md:border-[6px] border-white bg-white object-cover shadow-xl"
                />
                {landlord.verified && (
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-tr from-blue-600 to-blue-400 text-white p-2.5 rounded-full border-4 border-white shadow-lg">
                    <ShieldCheck size={20} />
                  </div>
                )}
              </div>

              <div className="hidden md:flex items-center gap-4">
                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: landlord.id || landlord._id || id, peerName: landlord.name, peerAvatar: avatar, mode: 'call', callType: 'voice' } })}
                  className="bg-white text-gray-800 py-3.5 px-6 rounded-2xl font-black text-sm border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-600 shadow-sm transition-all flex items-center gap-2 group">
                  <Phone size={18} className="group-hover:rotate-12 transition-transform" /> Call
                </button>
                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: landlord.id || landlord._id || id, peerName: landlord.name, peerAvatar: avatar } })}
                  className="bg-gradient-to-r from-[#ba0036] to-[#90002a] text-white py-3.5 px-7 rounded-2xl font-black text-sm shadow-[0_8px_20px_rgba(186,0,54,0.25)] hover:shadow-[0_12px_25px_rgba(186,0,54,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2">
                  <MessageCircle size={18} /> Send Message
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">{landlord.name}</h1>
                  {landlord.verified && <BadgeCheck size={24} className="text-blue-500 drop-shadow-sm md:w-7 md:h-7" />}
                </div>
                {tagline && <p className="text-gray-500 font-bold text-sm md:text-base mt-1.5">{tagline}</p>}

                {(landlord.verified || (isNewHost && !landlord.verified) || badges.length > 0) && (
                  <div className="flex flex-wrap gap-2.5 mt-5">
                    {landlord.verified && (
                      <span className="text-[10px] md:text-xs font-black px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest shadow-sm">
                        <BadgeCheck size={12} className="md:w-3.5 md:h-3.5" /> Verified Landlord
                      </span>
                    )}
                    {isNewHost && !landlord.verified && (
                      <span className="text-[10px] md:text-xs font-black px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest shadow-sm">
                        <Award size={12} className="md:w-3.5 md:h-3.5" /> New landlord
                      </span>
                    )}
                    {badges.map((badge, i) => (
                      <span key={i} className="text-[10px] md:text-xs font-black px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-red-50 text-[#ba0036] border border-red-100 flex items-center gap-1.5 md:gap-2 uppercase tracking-widest shadow-sm">
                        <Award size={12} className="md:w-3.5 md:h-3.5" /> {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:hidden gap-4 w-full mt-2">
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => navigate('/messages', { state: { peerUserId: landlord.id || landlord._id || id, peerName: landlord.name, peerAvatar: avatar, mode: 'call', callType: 'voice' } })}
                    className="flex-1 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-800 shadow-sm active:scale-95">
                    <Phone size={18} /> Call
                  </button>
                  <button
                    onClick={() => navigate('/messages', { state: { peerUserId: landlord.id || landlord._id || id, peerName: landlord.name, peerAvatar: avatar } })}
                    className="flex-1 bg-gradient-to-r from-[#ba0036] to-[#90002a] text-white py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                    <MessageCircle size={18} /> Message
                  </button>
                </div>
              </div>
            </div>

            {/* Trust Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8 md:mt-10 pt-6 md:pt-8 border-t border-gray-100/50">
              <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-1.5 mb-2 text-yellow-500 bg-yellow-50/80 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                  <Star size={16} className="fill-yellow-500 md:w-[18px] md:h-[18px]" />
                </div>
                <span className="block text-lg md:text-xl font-black text-gray-900 mb-1">{rating}</span>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">({totalReviews} Reviews)</p>
              </div>

              <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-1.5 mb-2 text-green-600 bg-green-50/80 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                  <MessageCircle size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <span className="block text-lg md:text-xl font-black text-gray-900 mb-1">{responseRate}%</span>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Response Rate</p>
              </div>

              <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-1.5 mb-2 text-indigo-600 bg-indigo-50/80 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                  <Clock size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <span className="block text-lg md:text-xl font-black text-gray-900 mb-1">{responseTime}</span>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg. Reply</p>
              </div>

              <div className="p-4 md:p-5 bg-gradient-to-b from-gray-50/50 to-gray-50 rounded-2xl border border-gray-100/80 text-center hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-1.5 mb-2 text-violet-600 bg-violet-50/80 w-8 h-8 md:w-10 md:h-10 mx-auto rounded-full">
                  <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <span className="block text-lg md:text-xl font-black text-gray-900 mb-1">{memberSince}</span>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">Member Since</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── SECTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-12">
          <div className="lg:col-span-7 space-y-6 md:space-y-8">
            {bio && (
              <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8">
                <h3 className="text-lg md:text-xl font-black text-gray-900 mb-4">About the Landlord</h3>
                <p className="text-gray-600 font-medium leading-relaxed text-sm md:text-base">
                  {bio}
                </p>
              </motion.div>
            )}

            {/* ── Preferences & Rules ── */}
            {(landlord.preferredTenants?.length > 0 || landlord.houseRules?.length > 0 || landlord.serviceCharge !== null || landlord.communication?.length > 0) && (
              <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(landlord.preferredTenants?.length > 0 || landlord.communication?.length > 0) && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                    <h3 className="text-base md:text-lg font-black text-gray-900 mb-5 md:mb-6">Landlord Preferences</h3>
                    
                    {landlord.preferredTenants?.length > 0 && (
                      <div className="mb-5 md:mb-6">
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 md:mb-3">Preferred Tenants</p>
                        <div className="flex flex-wrap gap-2 md:gap-2.5">
                          {landlord.preferredTenants.map((pt, i) => (
                            <span key={i} className="bg-blue-50/80 text-blue-700 border border-blue-100 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-xl text-[11px] md:text-xs font-bold capitalize shadow-sm">
                              {pt.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {landlord.communication?.length > 0 && (
                      <div>
                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 md:mb-3">Preferred Contact</p>
                        <div className="flex flex-wrap gap-2 md:gap-2.5">
                          {landlord.communication.map((cm, i) => (
                            <span key={i} className="bg-gray-50/80 text-gray-600 border border-gray-200 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-xl text-[11px] md:text-xs font-bold capitalize shadow-sm">
                              {cm.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {(landlord.houseRules?.length > 0 || landlord.serviceCharge !== null) && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 p-6 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                    <h3 className="text-base md:text-lg font-black text-gray-900 mb-5 md:mb-6">House Rules & Fees</h3>
                    
                    {landlord.houseRules?.length > 0 && (
                      <div className="mb-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">House Rules</p>
                        <ul className="space-y-3">
                          {landlord.houseRules.map((hr, i) => (
                            <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></div>
                              <span className="capitalize">{hr.replace(/_/g, ' ')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {landlord.serviceCharge !== null && (
                      <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Service Charge</p>
                        {landlord.serviceCharge > 0 ? (
                          <p className="text-[15px] font-black text-gray-900">৳{landlord.serviceCharge.toLocaleString('en-IN')}<span className="text-xs text-gray-500 font-medium">/mo</span></p>
                        ) : (
                          <p className="text-[15px] font-bold text-emerald-600 flex items-center gap-2"><BadgeCheck size={16} /> No service charge</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div className="lg:col-span-5">
            {/* ── Trust + Verification ──────── */}
            <motion.div variants={fadeInUp} className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8 sticky top-24">
              <div className="flex justify-center mb-6 md:mb-8 pb-6 md:pb-8 border-b border-gray-100/80">
                <TrustGauge score={trustScore} tier={trustTier} label="Landlord Trust" />
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
                  title="Property Verified"
                  description={
                    vLandlord.propertyAddress
                      ? `Utility bill matched to ${vLandlord.propertyAddress}.`
                      : 'Utility bill matched to the registered address.'
                  }
                  status={addressStatus}
                  readOnly
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── ACTIVE LISTINGS ── */}
        <motion.div variants={fadeInUp} className="mb-10 pt-4">
          <h2 className="text-xl md:text-3xl font-black text-gray-900 mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
            Active Properties <span className="text-gray-400 text-sm md:text-lg font-bold bg-gray-100 px-2 md:px-3 py-1 rounded-full">{totalProperties}</span>
          </h2>

          {properties.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-12 text-center border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                <MapPin size={24} className="text-gray-300" />
              </div>
              <p className="text-base text-slate-500 font-semibold max-w-md mx-auto">
                This landlord hasn't published any active listings yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((property) => {
                const cover = property.coverPhoto || property.img || (property.images || [])[0];
                return (
                  <motion.div
                    key={property.id}
                    whileHover={{ y: -8 }}
                    className="bg-white/80 backdrop-blur-xl rounded-[2rem] overflow-hidden border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl transition-all cursor-pointer group flex flex-col"
                    onClick={() => navigate(`/property/${property.id}`)}
                  >
                    <div className="h-56 relative overflow-hidden bg-gray-100">
                      {cover && (
                        <img src={cover} alt={property.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {property.type && (
                        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black text-gray-900 uppercase tracking-widest shadow-sm">
                          {property.type}
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-lg font-black text-gray-900 mb-2 line-clamp-1 group-hover:text-[#ba0036] transition-colors">{property.title}</h3>
                      <p className="flex items-center gap-1.5 text-xs font-bold text-gray-500 mb-5 truncate">
                        <MapPin size={14} className="text-[#ba0036]" /> {property.location}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] font-black text-gray-600 mb-6 uppercase tracking-wider">
                        {property.beds != null && <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100"><BedDouble size={14} className="text-gray-400" /> {property.beds} BD</span>}
                        {property.baths != null && <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100"><Bath size={14} className="text-gray-400" /> {property.baths} BA</span>}
                        {property.sqft != null && <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100"><Square size={14} className="text-gray-400" /> {property.sqft}</span>}
                      </div>

                      <div className="flex items-center justify-between pt-5 border-t border-gray-100 mt-auto">
                        <p className="text-2xl font-black text-[#ba0036]">
                          ৳{Number(property.price || 0).toLocaleString('en-IN')}
                          <span className="text-[11px] text-gray-400 font-black uppercase tracking-wider ml-1">/mo</span>
                        </p>
                        <button className="bg-red-50 text-[#ba0036] px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-[#ba0036] hover:text-white transition-all shadow-sm">
                          View
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
};

export default LandlordProfile;