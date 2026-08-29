import React, { useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { TourProvider } from "./context/TourContext.jsx";
import callProvider from "./services/callProvider";
import { getCurrentToken } from "./services/authService";
import { listTenantBookings } from "./services/bookingService";
import fcmService from "./services/fcmService";
import ErrorBoundary from './components/ErrorBoundary';

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
	const { isAuthenticated, activeRole } = useAuth();

	// Tell the instant boot splash (index.html) that React has painted, so it
	// can fade itself out. rAF waits for the first real frame so we don't
	// dismiss the splash before the UI is actually on screen.
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			window.dispatchEvent(new Event('app-ready'));
		});
		return () => cancelAnimationFrame(id);
	}, []);

	// ── Landlord: "the dashboard is home" ──────────────────────────────────
	// A landlord's home base is their Host Dashboard, not the public marketing
	// page. On each app open (fresh load / PWA reopen), an authenticated
	// landlord who lands on "/" is sent straight to /host-dashboard.
	//
	// The guard ref makes this fire AT MOST ONCE per app load: later in-session
	// visits to "/" — e.g. via the logo popup's "Go to main Home" — are honored
	// because the guard is already tripped. A page reload resets the ref (it's
	// in-memory), so reopening the app always lands on the dashboard again.
	const landlordBootHandled = useRef(false);
	useEffect(() => {
		if (landlordBootHandled.current) return;
		// Hold off until auth is actually resolved; acting on a null user would
		// either no-op or fight the user's own navigation once /me resolves.
		if (!isAuthenticated) return;
		landlordBootHandled.current = true;
		const isLandlord = activeRole === 'landlord' || activeRole === 'host';
		if (isLandlord && location.pathname === '/') {
			navigate('/host-dashboard', { replace: true });
		}
	}, [isAuthenticated, activeRole, location.pathname, navigate]);

	// ── Tenant: "the dashboard is home ONCE there's a booking" ─────────────
	// A tenant only gets the app to open on their Tenant Dashboard after they
	// are connected to a booking (a landlord added them to a lease). Until
	// then, opening the app keeps the normal public homepage — unchanged.
	//
	// Mirrors the landlord guard (fires at most once per app load) but needs an
	// async lookup — listTenantBookings() — to know whether a booking exists.
	// We only redirect if the tenant is STILL on "/" when it resolves, so we
	// never yank them off a page they navigated to while the lookup was in
	// flight. A failed lookup just leaves them on the homepage (safe default).
	const tenantBootHandled = useRef(false);
	useEffect(() => {
		if (tenantBootHandled.current) return;
		// Wait until BOTH auth and the role are resolved so we don't trip the
		// one-shot guard before we can tell this is a tenant.
		if (!isAuthenticated || !activeRole) return;
		tenantBootHandled.current = true;
		if (activeRole !== 'tenant' || location.pathname !== '/') return;
		let cancelled = false;
		(async () => {
			try {
				const bookings = await listTenantBookings();
				if (cancelled) return;
				const connected = Array.isArray(bookings) && bookings.length > 0;
				// Redirect only if connected to a booking AND the tenant hasn't
				// navigated away from "/" while the lookup was in flight.
				if (connected && window.location.pathname === '/') {
					navigate('/tenant-dashboard?tab=overview', { replace: true });
				}
			} catch {
				/* network/auth hiccup — keep them on the public homepage */
			}
		})();
		return () => { cancelled = true; };
	}, [isAuthenticated, activeRole, location.pathname, navigate]);

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
			<GlobalToaster />
			{!shouldHideAIAssistant && <GlobalAIAssistant />}
			<MobileBottomNav hideOnRoutes={['/login', '/list-property', '/properties/', '/living']} />
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
