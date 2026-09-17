import React, { useEffect, useRef, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SettingsProvider, useSettings } from "./context/SettingsContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { TourProvider } from "./context/TourContext.jsx";
import callProvider from "./services/callProvider";
import { getCurrentToken } from "./services/authService";
import { listTenantBookings } from "./services/bookingService";
import fcmService from "./services/fcmService";
import ErrorBoundary from './components/ErrorBoundary';
// Every code-split component below goes through this instead of React's bare
// lazy(). A route chunk that fails to download is the difference between "the
// app is offline" and "the app is broken", and lazy() alone cannot tell them
// apart — nor recover from either. See utils/lazyRoute.js.
import lazyRoute from './utils/lazyRoute';
// Not lazy: it has to be listening before the user's FIRST Back press, and it
// costs nothing until then — the Capacitor plugins it needs are imported
// dynamically inside the hook, and only on native.
import useAndroidBackButton from './hooks/useAndroidBackButton';
import { needsBookingLookup, resolveHome } from './utils/homeSurface';
import { hasCachedSettings } from './services/settingsService';
import {
	NATIVE_START_PATH,
	NATIVE_WELCOME_PATH,
	experienceForRole,
	getNativeExperience,
	getNativeHome,
	inferNativeExperience,
	isNativeApp,
	modeForSurface,
	roleMatchesExperience,
	saveNativeExperience,
	surfaceForMode,
} from './utils/nativeExperience';

// ─── CRITICAL SHELL — static, loads with the entry chunk ────────────────────
// What the user sees immediately, or what has to run before first paint. There
// is nothing to gain by deferring these: splitting them would only add a round
// trip in front of the thing the page is waiting on anyway.
import Navbar from "./components/Navbar";
import DeepLinkHandler from "./components/DeepLinkHandler";
import RouteSeoGuard from "./components/seo/RouteSeoGuard";
import MobileBottomNav from "./components/mobile/MobileBottomNav";
import AppDownloadBanner from "./components/AppDownloadBanner";

// ─── OVERLAYS — deferred, rendered above the page rather than in it ─────────
// Widgets that float on top of whatever route is showing: the AI assistant, the
// welcome robot, the theme switcher, toasts, the call UI. Together they were
// ~2,300 lines sitting in the entry chunk, delaying first paint for UI that by
// definition is not what the user came for. They mount a moment after the page
// does, behind `<Suspense fallback={null}>` (see the render tree below).
const GlobalAIAssistant = lazyRoute(() => import("./components/GlobalAIAssistant"), "GlobalAIAssistant");
const WelcomeRobotOverlay = lazyRoute(() => import("./components/WelcomeRobotOverlay"), "WelcomeRobotOverlay");
const HomeIntentModal = lazyRoute(() => import("./components/HomeIntentModal"), "HomeIntentModal");
const GlobalToaster = lazyRoute(() => import("./components/GlobalToaster"), "GlobalToaster");
// The app's one "sign in to save" ask. Raised from utils/guestSave.js wherever
// a signed-out visitor tries to write something.
const GuestLoginPrompt = lazyRoute(() => import("./components/native/GuestLoginPrompt"), "GuestLoginPrompt");
// Tells an installed user a newer Play Store build exists. Lazy: it does
// nothing for the first few seconds and nothing at all on the web.
const UpdateGate = lazyRoute(() => import("./components/UpdateGate"), "UpdateGate");
const FeedbackButton = lazyRoute(() => import("./components/FeedbackButton"), "FeedbackButton");
const GlobalCallUI = lazyRoute(() => import("./components/GlobalCallUI"), "GlobalCallUI");
const ThemeWidget = lazyRoute(() => import("./components/shared/ThemeWidget"), "ThemeWidget");

// ─── ROUTE COMPONENTS — code-split, one chunk each ──────────────────────────
// WHY THIS IS lazyRoute() AND NOT A PLAIN IMPORT.
//
// Every one of these used to be a static import, which meant Vite emitted the
// entire app as ONE 4.4MB JavaScript file (1.17MB over the wire, brotli). A
// visitor opening a single property listing downloaded the host dashboard, the
// checkout flow, the AI insights screen, the chat system and the living wallet
// before anything at all could render — and rendered NOTHING until all of it
// had arrived and parsed.
//
// On a good connection that is merely wasteful. On the connection a lot of this
// app's users actually have — a congested mobile network on a mid-range Android
// — 1.17MB is tens of seconds before first paint, and Chrome gives up first:
// that is the ERR_CONNECTION_TIMED_OUT people were reporting, and it is why it
// hit "some devices sometimes" rather than everyone always. It is a function of
// the network you happen to be on at that moment.
//
// lazyRoute() makes each route its own chunk, fetched when that route is
// opened. The initial download becomes the shell plus ONE route.
//
// The cost of splitting is that a route can now fail to load on its own, which
// is what "the app opens without internet but no page does" was: the chunk was
// never in the cache. Two things pay for it — the service worker precaches
// every chunk in the build (scripts/inject-sw-precache.mjs), and lazyRoute
// retries and recovers when one still doesn't arrive.
//
// RULE FOR ANYONE ADDING A ROUTE: put it here, not in the static block above.
// A static import silently folds the whole component tree back into the entry
// chunk, which is exactly how this regressed to 4.4MB in the first place.
const PropertyListing  = lazyRoute(() => import("./components/PropertyListing"), "PropertyListing");
const PropertyDetails  = lazyRoute(() => import("./components/PropertyDetails"), "PropertyDetails");
const InquiryPage      = lazyRoute(() => import("./components/InquiryModal"), "InquiryPage");
const LoginPage        = lazyRoute(() => import("./components/LoginPage"), "LoginPage");
const HostDashboard    = lazyRoute(() => import("./components/HostDashboard"), "HostDashboard");
const AddProperty      = lazyRoute(() => import("./components/AddProperty"), "AddProperty");
const HomePage         = lazyRoute(() => import("./components/HomePage"), "HomePage");
const ChatSystem       = lazyRoute(() => import("./components/ChatSystem"), "ChatSystem");
const TenantDashboard  = lazyRoute(() => import("./components/TenantDashboard"), "TenantDashboard");
const Living           = lazyRoute(() => import("./components/living/Living"), "Living");
const SmartAlertsPage  = lazyRoute(() => import("./components/Smartalertspage"), "SmartAlertsPage");
const AIInsightsPage   = lazyRoute(() => import("./components/Aiinsightspage"), "AIInsightsPage");
const LandlordProfile  = lazyRoute(() => import("./components/LandlordProfile"), "LandlordProfile");
const TenantProfile    = lazyRoute(() => import("./components/TenantProfile"), "TenantProfile");
const PrivacyCenter    = lazyRoute(() => import("./components/PrivacyCenter.jsx"), "PrivacyCenter");
const SubscriptionPage = lazyRoute(() => import("./components/SubscriptionPage"), "SubscriptionPage");
const CheckoutPage     = lazyRoute(() => import("./components/CheckoutPage"), "CheckoutPage");
const SupportPage      = lazyRoute(() => import("./components/SupportPage"), "SupportPage");
const ServicesPage     = lazyRoute(() => import("./components/ServicesPage"), "ServicesPage");
const CategoryProviders = lazyRoute(() => import("./components/services/CategoryProviders"), "CategoryProviders");
const ProviderDetail    = lazyRoute(() => import("./components/services/ProviderDetail"), "ProviderDetail");
const MyServiceOrders   = lazyRoute(() => import("./components/services/MyServiceOrders"), "MyServiceOrders");
const HowItWorks       = lazyRoute(() => import("./components/HowItWorks"), "HowItWorks");
const JoinPropertyPage = lazyRoute(() => import("./components/JoinPropertyPage"), "JoinPropertyPage");
const CampaignRedirect = lazyRoute(() => import("./components/CampaignRedirect"), "CampaignRedirect");
// Installed app only: the first-run "who are you?" screen. A signed-out
// landlord gets the real dashboard instead of a preview — see the route below
// and utils/guestSave.js for where the login is actually asked for.
const NativeStart       = lazyRoute(() => import("./components/native/NativeStart"), "NativeStart");

// --- SEO landing pages ---
// Public, content-rich pages for the half of the product that lives behind a
// login (meal manager, roommate wallet, tenant/house management) plus the
// /to-let hub that links out to all 8 divisions and 64 districts. A crawler
// could not see any of this before — see src/seo/featurePages.js.
const ToLetHub       = lazyRoute(() => import("./components/seo/ToLetHub"), "ToLetHub");
const FeatureLanding = lazyRoute(() => import("./components/seo/FeatureLanding"), "FeatureLanding");
const NotFoundPage = lazyRoute(() => import("./components/NotFoundPage"), "NotFoundPage");

// --- Legal pages (Phase 7) ---
const PrivacyPolicy   = lazyRoute(() => import("./components/legal/PrivacyPolicy"), "PrivacyPolicy");
const TermsOfService  = lazyRoute(() => import("./components/legal/TermsOfService"), "TermsOfService");
const RefundPolicy    = lazyRoute(() => import("./components/legal/RefundPolicy"), "RefundPolicy");
const TrustSafety     = lazyRoute(() => import("./components/legal/TrustSafety"), "TrustSafety");

// --- Admin panel ---
// The admin panel is now a SEPARATE React app (see ../tolet-pro-admin),
// hosted on its own subdomain with its own dedicated auth. It is no longer
// bundled into the consumer app.

// --- Auth-gate Imports ---
import RequireAuth from "./components/RequireAuth.jsx";

// ─── Global call socket bootstrap ───────────────────────────────────────────
// Keeps a single Socket.IO connection alive for the whole authenticated
// session, regardless of which route the user is on. Without this, the
// socket only connects when /messages is mounted, and incoming-call
// notifications miss anyone browsing Home / Explore / Dashboard.
const GlobalCallSocket = () => {
	const { isAuthenticated, user } = useAuth();

	useEffect(() => {
		if (!isAuthenticated) {
			callProvider.disconnect();
			return;
		}
		const token = getCurrentToken();
		if (!token) return;
		callProvider.connect(token);
		// Phase Call-6: register this device for incoming-call push so the user
		// is alerted even when the PWA is closed. If permission is already
		// granted, refresh the token quietly; if permission is undecided, wait
		// for the user's next tap/key so mobile browsers allow the permission
		// prompt and the token registration actually succeeds.
		const fcmTimer = setTimeout(() => {
			fcmService.enableCallNotifications({ prompt: false }).catch(() => {});
		}, 1500);
		const cleanupPushGesture = fcmService.enableCallNotificationsOnNextUserGesture();
		// No socket cleanup — we want it to persist across navigations.
		// It only tears down on logout (handled by the !isAuthenticated branch).
		return () => {
			clearTimeout(fcmTimer);
			cleanupPushGesture?.();
		};
	}, [isAuthenticated, user?.id, user?._id]);

	return null;
};

// ─── "This account has the app" ─────────────────────────────────────────────
// One fire-and-forget report per app load. It is what the admin console's
// installed/not-installed segment is built on — see services/appClientService.js
// for why a push token could not answer that question.
//
// Runs on every surface, not just the native shell: an installed PWA is also an
// install, and a plain browser session is the baseline the other two are
// distinguished from.
const AppOpenReporter = () => {
	const { isAuthenticated } = useAuth();

	useEffect(() => {
		if (!isAuthenticated) return;
		import("./services/appClientService")
			.then((m) => m.reportAppOpen())
			.catch(() => {});
	}, [isAuthenticated]);

	return null;
};

const AppLayout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { isAuthenticated, activeRole, roles } = useAuth();
	const { language } = useLanguage();
	const { settings, loading: settingsLoading, update: updateSettings } = useSettings();
	const defaultHome = settings?.app?.defaultHome || 'auto';
	// Captured once, at mount: did this device already have the user's settings?
	// See the boot effect below for why the distinction matters.
	const hadCachedPrefs = useRef(hasCachedSettings());

	// Hardware Back. Without this the app could not be closed with Back at all —
	// @capacitor/app's built-in handler consumes the press and then does nothing
	// once the WebView has no history left. See hooks/useAndroidBackButton.js.
	useAndroidBackButton({
		hint: language === 'বাংলা'
			? 'বন্ধ করতে আবার ব্যাক চাপুন'
			: 'Press Back again to exit',
	});

	// Layer 3 of the safe-area system: after each route settles, measure the
	// rendered page and report anything TAPPABLE sitting inside a system bar —
	// the failure the static lint keeps discovering one shape too late. See
	// utils/insetAudit.js. Dev only, or a debug build with the localStorage
	// flag; the dynamic import keeps it out of the production entry chunk,
	// which vite.config.js explicitly watches.
	useEffect(() => {
		const enabled =
			import.meta.env.DEV || window.localStorage?.getItem('tlpInsetAudit') === '1';
		if (!enabled) return undefined;
		let cancelled = false;
		const id = setTimeout(() => {
			import('./utils/insetAudit')
				.then(({ installInsetAudit, runInsetAudit }) => {
					if (cancelled) return;
					installInsetAudit();
					runInsetAudit({ outline: false });
				})
				.catch(() => {/* a diagnostic must never break the app */});
		}, 600);
		return () => { cancelled = true; clearTimeout(id); };
	}, [location.pathname]);

	// Tell the instant boot splash (index.html) that React has painted, so it
	// can fade itself out. rAF waits for the first real frame so we don't
	// dismiss the splash before the UI is actually on screen.
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			window.dispatchEvent(new Event('app-ready'));
		});
		return () => cancelAnimationFrame(id);
	}, []);

	// ── "Where does the app open?" ─────────────────────────────────────────
	// One decision, taken once per app load, for every kind of user. The rules
	// themselves live in utils/homeSurface.js so the post-login redirect and the
	// bottom nav's Home button answer this question identically — they used to
	// each carry their own copy, which is how they drifted apart.
	//
	// The guard ref makes this fire AT MOST ONCE per app load: later in-session
	// visits to "/" — e.g. via the logo popup's "Go to main Home" — are honored
	// because the guard is already tripped. A page reload resets the ref (it's
	// in-memory), so reopening the app always lands on the chosen home again.
	//
	// `defaultHome` normally comes off the settings CACHE, which SettingsProvider
	// hydrates synchronously — so a returning user is redirected on the first
	// frame, with no flash of the public homepage.
	// ── Installed app: open on the side this phone is set up for ──────────
	// Once there IS an experience the app always opens on it — signed in or not.
	// It is a device preference kept apart from the website's defaultHome (see
	// utils/nativeExperience.js), so the web effect below stands down inside
	// the app.
	//
	// With nothing stored, a FIRST run goes to /welcome: what the app does, and
	// one phone number. It deliberately does not ask which side they are on —
	// an account already answers that (see LoginPage's `knownUser`), and a new
	// one answers it inside signup. /app/start still asks, for the person who
	// goes there from Profile to change how they use the app.
	//
	// The session restores synchronously from cache, so a signed-in user is
	// known on the first render. One who was signed in before this screen
	// existed is not asked again: their role already answers it.
	//
	// Only "/" is redirected — a cold start from an invite or campaign link
	// keeps the page it was opened for.
	const nativeBootHandled = useRef(false);
	useEffect(() => {
		if (!isNativeApp() || nativeBootHandled.current) return;
		if (isAuthenticated && !activeRole) return;
		nativeBootHandled.current = true;
		if (location.pathname !== '/') return;
		let experience = getNativeExperience();
		if (!experience && isAuthenticated) {
			const inferred = inferNativeExperience({ activeRole, defaultHome });
			// 'account': worked out from the account rather than answered here, so
			// the account's own saved home may still correct it (see the mirror
			// effect below). A choice made on /app/start is never overwritten.
			if (inferred) experience = saveNativeExperience(inferred.role, inferred.mode, 'account');
		}
		const to = experience ? getNativeHome(experience) : NATIVE_WELCOME_PATH;
		if (to !== '/') navigate(to, { replace: true });
	}, [isAuthenticated, activeRole, defaultHome, location.pathname, navigate]);

	// ── The account's role outranks the device's choice once signed in ────
	// /app/start is what a GUEST is asked. A signed-in account already answers
	// the same question, and it can change mid-session: the tenant⇄host switch
	// in the Navbar drawer and in both dashboards all flip the active role
	// (AuthContext.setActiveRole). Without this the app stayed dressed as the
	// side picked at install — a landlord who switched to Tenant kept the
	// landlord rail and never saw Living, which is exactly what was reported.
	//
	// Only the side is adopted, never the tenant's own surface: `tenantMode`
	// remembers whether they live in Living or in search, so switching back
	// returns them to the one they were using rather than resetting it.
	//
	// It does not navigate. Each switch already routes to its own dashboard;
	// moving them a second time would fight that.
	useEffect(() => {
		if (!isNativeApp() || !isAuthenticated || !activeRole) return;
		const experience = getNativeExperience();
		if (!experience || roleMatchesExperience(experience, activeRole)) return;
		const next = experienceForRole(activeRole, { defaultHome, previous: experience });
		if (next) saveNativeExperience(next.role, next.mode, 'account');
	}, [isAuthenticated, activeRole, defaultHome]);

	// ── The choice follows the person, not just the phone ─────────────────
	// Living on the device is the right default — it works signed out, which is
	// the whole point of /app/start. But a returning user on a NEW phone (or
	// after a reinstall) has nothing on the device at all, which is how an old
	// user ends up being asked "who are you?" like a stranger.
	//
	// So the two directions:
	//   • They answered it themselves ('chosen') → mirror it onto the account's
	//     "open the app on" setting, and it is waiting for them on the next phone.
	//   • We guessed it from the account ('account') → step aside as soon as the
	//     account's own saved home arrives. A choice they made is never
	//     overwritten this way.
	useEffect(() => {
		if (!isNativeApp() || !isAuthenticated || settingsLoading) return;
		const experience = getNativeExperience();
		if (!experience) return;
		if (experience.source === 'account') {
			const saved = modeForSurface(defaultHome);
			if (experience.role === 'tenant' && saved && saved !== experience.mode) {
				saveNativeExperience('tenant', saved, 'account');
			}
			return;
		}
		const surface = surfaceForMode(experience.mode);
		// Fire-and-forget: the device already renders from its own copy, so a
		// failed write costs this session nothing and is retried on the next change.
		if (surface && surface !== defaultHome) updateSettings({ app: { defaultHome: surface } }).catch(() => {});
	}, [isAuthenticated, defaultHome, settingsLoading, updateSettings]);

	const bootHandled = useRef(false);
	useEffect(() => {
		if (isNativeApp()) return;
		if (bootHandled.current) return;
		// Wait until BOTH auth and the role are resolved, so we don't trip the
		// one-shot guard before we can tell who this is. Acting on a null user
		// would fight the user's own navigation once /me resolves.
		if (!isAuthenticated || !activeRole) return;
		// A device with no cached settings has no idea what the user chose, and
		// `defaultHome` is reading a placeholder 'auto'. Deciding now would ignore
		// their choice every time they reinstall or sign in on a new phone — the
		// exact moments the setting is meant to survive. Wait for the first load
		// to settle; it can't hang, since getSettings() falls back to the cache
		// rather than throwing when the network is gone.
		if (!hadCachedPrefs.current && settingsLoading) return;
		bootHandled.current = true;
		if (location.pathname !== '/') return;

		// An explicit preference is an answer — go, with no lookup at all.
		if (!needsBookingLookup(defaultHome, activeRole)) {
			const to = resolveHome({ activeRole, roles, defaultHome });
			if (to !== '/') navigate(to, { replace: true });
			return;
		}

		// 'auto' for a tenant is the one case that still needs asking: they only
		// get their dashboard as home once a landlord has added them to a lease.
		// We re-check the pathname when it resolves so we never yank someone off
		// a page they navigated to while the lookup was in flight, and a failed
		// lookup just leaves them on the homepage (the safe default).
		let cancelled = false;
		(async () => {
			try {
				const bookings = await listTenantBookings();
				if (cancelled) return;
				const hasBooking = Array.isArray(bookings) && bookings.length > 0;
				const to = resolveHome({ activeRole, roles, defaultHome, hasBooking });
				if (to !== '/' && window.location.pathname === '/') {
					navigate(to, { replace: true });
				}
			} catch {
				/* network/auth hiccup — keep them on the public homepage */
			}
		})();
		return () => { cancelled = true; };
	}, [isAuthenticated, activeRole, defaultHome, settingsLoading, location.pathname, navigate]);

	// Hide the marketing Navbar on dashboards, auth, admin, and the privacy center
	// (the privacy center has its own header with a back button).
	const hideNavbarRoutes = [
		// The app's first screen, and the "change how I use the app" questions,
		// are each a full screen of their own.
		NATIVE_WELCOME_PATH,
		NATIVE_START_PATH,
		"/tenant-dashboard",
		"/host-dashboard",
		"/living",
		"/login",
		"/account",
		"/subscription",
		"/checkout",
		// Property detail pages have their own dedicated sticky header
		// (Back / breadcrumb / save+share), so the marketing navbar is
		// redundant here and caused a "floating" second bar on scroll.
		"/property/",
		// The Add Property wizard has its own sticky header (title + step
		// progress); the marketing navbar stacked on top of it (plus the
		// download banner) buried the step indicators entirely.
		"/list-property",
	];
	const shouldHideNavbar = hideNavbarRoutes.some((route) =>
		location.pathname.startsWith(route),
	);

	// Show the AI Assistant ONLY on Home, Property Listing, and Property Details
	const shouldShowAIAssistant =
		location.pathname === "/" ||
		location.pathname.startsWith("/properties/") ||
		location.pathname.startsWith("/property/") ||
		// Dashboards too — landlords/tenants need the helpdesk + AI guides
		// exactly where they manage their listings and rentals.
		location.pathname.startsWith("/tenant-dashboard") ||
		location.pathname.startsWith("/host-dashboard");

	const shouldHideAIAssistant = !shouldShowAIAssistant;

	// On the property listing page, the Navbar is replaced on mobile by the
	// immersive Daraz-style header built into PropertyListing itself.
	// We still render it on desktop (lg+) so the brand bar stays visible there.
	const isPropertyListingRoute = location.pathname.startsWith("/properties/");

	return (
		<div className="min-h-screen bg-white">
			{/* Routes an https://…/join/<token> link that was opened on a device
			    with the app installed INTO the app, instead of letting it bounce
			    the tenant into a mobile browser. No-op on the web build. */}
			<DeepLinkHandler />
			{/* Head defaults for routes that don't manage their own: noindex for
			    every private screen and for /join/<token> invite links, plus
			    real titles for the small public pages. Rendered ABOVE <Routes>
			    on purpose — its effect runs first, so any page with its own
			    useSeo() still wins. */}
			<RouteSeoGuard />
			<GlobalCallSocket />
			<AppOpenReporter />
			<AppDownloadBanner />
			{/* safe-area-ok — this wrapper only positions the header; <Navbar />
			    itself carries paddingTop: var(--sat). Adding it here too would
			    reserve the status bar twice. */}
			{!shouldHideNavbar && (
				<div className={`sticky top-0 z-[60] ${isPropertyListingRoute ? "hidden lg:block" : ""}`}>
					<Navbar />
				</div>
			)}

			{/* Every route below is lazy(), so a Suspense boundary is REQUIRED —
			    without one React throws the moment a route chunk is still in
			    flight. The fallback is deliberately a bare branded panel and not
			    a spinner component: it has to be part of the entry chunk (it is
			    what shows WHILE the real chunk downloads), so anything richer
			    would put weight back into the file this change exists to shrink.

			    It matches the app's splash colour so a slow route transition
			    reads as the app loading rather than as a blank white failure —
			    which is what a lot of "the site didn't load" reports actually
			    were. */}
			<Suspense
				fallback={
					<div
						className="flex min-h-[60vh] w-full items-center justify-center bg-white dark:bg-slate-950"
						role="status"
						aria-live="polite"
					>
						<span className="sr-only">লোড হচ্ছে…</span>
						<span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-rose-700 dark:border-slate-700 dark:border-t-rose-500" />
					</div>
				}
			>
			<Routes>
				{/* Public Routes */}
				<Route path="/" element={<HomePage />} />
				<Route path="/properties/:divisionName" element={<PropertyListing />} />
				<Route path="/property/:id" element={<PropertyDetails />} />
				<Route path="/inquire/:id" element={<InquiryPage />} />
				<Route path="/login" element={<LoginPage />} />
				{/* The app's first screen IS the login screen, with the carousel
				    above it — same component, so the phone, country, OTP and
				    session handling cannot drift between the two. The website
				    has no first run, and two URLs for one auth form is a
				    duplicate for search engines, so it goes to /login. */}
				<Route
					path={NATIVE_WELCOME_PATH}
					element={isNativeApp() ? <LoginPage /> : <Navigate to="/login" replace />}
				/>

				{/* Tenant self-onboarding — the screen a landlord's invite QR opens.
				    PUBLIC on purpose: the link lands on phones with no account yet,
				    and a signup wall in front of "whose building is this?" is how a
				    shared link dies in a group chat. The page asks for a login itself
				    at the point it needs one — see JoinPropertyPage.jsx. */}
				<Route path="/join/:token" element={<JoinPropertyPage />} />

				{/* Campaign short link from a promotional SMS / WhatsApp.
				    PUBLIC for the same reason /join is: the recipient is usually
				    signed out on the phone that opened it, and that is who the
				    campaign is for. It resolves the code and forwards to the real
				    destination, which asks for a login itself if it needs one
				    (RequireAuth → /login?next=…). See CampaignRedirect.jsx. */}
				<Route path="/r/:code" element={<CampaignRedirect />} />

				{/* Help & Support — public; ticket features handle auth internally */}
				<Route path="/support" element={<SupportPage />} />

				{/* ── Service marketplace ─────────────────────────────────────
				    PUBLIC, all of it. Browsing and ringing a shop is exactly
				    what a signed-out visitor should be able to do — the gate
				    sits on ORDERING, inside the screens, because an order
				    creates an obligation between two named people.

				    '/services/orders' is declared before '/services/p/:id' and
				    '/services/c/:category' would ever be asked to match it. The
				    prefixes differ today, so this is not strictly required —
				    but a future '/services/:something' would swallow all three
				    if it sat above them. */}
				<Route path="/services" element={<ServicesPage />} />
				<Route path="/services/orders" element={<MyServiceOrders />} />
				<Route path="/services/c/:category" element={<CategoryProviders />} />
				<Route path="/services/p/:id" element={<ProviderDetail />} />

				{/* How it Works — public marketing page */}
				<Route path="/how-it-works" element={<HowItWorks />} />

				{/* ── SEO landing pages (public, no auth) ─────────────────────
				    /to-let is the crawlable index of all 71 location pages;
				    the rest describe a feature to a signed-out visitor who
				    arrived from a search like "মিল ম্যানেজার অ্যাপ". All five
				    feature routes render one component driven by
				    src/seo/featurePages.js, keyed off the pathname. */}
				<Route path="/to-let" element={<ToLetHub />} />
				<Route path="/meal-manager" element={<FeatureLanding />} />
				<Route path="/roommate-wallet" element={<FeatureLanding />} />
				<Route path="/house-manager" element={<FeatureLanding />} />
				<Route path="/tenant-manager" element={<FeatureLanding />} />
				<Route path="/home-services" element={<FeatureLanding />} />

				{/* Legal pages — public, no auth required (Phase 7) */}
				<Route path="/privacy-policy" element={<PrivacyPolicy />} />
				<Route path="/terms" element={<TermsOfService />} />
				<Route path="/refund" element={<RefundPolicy />} />
				<Route path="/trust-safety" element={<TrustSafety />} />

				{/* Installed app only — NativeStart sends the website back to "/". */}
				<Route path={NATIVE_START_PATH} element={<NativeStart />} />

				<Route
					path="/host-dashboard"
					element={
						// A signed-out landlord in the app gets the REAL dashboard, empty:
						// the rent ledger, bookings and properties are the product, and a
						// preview card cannot explain them. Their own data needs an
						// account, so the lists come back empty and every write raises the
						// "sign in to save" ask. The website keeps its wall.
						isNativeApp() && !isAuthenticated ? (
							<HostDashboard />
						) : (
							<RequireAuth requireRole="landlord">
								<HostDashboard />
							</RequireAuth>
						)
					}
				/>
				<Route
					path="/list-property"
					element={
						// In the app a guest walks the whole wizard and only meets the
						// login at PUBLISH — AddProperty parks the draft, sends them to
						// login and republishes on the way back (?resume=1). The website
						// keeps its wall.
						isNativeApp() ? (
							<AddProperty />
						) : (
							<RequireAuth requireRole="landlord">
								<AddProperty />
							</RequireAuth>
						)
					}
				/>
				<Route path="/messages" element={<ChatSystem />} />
				<Route
					path="/tenant-dashboard"
					element={
						<RequireAuth requireRole="tenant">
							<TenantDashboard />
						</RequireAuth>
					}
				/>
				<Route
					path="/living"
					element={
						// In the app a guest can open the wallet and look around; every
						// add / save goes to login instead (living/useLivingAction.js).
						isNativeApp() ? (
							<Living />
						) : (
							<RequireAuth>
								<Living />
							</RequireAuth>
						)
					}
				/>
				<Route
					path="/smart-alerts"
					element={
						<RequireAuth>
							<SmartAlertsPage />
						</RequireAuth>
					}
				/>
				{/* Landlord-only data, gated like /subscription. Open to guests, it fired
				    GET /api/host/insights → 401, then a pointless /auth/refresh → 401,
				    and rendered an empty page. */}
				<Route
					path="/ai-insights"
					element={
						<RequireAuth requireRole="landlord">
							<AIInsightsPage />
						</RequireAuth>
					}
				/>
				<Route path="/landlord/:id" element={<LandlordProfile />} />
				<Route path="/tenant/:id" element={<TenantProfile />} />

				<Route
					path="/subscription"
					element={
						<RequireAuth requireRole="landlord">
							<SubscriptionPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/checkout/:planId"
					element={
						<RequireAuth>
							<CheckoutPage />
						</RequireAuth>
					}
				/>
				<Route
					path="/account/privacy"
					element={
						<RequireAuth>
							<PrivacyCenter />
						</RequireAuth>
					}
				/>

				{/* An unknown URL gets a real "not found" page (noindex, with links
				    onward) instead of silently becoming another copy of the homepage. */}
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
			</Suspense>

			{/* OVERLAYS — deferred on purpose, with fallback={null}.
			    None of these is part of the page: they are widgets that sit ON
			    TOP of it (theme switcher, call UI, welcome robot, AI assistant,
			    feedback button). Loading them in the entry chunk meant the user
			    waited on ~2,300 lines of overlay code before the page they
			    actually asked for could paint.
			    fallback={null} because "not there yet" is the correct look for
			    an overlay — a spinner for a floating button would be worse than
			    the button simply appearing a moment later. */}
			<Suspense fallback={null}>
				{/* Website only. The app is locked to one scheme (see
				    SettingsContext.resolveTheme), so a floating light/dark/system
				    switcher there is a control that changes nothing — and it sat
				    on top of every screen to do it. */}
				{!isNativeApp() && <ThemeWidget />}
				<GlobalCallUI />
				<WelcomeRobotOverlay />
				<HomeIntentModal />
				<GlobalToaster />
				<GuestLoginPrompt />
				<UpdateGate />
				{!shouldHideAIAssistant && <GlobalAIAssistant />}
			</Suspense>
			{/* '/living' is hidden again: two navigations on one screen read as
			    clutter, and Living already carries its own — the module pills
			    below the header switch modules, and the header avatar goes to
			    the dashboard — so the rail only added a second competing bar. */}
			{/* '/living' keeps the rail hidden everywhere: the ledger carries its
			    own module pills, and the generic tabs (Explore, Messages) are not
			    what someone keeping accounts needs under them. The way OUT of the
			    ledger is a Home button in Living's own header — without it, a
			    tenant whose home IS the ledger had no route back to the homepage. */}
			<MobileBottomNav hideOnRoutes={['/login', NATIVE_WELCOME_PATH, '/list-property', NATIVE_START_PATH, '/living', '/properties/']} />
			<Suspense fallback={null}>
				<FeedbackButton />
			</Suspense>
		</div>
	);
};

function App() {
	return (
		<ErrorBoundary>
			<Router>
				<AuthProvider>
					<LanguageProvider>
						<SettingsProvider>
							<NotificationProvider>
								<TourProvider>
									<AppLayout />
								</TourProvider>
							</NotificationProvider>
						</SettingsProvider>
					</LanguageProvider>
				</AuthProvider>
			</Router>
		</ErrorBoundary>
	);
}

export default App;
