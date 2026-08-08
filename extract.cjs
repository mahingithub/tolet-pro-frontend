const fs = require('fs');
const path = '/Users/asrafalommahin/tolet-pro/project/tolet-pro-frontend/src/components/TenantDashboard.jsx';
const content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');
const overviewLines = lines.slice(2007, 2534);
const profileLines = lines.slice(2543, 2741);

const overviewComponent = `import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, X, Heart, MessageCircle, DollarSign, Wallet, MessageSquare, Wrench, Bell, ChevronRight, ShieldAlert, RefreshCw, Home, ArrowRight, Shield, ScanFace, BadgeCheck, Calendar, MapPin, Clock, Receipt, Search, Trash2 } from 'lucide-react';
import RentProofCard from '../payments/TenantRentPay'; // Assuming this is correct
// Import other missing components as needed

const OverviewTab = ({
  language, setAddLandlordOpen, addLandlordOpen, inviteCodeInput, setInviteCodeInput,
  handleJoinByInvite, joinBusy, savedProperties, myInquiries, paymentReceipts,
  unreadReceiptsCount, totalDueAmount, tenantAlertCount, primaryLease, activeLeases,
  loggedInUser, authUser, isVerified, verifRejected, rejectionReason, setVerifModalOpen,
  isAlsoLandlord, hideBecomeLandlord, dismissBecomeLandlord, openBecomeLandlordPrompt,
  hideVerificationBanner, dismissVerificationBanner, verifPending, verifPct,
  QuickSearchCard, hideUpcomingTours, dismissUpcomingTours, t, navigate, setActiveTab,
  isInquiryUnread, inqSeen
}) => {
  return (
    <>
${overviewLines.join('\n')}
    </>
  );
};

export default OverviewTab;
`;

const profileComponent = `import React from 'react';
import { CheckCheck, UserCircle, Phone, Camera, ScanFace, Hourglass, BadgeCheck } from 'lucide-react';
import ProfileSection from '../shared/ProfileSection';

const ProfileTab = ({
  authUser, tenantProfile, trustScore, language, applyPatch, persistProfile, authUpdateMe,
  showProfileToast, uploadAvatar, isVerified, verifPending, setVerifModalOpen,
  TrustGauge, QuickWinsCard, TimelineRow
}) => {
  return (
${profileLines.join('\n')}
  );
};

export default ProfileTab;
`;

fs.mkdirSync('/Users/asrafalommahin/tolet-pro/project/tolet-pro-frontend/src/components/tenant-dashboard', { recursive: true });
fs.writeFileSync('/Users/asrafalommahin/tolet-pro/project/tolet-pro-frontend/src/components/tenant-dashboard/OverviewTab.jsx', overviewComponent);
fs.writeFileSync('/Users/asrafalommahin/tolet-pro/project/tolet-pro-frontend/src/components/tenant-dashboard/ProfileTab.jsx', profileComponent);

console.log("Files successfully created!");
