import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Search,
  MessageCircle,
  User,
  PlusCircle,
  Wallet,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { resolveHome } from '../../utils/homeSurface';
import { useIsBn } from '../../context/LanguageContext';
import useNativeExperience from '../../hooks/useNativeExperience';
import { nativeLoginUrl } from '../../utils/nativeExperience';

/**
 * MobileBottomNav — fixed-position bottom rail for the mobile app shell.
 *
 * Rendered globally in App.jsx, gated with `md:hidden` so desktop is never
 * affected. The centre slot is a raised brand-red "+ List Property" floating
 * action.
 *
 * Layout (left to right) — 5 targets for everyone (2 · FAB · 2):
 *   Tenant        : Home · Explore · [Living FAB] · Messages · Profile
 *   Landlord/guest: Home · Explore · [+List FAB]  · Messages · Profile
 *
 * Only the raised centre action changes by role: tenants get "Living"
 * (Roommate Wallet), everyone else gets "+ List". Saved lives inside the
 * tenant dashboard (Profile → Saved), keeping the rail uncluttered.
 *
 * INSTALLED APP: the rail follows the choice made on /app/start instead
 * (utils/nativeExperience.js), signed in or not:
 *   Tenant · Living : Ledger · Messages · Profile            (no FAB)
 *   Tenant · Search : Home · Explore · [Living FAB] · Messages · Profile
 *   Landlord        : Home · Properties · [+List FAB] · Messages · Profile
 * A signed-out app user tapping an action (List, Messages, Profile) goes
 * straight to login with that role already chosen — no drawer, no role picker.
 *
 * Profile button behaviour (auth-aware):
 *   - Not logged in → opens the Navbar slide-out drawer (Join TO-LET PRO,
 *     Login / Sign Up). The drawer used to open from the bell; now it lives
 *     under Profile so the bell can be reserved for notifications.
 *   - Logged in as `tenant` → /tenant-dashboard
 *   - Logged in as `landlord` → /host-dashboard
 *   - Logged in as admin/support → /admin (already-protected route)
 *
 * @param {{ hideOnRoutes?: string[] }} props - optional route prefixes where
 *   the bottom nav should be hidden (defaults to /login + /admin).
 */
const MobileBottomNav = ({ hideOnRoutes }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, roles } = useAuth();
  const { settings } = useSettings();
  const defaultHome = settings?.app?.defaultHome || 'auto';
  const isBn = useIsBn();
  const { isNative, mode: nativeMode } = useNativeExperience();

  // Event-driven hide: HostDashboard dispatches 'hide-bottom-nav' when the
  // user enters Bookings / Rent tabs, and 'show-bottom-nav' when they leave.
  const [forceHide, setForceHide] = React.useState(false);
  React.useEffect(() => {
    const hide = () => setForceHide(true);
    const show = () => setForceHide(false);
    window.addEventListener('hide-bottom-nav', hide);
    window.addEventListener('show-bottom-nav', show);
    return () => {
      window.removeEventListener('hide-bottom-nav', hide);
      window.removeEventListener('show-bottom-nav', show);
    };
  }, []);

  const hides = hideOnRoutes ?? ['/login', '/admin', '/list-property'];

  // The property-detail page (/property/:id) has its own sticky contact /
  // booking action bar pinned to the bottom on mobile. The rail would sit on
  // top of it and hide the primary CTA, so we always hide the rail there —
  // independent of the configurable `hideOnRoutes` above. (Note: the listing
  // page is /properties/all, which does NOT match '/property/'.)
  if (location.pathname.startsWith('/property/')) return null;

  if (hides.some((r) => location.pathname.startsWith(r))) return null;

  if (forceHide) return null;

  // Tenants get the Living (Roommate Wallet) centre FAB; landlords/guests get
  // the "+ List" FAB. The four flat tabs are identical for everyone, so the
  // rail is always a clean 5 targets (2 · FAB · 2).
  const isTenant = isAuthenticated && user?.role === 'tenant';
  // Landlords treat the Host Dashboard as home. The server-side role may be
  // 'landlord' or 'host', so accept both.
  const isLandlord = isAuthenticated && (user?.role === 'landlord' || user?.role === 'host');

  // null on the website, and in the app until /app/start has been answered.
  const appMode = isNative ? nativeMode : null;
  const appGuest = !!appMode && !isAuthenticated;

  // "Home" is wherever the user's home actually is — the same answer the app
  // uses when it opens (utils/homeSurface.js), not a second rule maintained
  // here. `?tab=dashboard` on the landlord path guarantees a tap always lands
  // on the overview, even if they were sitting on another dashboard tab.
  const homeTo = (() => {
    // BOTH tenant surfaces keep the public homepage as Home. Pointing Home at
    // the ledger instead is what stranded people who chose Living: the rail
    // lost Home and Explore, so the homepage, search and services became
    // unreachable from the one screen they lived on. The ledger is still one
    // tap away — it is the raised centre action below.
    if (appMode === 'living' || appMode === 'search') return '/';
    if (appMode === 'host') return '/host-dashboard?tab=dashboard';
    if (!isAuthenticated) return '/';
    const to = resolveHome({ activeRole: user?.role, roles, defaultHome, hasBooking: true });
    return to === '/host-dashboard' ? '/host-dashboard?tab=dashboard' : to;
  })();

  const homeItem = { id: 'home', label: isBn ? 'হোম' : 'Home', icon: Home, to: homeTo };

  const LEFT = appMode === 'host'
    ? [homeItem, appGuest
        ? { id: 'properties', label: isBn ? 'প্রপার্টি' : 'Properties', icon: Building2, action: 'login', next: '/host-dashboard?tab=properties' }
        : { id: 'properties', label: isBn ? 'প্রপার্টি' : 'Properties', icon: Building2, to: '/host-dashboard?tab=properties' }]
    : [homeItem, { id: 'explore', label: isBn ? 'খুঁজুন' : 'Explore', icon: Search, to: '/properties/all' }];

  // Profile target depends on who's logged in. Falls back to "open drawer"
  // for guests so they can pick Login / Sign Up.
  const profileTarget = (() => {
    if (appGuest) return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, action: 'login' };
    if (!isAuthenticated) return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, action: 'drawer' };
    if (isAdmin)           return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, to: '/admin' };
    if (isLandlord) {
      if (location.pathname.startsWith('/host-dashboard')) {
        return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, action: 'host-drawer' };
      }
      return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, to: '/host-dashboard?tab=dashboard' };
    }
    // default to tenant
    return { id: 'profile', label: isBn ? 'প্রোফাইল' : 'Profile', icon: User, to: '/tenant-dashboard' };
  })();

  const RIGHT = [
    appGuest
      ? { id: 'messages', label: isBn ? 'মেসেজ' : 'Messages', icon: MessageCircle, action: 'login', next: '/messages' }
      : { id: 'messages', label: isBn ? 'মেসেজ' : 'Messages', icon: MessageCircle, to: '/messages' },
    profileTarget,
  ];

  // Which raised action sits in the middle. Every tenant gets Living there —
  // including the one who opens on it, for whom it is now the ONLY way back to
  // the ledger from the rest of the app.
  const centre = appMode === 'host' ? 'list'
    : appMode ? 'living'
    : isTenant ? 'living' : 'list';

  const isActive = (item) => {
    if (!item.to) return false;

    // Split any ?tab= off the target so we can compare pathname + tab
    // (landlord Home → dashboard overview, Profile → dashboard settings).
    const [toPath, toQuery = ''] = (item.to || '').split('?');
    const targetTab  = new URLSearchParams(toQuery).get('tab');
    const currentTab = new URLSearchParams(location.search).get('tab');

    if (item.id === 'home') {
      if (toPath === '/') return location.pathname === '/';
      if (location.pathname !== toPath) return false;
      // A home with no ?tab= (Living, which navigates with ?m= instead) is home
      // on any of its sub-modules. One with a tab — the dashboards — is only
      // home on its overview, so the other tabs don't light the Home button up.
      if (!targetTab) return true;
      return !currentTab || currentTab === targetTab;
    }
    // Tenant Saved + Profile both point at /tenant-dashboard —
    // disambiguate via the `tab` flag in location.state so only the
    // matching button shows the active treatment.
    if (item.to === '/tenant-dashboard') {
      const onTenant = location.pathname === '/tenant-dashboard';
      if (!onTenant) return false;
      const activeTab = location.state && location.state.activeTab;
      if (item.tab === 'saved')  return activeTab === 'saved';
      if (!item.tab)             return !activeTab || activeTab === 'overview' || activeTab === 'profile';
      return activeTab === item.tab;
    }
    // Host dashboard with an explicit ?tab= (landlord Profile → settings).
    if (toPath === '/host-dashboard' && targetTab) {
      return location.pathname === '/host-dashboard' && currentTab === targetTab;
    }
    return location.pathname === toPath || location.pathname.startsWith(toPath + '/');
  };

  const handleClick = (item) => {
    if (item.action === 'login') {
      // Straight to login/sign-up with the app's chosen role — no drawer, no
      // role picker. Omitting `next` returns them to the page they are on.
      navigate(nativeLoginUrl({ next: item.next }));
      return;
    }
    if (item.action === 'drawer') {
      // Tell <Navbar> to open its slide-out drawer. See the matching
      // `open-mobile-menu` listener in Navbar.jsx.
      window.dispatchEvent(new CustomEvent('open-mobile-menu'));
      return;
    }
    if (item.action === 'host-drawer') {
      // Tell <HostDashboard> to open its right-side drawer.
      window.dispatchEvent(new CustomEvent('open-host-drawer'));
      return;
    }
    if (item.tab) {
      navigate(item.to, { state: { activeTab: item.tab } });
      return;
    }
    navigate(item.to);
  };

  const NavBtn = ({ item }) => {
    const active = isActive(item);
    const Icon = item.icon;
    const isProfile = item.id === 'profile';
    const [imgError, setImgError] = React.useState(false);

    React.useEffect(() => {
      setImgError(false);
    }, [user?.avatar]);

    const hasAvatar = isProfile && isAuthenticated && user?.avatar && !imgError;

    return (
      <button
        onClick={() => handleClick(item)}
        className="flex-1 h-full flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform select-none"
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        // Every flat tab carries an anchor, not just Home. The first-run
        // training walks a tenant around the app by making them TAP these —
        // "how do I get back to the main home page from my profile?" has no
        // answer a tour can point at unless each target is addressable.
        data-tour={`mobile-nav-${item.id}`}
      >
        <span
          className={`relative w-11 h-7 flex items-center justify-center transition-all duration-300 ${
            active ? '-translate-y-[3px]' : ''
          }`}
        >
          {active && (
            <span className="absolute inset-0 rounded-full bg-[#ba0036]/10 ring-2 ring-[#ba0036]/15" />
          )}
          {hasAvatar ? (
            <img
              key={user.avatar}
              src={user.avatar}
              alt={isBn ? 'প্রোফাইল' : 'Profile'}
              className={`relative w-[22px] h-[22px] rounded-full object-cover ${active ? 'ring-2 ring-[#ba0036]' : 'ring-1 ring-gray-200'}`}
              onError={() => setImgError(true)}
            />
          ) : (
            <Icon
              size={20}
              strokeWidth={active ? 2.6 : 2.1}
              className={`relative ${active ? 'text-[#ba0036]' : 'text-gray-500'}`}
            />
          )}
        </span>
        <span
          className={`text-[10px] font-bold transition-colors ${
            active ? 'text-[#ba0036]' : 'text-gray-500'
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* soft fade above the bar so content underneath blends smoothly */}
      <div className="md:hidden fixed inset-x-0 bottom-rail h-6 pointer-events-none bg-gradient-to-t from-white/85 to-transparent z-30" />

      {/* HEIGHT GROWS BY THE INSET — it does not absorb it. Tailwind preflight
          makes every box border-box, so the old `h-[64px]` + `padding-bottom:
          env(safe-area-inset-bottom)` subtracted the gesture bar FROM the 64px
          instead of adding to it: the rail stayed 64px tall with its lowest
          ~24px underneath the system gesture pill, and the icons + labels were
          crushed into the ~40px that were left. Taps on that bottom strip went
          to the OS, which is what "the bottom doesn't respond" actually was.

          Now: height = 64 + inset, padding-bottom = inset, so the content box
          is a true 64px sitting entirely above the gesture bar. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-rail pb-safe bg-white border-t border-gray-200 shadow-[0_-6px_20px_-8px_rgba(15,23,42,0.12)]">
        <div className="relative h-full max-w-md mx-auto flex items-center px-1">
          {LEFT.map((item) => (
            <NavBtn key={item.id} item={item} />
          ))}

          {/* CENTRE: a raised floating action. Tenants never list properties,
              so their centre slot becomes the "Living" (Roommate Wallet) entry
              — their flagship daily-use surface. Landlords + guests keep the
              "+ List" action so they can start a new listing in one tap. */}
          {centre && (
          <div className="flex-1 h-full flex flex-col items-center justify-end relative pb-1">
            {centre === 'living' ? (
              <>
                <button
                  onClick={() => navigate('/living')}
                  // The tenant's centre action, and the only way into the
                  // খাতা from a phone once the header pill is hidden — so the
                  // Living training points here on mobile.
                  data-tour="mobile-nav-living"
                  className={`absolute -top-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ba0036] via-[#d4143a] to-[#ff4d6d] text-white flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition-transform ring-4 ring-white ${
                    location.pathname === '/living' ? 'scale-105' : ''
                  }`}
                  aria-label={isBn ? 'রুমমেট ওয়ালেট' : 'Roommate Wallet'}
                  aria-current={location.pathname === '/living' ? 'page' : undefined}
                >
                  <Wallet size={24} strokeWidth={2.3} />
                </button>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#ba0036]">
                  {isBn ? 'লিভিং' : 'Living'}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={() => (appGuest ? navigate(nativeLoginUrl({ next: '/list-property' })) : navigate('/list-property'))}
                  // Tour anchor: on a phone the header's "List Property" button
                  // is hidden (`hidden sm:inline-flex`), so this FAB is the only
                  // way a landlord starts a listing — and the host dashboard
                  // tour had no step for it at all. See TourContext.jsx.
                  data-tour="mobile-nav-list"
                  className="absolute -top-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ba0036] via-[#d4143a] to-[#ff4d6d] text-white flex items-center justify-center shadow-[0_12px_30px_-8px_rgba(186,0,54,0.55)] active:scale-95 transition-transform ring-4 ring-white"
                  aria-label={isBn ? 'বিজ্ঞাপন দিন' : 'List a property'}
                >
                  <PlusCircle size={26} strokeWidth={2.2} />
                </button>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#ba0036]">
                  {isBn ? 'বিজ্ঞাপন' : 'List'}
                </span>
              </>
            )}
          </div>
          )}

          {RIGHT.map((item) => (
            <NavBtn key={item.id} item={item} />
          ))}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
