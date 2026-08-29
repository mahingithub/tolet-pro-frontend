import React from 'react';
import { Send } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

// lucide-react v1 removed its brand marks (Facebook / Instagram), so the two
// social glyphs are inlined here rather than imported — importing them again
// would break the build.
const FacebookIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
  </svg>
);

const InstagramIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const YoutubeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33Z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const Footer = () => {
  const { t } = useLanguage(); 
  const location = useLocation();
  
  // 🔴 ম্যাজিক কন্ডিশন (এখানে '/list-property' যোগ করা হয়েছে)
  if (
    location.pathname.includes('/inquire') || 
    location.pathname.includes('/success') || 
    location.pathname.includes('/login') ||
    location.pathname.includes('/host-dashboard') ||
    location.pathname.includes('/list-property') // 👈 নতুন
  ) {
    return null; 
  }
  
  return (
    <footer className="w-full bg-[#0a0f1a] text-white pt-20 pb-10 font-sans mt-10">
      <div className="max-w-7xl mx-auto px-4">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8 mb-16 border-b border-gray-800 pb-16">
          
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-brandRed font-black text-2xl tracking-tighter">{t.brand || "TO-LET PRO"}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-8 pr-4">
              {t.footerDesc}
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/profile.php?id=61593003425206"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Facebook"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brandRed hover:text-white transition-colors cursor-pointer"
              >
                <FacebookIcon size={18} />
              </a>
              <a
                href="https://www.youtube.com/channel/UC7mc__2GpSdoqUMglb7BS8g"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="YouTube"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brandRed hover:text-white transition-colors cursor-pointer"
              >
                <YoutubeIcon size={18} />
              </a>
              <a
                href="https://wa.me/+8801742898206"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="WhatsApp"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brandRed hover:text-white transition-colors cursor-pointer"
              >
                <WhatsAppIcon size={18} />
              </a>
              <a
                href="https://www.instagram.com/toletpro.rent/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brandRed hover:text-white transition-colors cursor-pointer"
              >
                <InstagramIcon size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-brandRed text-xs font-bold uppercase tracking-widest mb-6">{t.discoveryTitle}</h4>
            {/* These were four unclickable <li>s styled to look like links —
                dead ends for a visitor and invisible to a crawler. They now
                point at the pages they were always describing. */}
            <ul className="space-y-4 text-gray-400 text-sm font-medium">
              <li><Link to="/properties/all" className="hover:text-white transition-colors">{t.navNewListings}</Link></li>
              <li><Link to="/to-let" className="hover:text-white transition-colors">{t.navPopularAreas}</Link></li>
              <li><Link to="/meal-manager" className="hover:text-white transition-colors">{t.mealManagerNav || 'মিল ম্যানেজার / Meal Manager'}</Link></li>
              <li><Link to="/roommate-wallet" className="hover:text-white transition-colors">{t.roommateWalletNav || 'রুমমেট ওয়ালেট / Roommate Wallet'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-brandRed text-xs font-bold uppercase tracking-widest mb-6">{t.landlordsTitle}</h4>
            <ul className="space-y-4 text-gray-400 text-sm font-medium">
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">{t.navHowItWorks}</Link>
              </li>
              <li>
                <Link to="/list-property" className="hover:text-white transition-colors">{t.navListProperty}</Link>
              </li>
              <li>
                <Link to="/how-it-works#safety" className="hover:text-white transition-colors">{t.navTrustSafety}</Link>
              </li>
              <li><Link to="/house-manager" className="hover:text-white transition-colors">{t.houseManagerNav || 'হাউস ম্যানেজার / House Manager'}</Link></li>
              <li><Link to="/tenant-manager" className="hover:text-white transition-colors">{t.tenantManagerNav || 'ভাড়াটিয়া ম্যানেজমেন্ট / Tenant Manager'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-brandRed text-xs font-bold uppercase tracking-widest mb-6">{t.stayInspired}</h4>
            <p className="text-gray-400 text-sm mb-4">
              {t.newsletterDesc}
            </p>
            <div className="relative">
              <input 
                type="email" 
                placeholder={t.emailPlaceholder} 
                className="w-full bg-white/5 border border-gray-800 rounded-full py-3 px-5 text-sm text-white focus:outline-none focus:border-brandRed transition-colors placeholder-gray-600"
              />
              <button aria-label={t.newsletterDesc || 'Subscribe'} className="absolute right-1.5 top-1.5 w-9 h-9 bg-brandRed rounded-full flex items-center justify-center hover:bg-[#a0002e] transition-colors">
                <Send size={14} className="ml-[-2px]" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center text-xs text-gray-500 font-medium">
          <p>{t.footerCopyright}</p>
          <div className="flex flex-wrap justify-center gap-6 mt-4 md:mt-0">
            <Link to="/support" className="hover:text-white transition-colors cursor-pointer">{t.menuHelpSupport || 'Help & Support'}</Link>
            <Link to="/privacy-policy" className="hover:text-white transition-colors cursor-pointer">{t.privacyPolicyUpper || 'Privacy Policy'}</Link>
            <Link to="/terms" className="hover:text-white transition-colors cursor-pointer">{t.termsServiceUpper || 'Terms of Service'}</Link>
            <Link to="/refund" className="hover:text-white transition-colors cursor-pointer">{t.refundUpper || 'Refund Policy'}</Link>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;