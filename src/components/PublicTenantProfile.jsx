import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ShieldCheck, MessageCircle, Phone,
  Mail, GraduationCap, Briefcase, Store, Stethoscope, User,
  Calendar, CheckCircle2, Clock, ShieldAlert, BadgeCheck
} from 'lucide-react';
import { tenantService } from '../services/tenantService';

const PROFESSION_ICONS = {
  student: GraduationCap,
  job: Briefcase,
  business: Store,
  doctor: Stethoscope,
  other: User
};

const getProfessionIcon = (type) => {
  const Icon = PROFESSION_ICONS[type] || User;
  return <Icon size={18} className="text-gray-400" />;
};

const PublicTenantProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await tenantService.getTenant(id);
        if (cancelled) return;
        setTenant(data);
      } catch {
        if (!cancelled) setTenant(null);
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
          <p className="text-slate-600 text-sm font-semibold">Loading tenant profile…</p>
        </div>
      </div>
    );
  }

  if (!id || !tenant) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-xl border border-gray-100">
          <h2 className="text-xl font-black text-slate-900 mb-2">Tenant not found</h2>
          <p className="text-sm text-slate-600 mb-5">
            This profile is unavailable or you do not have permission to view it.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-full bg-[#ba0036] text-white text-sm font-black hover:bg-[#7c0026] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const avatar = tenant.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(tenant.name || 'Tenant')}&background=fce4ec&color=ba0036&size=256`;
  const isFullyVerified = tenant.verification?.status === 'verified';

  // Trust score coloring
  let scoreColor = 'text-green-500';
  if (tenant.trustScore < 40) scoreColor = 'text-red-500';
  else if (tenant.trustScore < 70) scoreColor = 'text-amber-500';

  return (
    <div className="w-full bg-[#f4f7fb] min-h-screen font-sans relative pb-20">
      {/* ── TOP NAV ── */}
      <div className="bg-white/85 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-black text-[#ba0036] bg-red-50 px-4 py-2 rounded-full hover:bg-[#ba0036] hover:text-white transition-all active:scale-95"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <p className="font-black text-gray-900 truncate">Tenant Profile</p>
          <div className="w-[88px]" /> {/* Spacer for balance */}
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-4 mt-8">
        {/* ── PROFILE HEADER CARD ── */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden mb-8">
          <div className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar Section */}
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={tenant.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] border-4 border-gray-50 shadow-md object-cover"
              />
              {isFullyVerified && (
                <div className="absolute -bottom-3 -right-3 bg-blue-500 text-white p-2.5 rounded-xl shadow-lg border-4 border-white">
                  <BadgeCheck size={24} />
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left w-full">
              <div className="flex flex-col md:flex-row md:justify-between items-center md:items-start gap-4">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 flex items-center justify-center md:justify-start gap-2">
                    {tenant.name}
                  </h1>
                  <p className="text-gray-500 font-bold text-sm mt-1">
                    Member since {tenant.memberSinceYear}
                  </p>
                </div>

                {/* Trust Score Highlight */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center min-w-[120px]">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Trust Score</p>
                  <div className={`text-4xl font-black ${scoreColor}`}>
                    {tenant.trustScore}
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-current rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, Math.max(0, tenant.trustScore))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: tenant.id, peerName: tenant.name, peerAvatar: avatar, mode: 'call', callType: 'voice' } })}
                  className="flex-1 bg-green-50 text-green-700 py-3.5 px-6 rounded-2xl font-black text-sm hover:bg-green-100 transition-all flex items-center justify-center gap-2 border border-green-200">
                  <Phone size={18} /> Call Tenant
                </button>
                <button
                  onClick={() => navigate('/messages', { state: { peerUserId: tenant.id, peerName: tenant.name, peerAvatar: avatar } })}
                  className="flex-1 bg-[#ba0036] text-white py-3.5 px-6 rounded-2xl font-black text-sm shadow-[0_8px_20px_rgba(186,0,54,0.2)] hover:bg-[#90002a] active:scale-95 transition-all flex items-center justify-center gap-2 border-none">
                  <MessageCircle size={18} /> Send Message
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── DETAILS ROW ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* VERIFICATIONS */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <ShieldCheck className="text-blue-500" size={20} />
              Verifications
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tenant.phoneOtpVerified ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  {tenant.phoneOtpVerified ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Phone Number</p>
                  <p className="text-xs text-gray-500 font-medium">OTP Verified</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tenant.verification?.photo ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  {tenant.verification?.photo ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Profile Photo</p>
                  <p className="text-xs text-gray-500 font-medium">Clear face photo uploaded</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(tenant.verification?.nidFront && tenant.verification?.nidBack) ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  {(tenant.verification?.nidFront && tenant.verification?.nidBack) ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Government ID</p>
                  <p className="text-xs text-gray-500 font-medium">NID verified</p>
                </div>
              </div>
            </div>
          </div>

          {/* TENANT INFO */}
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
            <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <User className="text-indigo-500" size={20} />
              About Tenant
            </h3>
            <div className="space-y-5">
              {tenant.professionType && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    {getProfessionIcon(tenant.professionType)}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-gray-500">Profession</p>
                    <p className="text-sm font-bold text-gray-900 capitalize">{tenant.professionType}</p>
                  </div>
                </div>
              )}
              
              {/* Unlocked Private Data */}
              {tenant.unlocked ? (
                <>
                  {tenant.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <Phone size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-500">Phone</p>
                        <p className="text-sm font-bold text-gray-900">{tenant.phone}</p>
                      </div>
                    </div>
                  )}
                  {tenant.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                        <Mail size={18} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-gray-500">Email</p>
                        <p className="text-sm font-bold text-gray-900">{tenant.email}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3 mt-4 border border-amber-100/50">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-900">Private Information</p>
                    <p className="text-[11px] text-amber-700/80 mt-1 font-medium leading-relaxed">
                      Contact details are hidden for privacy. They will be unlocked if you have an active inquiry or booking with this tenant.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicTenantProfile;
