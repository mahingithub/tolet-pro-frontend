import React, { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SettingsProvider, useSettings } from "./context/SettingsContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { TourProvider } from "./context/TourContext.jsx";
import callProvider from "./services/callProvider";
import { getCurrentToken } from "./services/authService";
import { listTenantBookings } from "./services/bookingService";
import fcmService from "./services/fcmService";
import ErrorBoundary from './components/ErrorBoundary';
import { needsBookingLookup, resolveHome } from './utils/homeSurface';
import { hasCachedSettings } from './services/settingsService';

// Existing Imports
import Navbar from "./components/Navbar";
import PropertyListing from "./components/PropertyListing";
import PropertyDetails from "./components/PropertyDetails";
import InquiryPage from "./components/InquiryModal";
import LoginPage from "./components/LoginPage";
import HostDashboard from "./components/HostDashboard";
import AddProperty from "./components/AddProperty";
import HomePage from "./components/HomePage";
import ChatSystem from "./components/ChatSystem";
import TenantDashboard from "./components/TenantDashboard";
import Living from "./components/living/Living";
import GlobalAIAssistant from "./components/GlobalAIAssistant";
import WelcomeRobotOverlay from "./components/WelcomeRobotOverlay";
import HomeIntentModal from "./components/HomeIntentModal";
import GlobalToaster from "./components/GlobalToaster";
import SmartAlertsPage from "./components/Smartalertspage";
import AIInsightsPage from "./components/Aiinsightspage";
import LandlordProfile from "./components/LandlordProfile";
import TenantProfile from "./components/TenantProfile";
import PrivacyCenter from "./components/PrivacyCenter.jsx";
import SubscriptionPage from "./components/SubscriptionPage";
import CheckoutPage from "./components/CheckoutPage";
import SupportPage from "./components/SupportPage";
import ServicesPage from "./components/ServicesPage";
import HowItWorks from "./components/HowItWorks";
import JoinPropertyPage from "./components/JoinPropertyPage";
import DeepLinkHandler from "./components/DeepLinkHandler";

// --- SEO landing pages ---
// Public, content-rich pages for the half of the product that lives behind a
// login (meal manager, roommate wallet, tenant/house management) plus the
// /to-let hub that links out to all 8 divisions and 64 districts. A crawler
// could not see any of this before — see src/seo/featurePages.js.
import ToLetHub from "./components/seo/ToLetHub";
import FeatureLanding from "./components/seo/FeatureLanding";
import RouteSeoGuard from "./components/seo/RouteSeoGuard";

// --- Mobile Shell ---
import MobileBottomNav from "./components/mobile/MobileBottomNav";

import AppDownloadBanner from "./components/AppDownloadBanner";

// --- Legal pages (Phase 7) ---
import PrivacyPolicy from "./components/legal/PrivacyPolicy";
import TermsOfService from "./components/legal/TermsOfService";
import RefundPolicy from "./components/legal/RefundPolicy";
import TrustSafety from "./components/legal/TrustSafety";

// --- Beta feedback button (Phase 7) ---
import FeedbackButton from "./components/FeedbackButton";
import GlobalCallUI from "./components/GlobalCallUI";

import ThemeWidget from "./components/shared/ThemeWidget";

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

const AppLayout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { isAuthenticated, activeRole, roles } = useAuth();
	const { settings, loading: settingsLoading } = useSettings();
	const defaultHome = settings?.app?.defaultHome || 'auto';
	// Captured once, at mount: did this device already have the user's settings?
	// See the boot effect below for why the distinction matters.
	const hadCachedPrefs = useRef(hasCachedSettings());

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
	const bootHandled = useRef(false);
	useEffect(() => {
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
			<AppDownloadBanner />
			{!shouldHideNavbar && (
				<div className={`sticky top-0 z-[60] ${isPropertyListingRoute ? "hidden lg:block" : ""}`}>
					<Navbar />
				</div>
			)}

			<Routes>
				{/* Public Routes */}
				<Route path="/" element={<HomePage />} />
				<Route path="/properties/:divisionName" element={<PropertyListing />} />
				<Route path="/property/:id" element={<PropertyDetails />} />
				<Route path="/inquire/:id" element={<InquiryPage />} />
				<Route path="/login" element={<LoginPage />} />

				{/* Tenant self-onboarding — the screen a landlord's invite QR opens.
				    PUBLIC on purpose: the link lands on phones with no account yet,
				    and a signup wall in front of "whose building is this?" is how a
				    shared link dies in a group chat. The page asks for a login itself
				    at the point it needs one — see JoinPropertyPage.jsx. */}
				<Route path="/join/:token" element={<JoinPropertyPage />} />

				{/* Help & Support — public; ticket features handle auth internally */}
				<Route path="/support" element={<SupportPage />} />

				{/* Services hub — tenant home-services catalogue (icon boxes) */}
				<Route path="/services" element={<ServicesPage />} />

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

				<Route
					path="/host-dashboard"
					element={
						<RequireAuth requireRole="landlord">
							<HostDashboard />
						</RequireAuth>
					}
				/>
				<Route
					path="/list-property"
					element={
						<RequireAuth requireRole="landlord">
							<AddProperty />
						</RequireAuth>
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
						<RequireAuth>
							<Living />
						</RequireAuth>
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
				<Route path="/ai-insights" element={<AIInsightsPage />} />
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

				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>

			<ThemeWidget />
			<GlobalCallUI />
			<WelcomeRobotOverlay />
			<HomeIntentModal />
			<GlobalToaster />
			{!shouldHideAIAssistant && <GlobalAIAssistant />}
			{/* '/living' is deliberately NOT hidden any more. It can be a user's
			    home screen now, and a home screen with no rail is a room with no
			    door: no Explore, no Messages, no Profile from the first screen
			    they see. Living's own module pills sit at the top, so the two
			    navigations don't compete. */}
			<MobileBottomNav hideOnRoutes={['/login', '/list-property', '/properties/']} />
			<FeedbackButton />
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
