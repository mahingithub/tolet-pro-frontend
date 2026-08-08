import React from 'react';
import { CheckCheck, UserCircle, Phone, Camera, ScanFace, Hourglass, BadgeCheck } from 'lucide-react';
import ProfileSection from '../shared/ProfileSection';

const ProfileTab = ({
  authUser, tenantProfile, trustScore, language, applyPatch, persistProfile, authUpdateMe,
  showProfileToast, uploadAvatar, isVerified, verifPending, setVerifModalOpen,
  TrustGauge, QuickWinsCard, TimelineRow
}) => {
  return (
          <div className="w-full mb-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">

              {/* === LEFT (2 cols on xl): Header + Personal Info + Verification Center === */}
              <div className="xl:col-span-2 space-y-6 md:space-y-8">
            {/* === SHARED PROFILE SECTION (Session 2 - Blueprint v2) ===
                 Replaces the old Header Card + Personal Info Card.
                 HostDashboard will use the same component with role="landlord". */}
            <ProfileSection
              role="tenant"
              user={authUser || {}}
              profile={tenantProfile}
              trustScore={trustScore}
              verificationStatus={tenantProfile?.verification?.status || 'unverified'}
              language={language}
              onUpdate={async (patch) => {
                // 1) Build the new local profile so the UI updates instantly.
                const next = applyPatch(tenantProfile, patch);
                persistProfile(next);

                // 2) Sync to backend — but ONLY the paths that actually changed.
                //    Sending the entire tenantProfile would let empty strings
                //    overwrite previously-saved fields (e.g. saving the name
                //    would wipe phone & relation because we sent them as '').
                //    That was the real cause of "save click করলে data চলে যায়"।
                if (!authUpdateMe) return;

                const topLevel = {};
                const nested   = {};
                for (const [path, value] of Object.entries(patch || {})) {
                  // Identity-level keys → top of user document
                  if (path === 'fullName' || path === 'name') { topLevel.name = value; continue; }
                  if (path === 'email')                       { topLevel.email = value; continue; }
                  if (path === 'dateOfBirth')                 { topLevel.dateOfBirth = value; continue; }

                  // Anything else lives under tenantProfile.*
                  // Walk dotted paths so 'emergencyContact.relation' nests
                  // correctly inside { emergencyContact: { relation: ... } }.
                  const parts = path.split('.');
                  let cursor = nested;
                  for (let i = 0; i < parts.length - 1; i++) {
                    const k = parts[i];
                    if (!cursor[k] || typeof cursor[k] !== 'object') cursor[k] = {};
                    cursor = cursor[k];
                  }
                  cursor[parts[parts.length - 1]] = value;
                }

                const payload = { ...topLevel };
                if (Object.keys(nested).length > 0) payload.tenantProfile = nested;
                if (Object.keys(payload).length === 0) return;

                try {
                  await authUpdateMe(payload);
                } catch (err) {
                  console.warn('[ProfileSection.onUpdate] backend sync failed:', err?.message || err);
                  showProfileToast(language === 'বাংলা'
                    ? 'লোকালি সেভ — সার্ভার সিঙ্ক পরে হবে'
                    : 'Saved locally — server sync pending');
                }
              }}
              onAvatarUpload={async (file, _source, onProgress) => {
                // CRITICAL FIX: আগে uploadVerificationDoc('photo', ...) call হচ্ছিল
                // যেটা শুধু tenantProfile.verification.photoUrl set করে —
                // user.avatar untouched থাকে। তাই Navbar + public profile-এ
                // avatar update দেখাচ্ছিল না।
                //
                // এখন uploadAvatar use করছি — এটা POST /me/avatar hit করে,
                // user.avatar field properly set করে, response-এ updated
                // user object দেয় (authService cache + broadcast)। AuthContext
                // automatically broadcast subscribe করে — Navbar + TenantProfile
                // সব জায়গায় instantly update হবে কোনো extra setState লাগবে না।
                try {
                  await uploadAvatar(file, { onProgress });
                  // No need to setTenant / persistProfile here — authService
                  // already writes to KEY_USER and broadcasts. AuthContext
                  // re-renders all subscribers with the fresh user object.
                } catch (err) {
                  console.error('[AvatarUpload] failed:', err?.message || err);
                  throw err; // AvatarUploader UI rolls back optimistic preview
                }
              }}
              onOpenVerification={() => {
                // Server-side status takes priority — don't re-prompt a
                // user who's already been approved or whose submission is
                // mid-review. Mirrors the same guard HostDashboard uses
                // so the "verify once" promise holds on both surfaces.
                if (isVerified) {
                  showProfileToast(
                    language === 'বাংলা'
                      ? 'আপনি ইতিমধ্যেই ভেরিফাইড।'
                      : 'You are already verified.',
                  );
                  return;
                }
                if (verifPending) {
                  showProfileToast(
                    language === 'বাংলা'
                      ? 'আপনার সাবমিশন এখনও রিভিউতে আছে।'
                      : 'Your submission is under review.',
                  );
                  return;
                }
                setVerifModalOpen(true);
              }}
            />

              </div>{/* === END LEFT COLUMN === */}

              {/* === RIGHT (1 col on xl): Trust Score + Timeline + Quick Wins === */}
              <div className="xl:col-span-1 space-y-6 md:space-y-8">

            {/* === TRUST SCORE GAUGE — headline metric landlords see === */}
            <TrustGauge
              score={trustScore.score}
              tier={trustScore.tier}
              breakdown={trustScore.breakdown}
              language={language}
            />

            {/* === QUICK WINS — top 3 highest-impact unfilled items === */}
            <QuickWinsCard
              breakdown={trustScore.breakdown}
              language={language}
              onJump={() => {
                // Currently scrolls to top of profile tab; user clicks Edit
                // to fill. Real wiring would scroll to the matching section.
                if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />

            {/* === VERIFICATION TIMELINE =========================== */}
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
                  done={!!tenantProfile.phone}
                  icon={Phone}
                  textEn="Phone OTP verified"
                  textBn="ফোন OTP ভেরিফাইড"
                  language={language}
                />
                <TimelineRow
                  done={tenantProfile.verification.photo}
                  icon={Camera}
                  textEn="Profile photo uploaded"
                  textBn="প্রোফাইল ছবি আপলোড"
                  language={language}
                />
                <TimelineRow
                  done={tenantProfile.verification.nidFront && tenantProfile.verification.nidBack}
                  icon={ScanFace}
                  textEn="National ID uploaded"
                  textBn="NID আপলোড"
                  language={language}
                />

                <TimelineRow
                  done={verifPending || isVerified}
                  icon={Hourglass}
                  textEn="Submitted for admin review"
                  textBn="অ্যাডমিন রিভিউয়ের জন্য সাবমিট"
                  language={language}
                />
                <TimelineRow
                  done={isVerified}
                  icon={BadgeCheck}
                  textEn="Verified by To-Let Pro"
                  textBn="To-Let Pro দ্বারা ভেরিফাইড"
                  language={language}
                  isFinal
                />
              </div>
            </div>

              </div>{/* === END RIGHT COLUMN === */}
            </div>{/* === END xl:grid-cols-3 === */}
          </div>
  );
};

export default ProfileTab;
