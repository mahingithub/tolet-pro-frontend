/*
 * notificationRoute.js — where a tapped notification lands.
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * There were two of these. NotificationPanel.jsx (the bell dropdown) and
 * NotificationContext.jsx (the "দেখুন" button on a live toast) each carried
 * their own hand-maintained switch over `notification.type`, and they had
 * drifted from each other in three separate ways:
 *
 *   • the toast's copy had no idea who was reading it, so a landlord who
 *     tapped a payment toast was sent to /tenant-dashboard;
 *   • both pointed the tenant at `?tab=bookings`, which is not one of
 *     TENANT_TABS, so useTabHistory quietly resolved it to `overview` and the
 *     tap looked like it had done nothing;
 *   • `tenant_onboarding` — the whole self-onboarding round trip — was in
 *     neither switch, so it fell through to '/' and dropped a landlord who
 *     had just been asked to approve a tenant onto the public home page.
 *
 * Two copies of a routing table is the actual defect; the wrong destinations
 * were the symptom. One table, imported by both, is the fix.
 *
 * THE TABS ARE THE CONTRACT
 * `useTabHistory` falls back to the section root for any `?tab=` it does not
 * recognise, silently. So every tab named below has to exist:
 *   HOST_TABS   (HostDashboard.jsx)   dashboard documents analytics properties
 *                                     inquiries bookings rent payments
 *                                     smartAlerts aiInsights settings profile
 *   TENANT_TABS (TenantDashboard.jsx) overview saved applications alerts
 *                                     payments settings profile
 * The tenant has NO bookings tab — their rent, receipts and bookings all live
 * under `payments`.
 */

const HOST = {
  inquiries: '/host-dashboard?tab=inquiries',
  bookings:  '/host-dashboard?tab=bookings',
  rent:      '/host-dashboard?tab=rent',
};

const TENANT = {
  overview:     '/tenant-dashboard?tab=overview',
  applications: '/tenant-dashboard?tab=applications',
  payments:     '/tenant-dashboard?tab=payments',
};

// The state shape both dashboards already read: useDeepLinkHighlight scrolls to
// and flashes `#<prefix>-<highlightId>` (or `[data-notif-target]`), and the
// dashboards' own effects use `autoOpen` to expand the matching row.
const at = (path, highlightId) => ({
  path,
  state: highlightId
    ? { highlightId: String(highlightId), autoOpen: true, scrollTo: true }
    : undefined,
});

/**
 * Which side of the app a `tenant_onboarding` notification belongs to.
 *
 * It is the one type that travels in both directions — to the landlord when a
 * tenant submits, back to the tenant on approve / reject — so the reader's own
 * role cannot decide it: a landlord who joined someone else's building as a
 * tenant holds both roles and receives both halves. The server now stamps
 * `data.audience` (invite.controller.js). Rows written before that fall back to
 * a payload tell: only the landlord's copy carries buildingId.
 */
const onboardingAudience = (data) =>
  data.audience || (data.buildingId ? 'landlord' : 'tenant');

/**
 * Resolve a notification to a destination.
 *
 * @param {object} n            the notification ({ type, data })
 * @param {object} [opts]
 * @param {boolean} [opts.isLandlord]  is the reader in LANDLORD MODE right now
 *   (activeRole), not "does this account own the landlord role". A user with
 *   both roles is one person in one mode at a time, and role ownership sent
 *   every one of their tenant-side notifications to the host dashboard.
 * @param {string} [opts.userId]  the reader's own id, for self-profile links
 * @returns {{ path: string, state?: object }}
 */
export function notificationDestination(n, { isLandlord = false, userId = '' } = {}) {
  const data = (n && n.data) || {};
  const { targetId, peerId, peerName, peerAvatar, bookingId } = data;
  // Several producers name the same id differently. Prefer the specific one.
  const fallbackPath = data.path || data.url || '';

  switch (n && n.type) {
    case 'message':
    case 'message_new':
      return {
        path: '/messages',
        state: {
          peerUserId: peerId,
          peerName,
          peerAvatar,
          conversationId: targetId || data.conversationId,
          autoOpen: true,
        },
      };

    // Landlord-only and tenant-only by construction — routed by the type
    // itself, never by who is reading it.
    case 'inquiry_new':
      return at(HOST.inquiries, targetId || data.inquiryId);
    case 'inquiry_status':
      return at(TENANT.applications, targetId || data.inquiryId);

    // Legacy untyped inquiry notifications (pre inquiry_new / inquiry_status)
    // don't record their surface, so the reader's current mode decides.
    case 'inquiry':
      return at(isLandlord ? HOST.inquiries : TENANT.applications, targetId || data.inquiryId);

    case 'booking':
      return at(isLandlord ? HOST.bookings : TENANT.payments, targetId || bookingId);

    case 'payment':
    case 'receipt':
    case 'rent_receipt':
    case 'rent_invoice':
    case 'rent_overdue':
      return at(isLandlord ? HOST.rent : TENANT.payments, targetId || bookingId);

    // booking.controller.js sends { bookingId } (not targetId) for both
    // rent_updated emits — a rent/lease change, and being added to a rent as a
    // member.
    case 'rent_updated':
      return at(isLandlord ? HOST.rent : TENANT.payments, targetId || bookingId);

    // The self-onboarding round trip. The landlord's copy opens the Tenants
    // tab, where OnboardingApprovalsPanel sits at the top with the pending
    // card highlighted; the tenant's copy opens their rent once the landlord
    // has said yes, and their own dashboard when the answer was no.
    case 'tenant_onboarding': {
      if (onboardingAudience(data) === 'landlord') {
        return at(HOST.bookings, data.onboardingId);
      }
      return bookingId ? at(TENANT.payments, bookingId) : { path: TENANT.overview };
    }

    case 'property':
      return { path: `/property/${targetId}`, state: { autoOpen: true, scrollTo: true } };

    case 'review': {
      // Property reviews were removed — reputation reviews live on the user's
      // PROFILE, so a review notification points at the reader's own.
      if (!userId) return { path: '/' };
      return { path: isLandlord ? `/landlord/${userId}` : `/tenant/${userId}` };
    }

    // Admin-facing. These carry their own destination from the server.
    case 'kyc_tenant':
    case 'kyc_landlord':
    case 'support_ticket':
    case 'support_message':
      return fallbackPath
        ? { path: fallbackPath, state: { ticketId: data.ticketId || targetId } }
        : { path: '/admin' };

    case 'marketing':
      return { path: fallbackPath || '/subscription' };

    case 'system':
      return { path: fallbackPath || '/' };

    default:
      // '/notifications' is NOT a registered route — App.jsx's catch-all
      // silently redirects unknown paths to '/', which is what made a tapped
      // notification look like it had done nothing. Prefer a destination the
      // notification supplied itself.
      return { path: fallbackPath || '/' };
  }
}

/**
 * Is the reader in landlord mode? Reads `activeRole` (the mode the pill is
 * currently on), falling back to role ownership only when there is no active
 * role to read.
 */
export function isLandlordMode(auth) {
  const active = auth?.activeRole;
  if (active) return active === 'landlord' || active === 'host';
  const roles = Array.isArray(auth?.roles) ? auth.roles : [];
  return roles.includes('landlord') || roles.includes('host');
}
