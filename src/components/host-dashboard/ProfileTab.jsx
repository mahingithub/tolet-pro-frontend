import React from 'react';
import ProfileSection from '../shared/ProfileSection';
import VerificationModal from '../VerificationModal';
import { UserCircle, Phone, Camera, ScanFace, Hourglass, BadgeCheck, CheckCheck, Check, ShieldCheck, Edit3 } from 'lucide-react';

const TimelineRow = ({ done, icon: Icon, textEn, textBn, language, isFinal = false }) => (
  <div className="flex items-center gap-3">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
      done
        ? (isFinal ? 'bg-blue-500 text-white' : 'bg-green-500 text-white')
        : 'bg-gray-100 text-gray-400'
    }`}>
      {done ? (isFinal ? <BadgeCheck size={16} /> : <Check size={14} />) : <Icon size={14} />}
    </div>
    <p className={`text-sm font-black ${done ? 'text-gray-900' : 'text-gray-400'}`}>
      {language === 'বাংলা' ? textBn : textEn}
    </p>
  </div>
);

const TrustGauge = ({ score, tier, breakdown, language }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const tierMeta = {
    bronze:   { label: language === 'বাংলা' ? 'ব্রোঞ্জ' : 'Bronze',     color: '#a1764e', glow: 'rgba(161,118,78,0.20)' },
    silver:   { label: language === 'বাংলা' ? 'সিলভার' : 'Silver',     color: '#9ca3af', glow: 'rgba(156,163,175,0.20)' },
    gold:     { label: language === 'বাংলা' ? 'গোল্ড' : 'Gold',         color: '#d4a017', glow: 'rgba(212,160,23,0.25)' },
    platinum: { label: language === 'বাংলা' ? 'প্ল্যাটিনাম' : 'Platinum', color: '#3b82f6', glow: 'rgba(59,130,246,0.30)' },
  }[tier] || { label: 'Bronze', color: '#a1764e', glow: 'rgba(0,0,0,0.05)' };

  return (
    <div className="relative bg-gradient-to-br from-white to-gray-50/40 rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8 overflow-hidden">
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: tierMeta.glow }}
      />
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `${tierMeta.color}18` }}>
          <ShieldCheck size={18} style={{ color: tierMeta.color }} />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900">
            {language === 'বাংলা' ? 'ট্রাস্ট স্কোর' : 'Trust Score'}
          </h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {language === 'বাংলা' ? 'ভাড়াটিয়ারা যা দেখে' : 'What tenants see'}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mb-6">
        <div className="relative" style={{ filter: `drop-shadow(0 8px 24px ${tierMeta.glow})` }}>
          <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
            <defs>
              <linearGradient id={`grad-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={tierMeta.color} stopOpacity="1" />
                <stop offset="100%" stopColor={tierMeta.color} stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle cx="80" cy="80" r={r} fill="none" stroke="#f3f4f6" strokeWidth="11" />
            <circle
              cx="80" cy="80" r={r} fill="none"
              stroke={`url(#grad-${tier})`}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-0.5">
              <span className="text-5xl font-black leading-none tabular-nums tracking-tight bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-transparent">{score}</span>
              <span className="text-base font-black text-gray-300 leading-none">/100</span>
            </div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em] mt-1.5">
              {language === 'বাংলা' ? 'স্কোর' : 'SCORE'}
            </span>
          </div>
        </div>
        <div
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm"
          style={{ background: `${tierMeta.color}15`, color: tierMeta.color, borderColor: `${tierMeta.color}30` }}
        >
          <BadgeCheck size={12} /> {tierMeta.label}
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        {breakdown.map((b) => (
          <div key={b.key} className="flex items-center justify-between text-[11px] font-bold">
            <span className={`flex items-center gap-2 ${b.done ? 'text-gray-700' : 'text-gray-400'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center ${b.done ? 'bg-green-500 text-white shadow-[0_0_0_3px_rgba(34,197,94,0.12)]' : 'bg-gray-100'}`}>
                {b.done ? <Check size={10} /> : null}
              </span>
              {language === 'বাংলা' ? b.labelBn : b.labelEn}
            </span>
            <span className={`tabular-nums ${b.done ? 'text-green-600' : 'text-gray-300'}`}>+{b.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuickWinsCard = ({ breakdown, language, onJump }) => {
  const top = [...breakdown].filter((b) => !b.done).sort((a, b) => b.pts - a.pts).slice(0, 3);
  if (top.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-white rounded-[2rem] border border-emerald-100 shadow-[0_4px_20px_rgba(16,185,129,0.08)] p-6 md:p-8">
        <div className="flex items-center gap-3 mb-2">
          <BadgeCheck className="text-emerald-600" size={20} />
          <h3 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'প্রোফাইল সম্পূর্ণ! 🎉' : 'Profile Complete! 🎉'}</h3>
        </div>
        <p className="text-xs font-bold text-gray-600 leading-relaxed">
          {language === 'বাংলা' ? 'অসাধারণ! আপনার প্রোফাইল ১০০% — ভাড়াটিয়াদের কাছে আপনি এখন প্ল্যাটিনাম।' : 'You hit max Trust Score. Tenants see you as Platinum tier.'}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#ba0036]/10 flex items-center justify-center">
          <Edit3 className="text-[#ba0036]" size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black text-gray-900">{language === 'বাংলা' ? 'দ্রুত উন্নতি' : 'Quick Wins'}</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{language === 'বাংলা' ? 'স্কোর বাড়ান' : 'Boost your score'}</p>
        </div>
      </div>
      <div className="space-y-2">
        {top.map((b) => (
          <button
            key={b.key}
            onClick={() => onJump && onJump(b.key)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-[#ba0036]/5 border border-gray-100 hover:border-[#ba0036]/20 transition-all group text-left"
          >
            <span className="text-[12px] font-black text-gray-800 group-hover:text-[#ba0036] transition-colors">{language === 'বাংলা' ? b.labelBn : b.labelEn}</span>
            <span className="bg-[#ba0036]/10 text-[#ba0036] px-2 py-0.5 rounded-full text-[10px] font-black">+{b.pts}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function ProfileTab({
  userData,
  landlordProfile,
  landlordTrustScore,
  hostVerificationStatus,
  language,
  verificationStatus,
  verifModalOpen,
  setVerifModalOpen,
  handleHostWizardSubmit,
  authUser,
  onProfileUpdate,
  onAvatarUpload,
}) {
  return (
    <div className="w-full mb-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">

        {/* === LEFT (2 cols on xl): Header + Personal Info + Verification Center === */}
        <div className="xl:col-span-2 space-y-6 md:space-y-8">
          <ProfileSection
            role="landlord"
            user={userData}
            profile={landlordProfile}
            trustScore={landlordTrustScore}
            verificationStatus={hostVerificationStatus}
            language={language}
            onUpdate={onProfileUpdate}
            onAvatarUpload={onAvatarUpload}
            onOpenVerification={() => setVerifModalOpen(true)}
          />
        </div>

        {/* === RIGHT (1 col on xl): Trust Score + Timeline + Quick Wins === */}
        <div className="xl:col-span-1 space-y-6 md:space-y-8">

          <TrustGauge
            score={landlordTrustScore.score}
            tier={landlordTrustScore.tier}
            breakdown={landlordTrustScore.breakdown}
            language={language}
          />

          <QuickWinsCard
            breakdown={landlordTrustScore.breakdown}
            language={language}
            onJump={() => {
              if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCheck className="text-green-600" size={18} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black text-gray-900">
                  {language === 'বাংলা' ? 'ভেরিফিকেশন স্ট্যাটাস' : 'Verification Status'}
                </h3>
                <p className="text-xs font-bold text-gray-500">
                  {language === 'বাংলা' ? 'কোন ধাপে আছেন এক নজরে দেখুন।' : 'Track your verification progress at a glance.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <TimelineRow
                done
                icon={UserCircle}
                textEn="Account created"
                textBn="অ্যাকাউন্ট তৈরি"
                language={language}
              />
              <TimelineRow
                done={!!userData.phone}
                icon={Phone}
                textEn="Phone OTP verified"
                textBn="ফোন OTP ভেরিফাইড"
                language={language}
              />
              <TimelineRow
                done={!!userData.avatar}
                icon={Camera}
                textEn="Profile photo uploaded"
                textBn="প্রোফাইল ছবি আপলোড"
                language={language}
              />
              <TimelineRow
                done={verificationStatus.nidUploaded}
                icon={ScanFace}
                textEn="National ID uploaded"
                textBn="NID আপলোড"
                language={language}
              />
              <TimelineRow
                done={verificationStatus.underReview || (verificationStatus.faceVerified && verificationStatus.nidUploaded)}
                icon={Hourglass}
                textEn="Submitted for admin review"
                textBn="অ্যাডমিন রিভিউয়ের জন্য সাবমিট"
                language={language}
              />
              <TimelineRow
                done={verificationStatus.faceVerified && verificationStatus.nidUploaded && !verificationStatus.underReview}
                icon={BadgeCheck}
                textEn="Verified by To-Let Pro"
                textBn="To-Let Pro দ্বারা ভেরিফাইড"
                language={language}
                isFinal
              />
            </div>
          </div>

        </div>
      </div>
      
      {/* Identity verification — the SAME pop-up the tenant uses
          (role="tenant"), wired the same way (open prop + real backend
          submit). The old landlord-specific variant was removed. */}
      <VerificationModal
        role="tenant"
        open={verifModalOpen}
        onClose={() => setVerifModalOpen(false)}
        onSubmit={handleHostWizardSubmit}
        language={language}
        initialData={{
          professionType: authUser?.tenantProfile?.professionType || '',
          nidVerified: authUser?.tenantProfile?.verification?.status === 'verified'
            || !!authUser?.tenantProfile?.verification?.nidFront,
        }}
      />
    </div>
  );
}
