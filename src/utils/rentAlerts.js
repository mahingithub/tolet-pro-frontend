/**
 * rentAlerts.js — derive rent Smart Alerts from a host's bookings + ledger.
 * ──────────────────────────────────────────────────────────────────────────
 * Pure: no React, no network. Returns `{ alerts, resolved }`.
 *
 *   alerts   → actionable rent alerts (urgent / medium / low)
 *   resolved → this month's rent that is already collected (positive feedback)
 *
 * Severity:
 *   urgent  → overdue (grace passed) OR due now (past due date, still in grace)
 *   medium  → due within 5 days
 *   low     → due within 6–14 days (early heads-up)
 *
 * `iconType` is a string the page maps to an icon (keeps this file React-free).
 */

const MS_DAY = 86400000;

function startOfDay(value) {
  const x = new Date(value);
  if (isNaN(x.getTime())) return null;
  x.setHours(0, 0, 0, 0);
  return x;
}

function monthKeyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtAmount(n, bn) {
  return Number(n || 0).toLocaleString(bn ? 'bn-BD' : 'en-IN');
}

function fmtDate(d, bn) {
  try {
    return d.toLocaleDateString(bn ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function buildRentAlerts(bookings = [], today = new Date(), lang = 'English') {
  const bn = lang === 'বাংলা';
  const t0 = startOfDay(today) || startOfDay(new Date());
  const alerts = [];
  const resolved = [];

  for (const b of (bookings || [])) {
    if (!b) continue;
    if (b.status === 'cancelled' || b.deletedAt) continue;

    // Only leases that are currently running.
    const leaseStart = b.leaseStart ? startOfDay(b.leaseStart) : null;
    const leaseEnd = b.leaseEnd ? startOfDay(b.leaseEnd) : null;
    if (leaseStart && t0 < leaseStart) continue;
    if (leaseEnd && t0 > leaseEnd) continue;

    const dueDay = Math.min(Math.max(Number(b.rentDueDay) || 5, 1), 28);
    const grace = Math.max(Number(b.gracePeriodDays) || 0, 0);
    const lateFee = Math.max(Number(b.lateFeeAmount) || 0, 0);
    const rent = Math.max(Number(b.monthlyRent) || 0, 0);
    const service = Math.max(Number(b.serviceCharge) || 0, 0);
    const totalDue = rent + service;

    // This month's due date + ledger entry.
    const dueDate = new Date(t0.getFullYear(), t0.getMonth(), dueDay);
    const key = monthKeyOf(dueDate);
    const entry = (b.ledger && b.ledger[key]) || null;
    const isPaid = !!entry && (entry.paid === true || entry.status === 'full');

    const tenant = b.tenant || (bn ? 'ভাড়াটিয়া' : 'Tenant');
    const phone = b.tenantPhone || '';
    const property = b.property || '';
    const dueStr = fmtDate(dueDate, bn);
    const amountStr = fmtAmount(totalDue, bn);
    const idBase = `rent-${b.id || tenant}-${key}`;

    if (isPaid) {
      resolved.push({
        id: idBase,
        type: 'low',
        iconType: 'collected',
        title: bn ? `ভাড়া আদায় হয়েছে — ${tenant}` : `Rent collected — ${tenant}`,
        detail: `${property ? property + ' • ' : ''}৳${amountStr} ${bn ? 'পরিশোধিত' : 'paid'}`,
        resolvedOn: (entry && entry.paidOn) ? entry.paidOn : (bn ? 'পরিশোধিত' : 'Paid'),
      });
      continue;
    }

    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + grace);
    const daysUntilDue = Math.round((dueDate - t0) / MS_DAY);
    const daysPastGrace = Math.round((t0 - graceEnd) / MS_DAY);

    const common = {
      id: idBase,
      category: 'payment',
      bookingId: b.id || null,
      tenant,
      phone,
      dueDate: dueStr,
      amount: amountStr,
    };

    if (t0 > graceEnd) {
      // OVERDUE — grace period has passed.
      alerts.push({
        ...common,
        type: 'urgent',
        iconType: 'overdue',
        title: bn ? `ভাড়া বকেয়া — ${tenant}` : `Rent overdue — ${tenant}`,
        subtitle: bn
          ? `${daysPastGrace} দিন পার${lateFee ? ` • ৳${fmtAmount(lateFee, bn)} বিলম্ব ফি` : ''}`
          : `${daysPastGrace} days past grace${lateFee ? ` • ৳${fmtAmount(lateFee, bn)} late fee` : ''}`,
        detail: bn
          ? `${tenant}-এর ${key} মাসের ভাড়া ৳${amountStr} এখনো বাকি। নির্ধারিত তারিখ ছিল ${dueStr}, grace period শেষ।${lateFee ? ` ৳${fmtAmount(lateFee, bn)} বিলম্ব ফি যোগ হতে পারে।` : ''}`
          : `${tenant}'s ৳${amountStr} rent for ${key} is still unpaid. It was due ${dueStr} and the grace period has ended.${lateFee ? ` A ৳${fmtAmount(lateFee, bn)} late fee may apply.` : ''}`,
        daysLeft: null,
      });
    } else if (t0 >= dueDate) {
      // DUE — on/after the due date but still inside the grace window.
      const graceLeft = Math.max(grace - Math.round((t0 - dueDate) / MS_DAY), 0);
      alerts.push({
        ...common,
        type: 'urgent',
        iconType: 'dueToday',
        title: bn ? `ভাড়া এখন due — ${tenant}` : `Rent due now — ${tenant}`,
        subtitle: bn
          ? `নির্ধারিত তারিখ পেরিয়েছে • grace-এ ${graceLeft} দিন বাকি`
          : `Past due date • ${graceLeft}d of grace left`,
        detail: bn
          ? `${tenant}-এর ${key} মাসের ভাড়া ৳${amountStr} এখন বকেয়া (নির্ধারিত ${dueStr})। grace period এখনো চলছে — দ্রুত আদায় করলে বিলম্ব ফি এড়ানো যাবে।`
          : `${tenant}'s ৳${amountStr} rent for ${key} is now due (was ${dueStr}). Still within grace — collect soon to avoid a late fee.`,
        daysLeft: null,
      });
    } else if (daysUntilDue <= 5) {
      // DUE SOON.
      alerts.push({
        ...common,
        type: 'medium',
        iconType: 'dueSoon',
        title: bn ? `ভাড়া due ${daysUntilDue} দিনে — ${tenant}` : `Rent due in ${daysUntilDue}d — ${tenant}`,
        subtitle: bn ? `নির্ধারিত তারিখ ${dueStr}` : `Due ${dueStr}`,
        detail: bn
          ? `${tenant}-এর ${key} মাসের ভাড়া ৳${amountStr} ${daysUntilDue} দিনের মধ্যে (${dueStr}) দিতে হবে। এখনই একটি রিমাইন্ডার পাঠাতে পারেন।`
          : `${tenant}'s ৳${amountStr} rent for ${key} is due in ${daysUntilDue} day(s) (${dueStr}). A friendly reminder now helps.`,
        daysLeft: daysUntilDue,
      });
    } else if (daysUntilDue <= 14) {
      // UPCOMING — early heads-up.
      alerts.push({
        ...common,
        type: 'low',
        iconType: 'upcoming',
        title: bn ? `আসন্ন ভাড়া — ${tenant}` : `Upcoming rent — ${tenant}`,
        subtitle: bn ? `${daysUntilDue} দিনে due (${dueStr})` : `Due in ${daysUntilDue}d (${dueStr})`,
        detail: bn
          ? `${tenant}-এর ${key} মাসের ভাড়া ৳${amountStr} আসছে ${dueStr}-এ।`
          : `${tenant}'s ৳${amountStr} rent for ${key} is coming up on ${dueStr}.`,
        daysLeft: daysUntilDue,
      });
    }
  }

  const rank = { urgent: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => (rank[a.type] - rank[b.type]) || ((a.daysLeft ?? 999) - (b.daysLeft ?? 999)));
  return { alerts, resolved };
}

/**
 * buildLeaseAlerts — alerts for leases that are ending soon or already expired.
 *   urgent → expired (still active) OR ending within 7 days
 *   medium → ending within 8–30 days
 * Category: 'lease'.
 */
export function buildLeaseAlerts(bookings = [], today = new Date(), lang = 'English') {
  const bn = lang === 'বাংলা';
  const t0 = startOfDay(today) || startOfDay(new Date());
  const alerts = [];

  for (const b of (bookings || [])) {
    if (!b) continue;
    if (b.status === 'cancelled' || b.status === 'completed' || b.deletedAt) continue;

    const leaseEnd = b.leaseEnd ? startOfDay(b.leaseEnd) : null;
    if (!leaseEnd) continue;

    const daysToEnd = Math.round((leaseEnd - t0) / MS_DAY);
    if (daysToEnd > 30) continue; // not relevant yet

    const tenant = b.tenant || (bn ? 'ভাড়াটিয়া' : 'Tenant');
    const phone = b.tenantPhone || '';
    const property = b.property || '';
    const endStr = fmtDate(leaseEnd, bn);
    const common = {
      id: `lease-${b.id || tenant}`,
      category: 'lease',
      bookingId: b.id || null,
      tenant,
      phone,
      dueDate: endStr,
    };

    if (daysToEnd < 0) {
      const ago = Math.abs(daysToEnd);
      alerts.push({
        ...common,
        type: 'urgent',
        iconType: 'leaseExpired',
        title: bn ? `লিজ শেষ হয়েছে — ${tenant}` : `Lease ended — ${tenant}`,
        subtitle: bn ? `${ago} দিন আগে শেষ (${endStr})` : `Ended ${ago}d ago (${endStr})`,
        detail: bn
          ? `${property ? property + '-এর ' : ''}${tenant}-এর লিজ ${endStr}-এ শেষ হয়েছে। নবায়ন করুন, অথবা নতুন ভাড়াটিয়ার জন্য বাসাটি আবার লিস্ট করুন।`
          : `${tenant}'s lease${property ? ' for ' + property : ''} ended on ${endStr}. Renew it, or re-list the property for a new tenant.`,
        daysLeft: null,
      });
    } else if (daysToEnd <= 7) {
      alerts.push({
        ...common,
        type: 'urgent',
        iconType: 'leaseEnding',
        title: bn ? `লিজ শেষ ${daysToEnd} দিনে — ${tenant}` : `Lease ends in ${daysToEnd}d — ${tenant}`,
        subtitle: bn ? `শেষ তারিখ ${endStr}` : `Ends ${endStr}`,
        detail: bn
          ? `${property ? property + '-এর ' : ''}${tenant}-এর লিজ ${daysToEnd} দিনে (${endStr}) শেষ হচ্ছে। এখনই নবায়নের কথা বলুন, নয়তো নতুন ভাড়াটিয়া খোঁজা শুরু করুন।`
          : `${tenant}'s lease${property ? ' for ' + property : ''} ends in ${daysToEnd} day(s) (${endStr}). Discuss renewal now, or start finding a new tenant.`,
        daysLeft: daysToEnd,
      });
    } else {
      alerts.push({
        ...common,
        type: 'medium',
        iconType: 'leaseEnding',
        title: bn ? `লিজ শেষ ${daysToEnd} দিনে — ${tenant}` : `Lease ends in ${daysToEnd}d — ${tenant}`,
        subtitle: bn ? `শেষ তারিখ ${endStr}` : `Ends ${endStr}`,
        detail: bn
          ? `${property ? property + '-এর ' : ''}${tenant}-এর লিজ ${endStr}-এ শেষ হবে (${daysToEnd} দিন বাকি)। নবায়ন বা পরবর্তী পরিকল্পনা শুরু করার ভালো সময়।`
          : `${tenant}'s lease${property ? ' for ' + property : ''} ends on ${endStr} (${daysToEnd} days left). A good time to plan renewal or next steps.`,
        daysLeft: daysToEnd,
      });
    }
  }

  return { alerts };
}

/**
 * buildInquiryAlerts — alerts that protect leads and response rate.
 *   • Unanswered inquiry  → pending with no reply (urgent if >48h, medium if >24h)
 *   • Hot property        → 2+ pending inquiries on the same property
 * Category: 'inquiry'.
 */
export function buildInquiryAlerts(inquiries = [], today = new Date(), lang = 'English') {
  const bn = lang === 'বাংলা';
  const now = new Date(today);
  const alerts = [];

  const isPending = (s) => !s || s === 'sent' || s === 'pending' || s === 'new';
  const pending = (inquiries || []).filter((q) => q && isPending(q.status) && !q.deletedAt);

  // 1) Unanswered inquiries
  const HOURS_URGENT = 48;
  const HOURS_MEDIUM = 24;
  for (const q of pending) {
    const tenant = q.name || q.tenant || q.tenantName || (bn ? 'একজন' : 'Someone');
    const phone = q.phone || q.tenantPhone || '';
    const property = q.property || q.propertyTitle || q.propertyName || '';
    const created = q.createdAt || q.time || q.date || q.created || null;
    const createdDate = created ? new Date(created) : null;
    const validDate = createdDate && !isNaN(createdDate.getTime());
    const hoursAgo = validDate ? Math.round((now - createdDate) / 3600000) : null;

    // Don't nag for inquiries fresher than 24h (only if we know the age).
    if (hoursAgo !== null && hoursAgo < HOURS_MEDIUM) continue;

    const type = (hoursAgo !== null && hoursAgo >= HOURS_URGENT) ? 'urgent' : 'medium';
    const ageStr = hoursAgo === null
      ? (bn ? 'অপেক্ষমাণ' : 'awaiting reply')
      : hoursAgo >= 48
        ? (bn ? `${Math.floor(hoursAgo / 24)} দিন ধরে অপেক্ষায়` : `waiting ${Math.floor(hoursAgo / 24)}d`)
        : (bn ? `${hoursAgo} ঘণ্টা ধরে অপেক্ষায়` : `waiting ${hoursAgo}h`);

    alerts.push({
      id: `inq-${q.id || tenant}`,
      category: 'inquiry',
      type,
      iconType: 'inquiry',
      title: bn ? `উত্তরহীন inquiry — ${tenant}` : `Unanswered inquiry — ${tenant}`,
      subtitle: `${property ? property + ' • ' : ''}${ageStr}`,
      detail: bn
        ? `${tenant} ${property ? `"${property}" নিয়ে ` : ''}জানতে চেয়েছেন, এখনো উত্তর দেওয়া হয়নি (${ageStr})। দ্রুত উত্তর দিলে response rate ভালো থাকে আর ভাড়া হওয়ার সম্ভাবনা বাড়ে।`
        : `${tenant} inquired${property ? ` about "${property}"` : ''} and hasn't had a reply yet (${ageStr}). Replying quickly protects your response rate and improves conversion.`,
      tenant,
      phone,
      daysLeft: null,
      inquiryId: q.id || null,
      propertyId: q.propertyId || null,
    });
  }

  // 2) Hot property — multiple pending inquiries on the same property
  const byProp = {};
  for (const q of pending) {
    const pid = q.propertyId || q.property || 'unknown';
    (byProp[pid] = byProp[pid] || []).push(q);
  }
  for (const pid of Object.keys(byProp)) {
    const group = byProp[pid];
    if (group.length < 2) continue;
    const property = group[0].property || group[0].propertyTitle || group[0].propertyName || (bn ? 'একটি বাসা' : 'a property');
    alerts.push({
      id: `hot-${pid}`,
      category: 'inquiry',
      type: group.length >= 3 ? 'urgent' : 'medium',
      iconType: 'hot',
      title: bn ? `চাহিদাসম্পন্ন বাসা — ${property}` : `Hot property — ${property}`,
      subtitle: bn ? `${group.length} জন আগ্রহী` : `${group.length} interested tenants`,
      detail: bn
        ? `"${property}"-এর জন্য ${group.length} জন আগ্রহ দেখিয়েছেন। দ্রুত সিদ্ধান্ত নিন — সবচেয়ে উপযুক্ত ভাড়াটিয়া বেছে নিন বা ভিজিট সাজান, নাহলে তারা অন্য বাসা দেখবেন।`
        : `"${property}" has ${group.length} interested tenants. Move fast — pick the best fit or schedule visits before they look elsewhere.`,
      daysLeft: null,
      propertyId: pid,
    });
  }

  return { alerts };
}

/**
 * buildTenantAlerts — the tenant's side ("both parties" half).
 * Derived from the tenant's own data: rent ledger receipts + inquiry status.
 *
 *   Rent (from receipts, monthly granularity):
 *     • overdue   → a past month still has an outstanding balance
 *     • due       → the current month has an outstanding balance
 *     • upcoming  → a future month has a balance (gentle heads-up)
 *     • receipt   → a new (unread) paid receipt is ready  [actionable]
 *     • collected → already-seen paid month               [resolved]
 *   Inquiry (from status):
 *     • accepted  → landlord accepted the inquiry 🎉       [contact]
 *     • replied   → landlord replied                       [contact]
 *
 * Each alert carries `actionType` ('view_receipt' | 'contact_landlord') and an
 * `actionLabel` so the shared page can show the right button + dispatch.
 */
export function buildTenantAlerts(inquiries = [], receipts = [], today = new Date(), lang = 'English') {
  const bn = lang === 'বাংলা';
  const t0 = startOfDay(today) || startOfDay(new Date());
  const curKey = monthKeyOf(t0);
  const alerts = [];
  const resolved = [];

  // ── Rent, from the tenant's ledger receipts ──
  for (const r of (receipts || [])) {
    if (!r || !r.monthKey) continue;
    const balance = Number(r.balance ?? ((Number(r.totalDue) || 0) - (Number(r.totalPaid) || 0))) || 0;
    const isFull = r.status === 'full' || balance <= 0;
    const property = r.propertyTitle || (bn ? 'আপনার বাসা' : 'your rental');
    const monthLbl = r.monthLabel || r.monthKey;
    const idTail = `${r.monthKey}-${r.propertyId || ''}`;

    if (isFull) {
      if (r.read === false) {
        alerts.push({
          id: `trcpt-${idTail}`,
          category: 'payment', type: 'low', iconType: 'receipt',
          title: bn ? `নতুন রিসিট — ${monthLbl}` : `New receipt — ${monthLbl}`,
          subtitle: bn ? `${property} • পরিশোধিত` : `${property} • paid`,
          detail: bn
            ? `${property}-এর ${monthLbl} মাসের ভাড়ার রিসিট তৈরি হয়েছে। দেখে নিন এবং রেকর্ডের জন্য রাখুন।`
            : `Your rent receipt for ${monthLbl} (${property}) is ready. Open it and keep it for your records.`,
          daysLeft: null, actionType: 'view_receipt', actionLabel: bn ? 'রিসিট দেখুন' : 'View receipt', monthKey: r.monthKey,
        });
      } else {
        resolved.push({
          id: `trcpt-${idTail}`, type: 'low', iconType: 'collected',
          title: bn ? `ভাড়া পরিশোধিত — ${monthLbl}` : `Rent paid — ${monthLbl}`,
          detail: `${property} • ৳${fmtAmount(r.totalPaid || 0, bn)}`,
          resolvedOn: r.date || (bn ? 'পরিশোধিত' : 'Paid'),
        });
      }
      continue;
    }

    // Outstanding balance (unpaid / partial)
    const amountStr = fmtAmount(balance, bn);
    const isPast = r.monthKey < curKey;
    const isCurrent = r.monthKey === curKey;
    let type, iconType, title, subtitle, detail;
    if (isPast) {
      type = 'urgent'; iconType = 'overdue';
      title = bn ? `ভাড়া বকেয়া — ${monthLbl}` : `Rent overdue — ${monthLbl}`;
      subtitle = bn ? `${property} • ৳${amountStr} বাকি` : `${property} • ৳${amountStr} due`;
      detail = bn
        ? `${property}-এর ${monthLbl} মাসের ভাড়া ৳${amountStr} এখনো বাকি। দেরি হলে বিলম্ব ফি লাগতে পারে — দ্রুত পরিশোধ করুন বা মালিকের সাথে কথা বলুন।`
        : `৳${amountStr} rent for ${monthLbl} (${property}) is still outstanding. Late payment may add a fee — pay soon or talk to your landlord.`;
    } else if (isCurrent) {
      type = 'medium'; iconType = 'dueToday';
      title = bn ? `এ মাসের ভাড়া বাকি — ${monthLbl}` : `This month's rent due — ${monthLbl}`;
      subtitle = `${property} • ৳${amountStr}`;
      detail = bn
        ? `${property}-এর ${monthLbl} মাসের ভাড়া ৳${amountStr} বাকি আছে। সময়মতো পরিশোধ করলে ঝামেলা এড়ানো যায়।`
        : `৳${amountStr} rent for ${monthLbl} (${property}) is due. Paying on time keeps things smooth.`;
    } else {
      type = 'low'; iconType = 'upcoming';
      title = bn ? `আসন্ন ভাড়া — ${monthLbl}` : `Upcoming rent — ${monthLbl}`;
      subtitle = `${property} • ৳${amountStr}`;
      detail = bn
        ? `${property}-এর ${monthLbl} মাসের ভাড়া ৳${amountStr} আসছে।`
        : `৳${amountStr} rent for ${monthLbl} (${property}) is coming up.`;
    }
    alerts.push({
      id: `trent-${idTail}`, category: 'payment', type, iconType,
      title, subtitle, detail, amount: amountStr, daysLeft: null,
      actionType: 'view_receipt', actionLabel: bn ? 'দেখুন' : 'View', monthKey: r.monthKey,
    });
  }

  // ── Inquiry status ──
  for (const q of (inquiries || [])) {
    if (!q) continue;
    const property = q.propTitle || (bn ? 'একটি বাসা' : 'a property');
    const phone = q.landlordPhone || q.ownerPhone || '';
    const base = {
      category: 'inquiry', tenant: property, phone,
      inquiryId: q.id || q._id, propertyId: q.propertyId, daysLeft: null,
      actionType: 'contact_landlord', actionLabel: bn ? 'যোগাযোগ করুন' : 'Contact',
    };
    if (q.status === 'accepted') {
      alerts.push({
        ...base, id: `tinq-acc-${q.id || q._id}`, type: 'medium', iconType: 'accepted',
        title: bn ? 'ইনকোয়ারি গৃহীত! 🎉' : 'Inquiry accepted! 🎉',
        subtitle: property,
        detail: bn
          ? `"${property}"-এর জন্য আপনার ইনকোয়ারি মালিক গ্রহণ করেছেন। পরবর্তী ধাপ ঠিক করতে মালিকের সাথে যোগাযোগ করুন।`
          : `The landlord accepted your inquiry for "${property}". Contact them to arrange the next steps.`,
      });
    } else if (q.status === 'replied') {
      alerts.push({
        ...base, id: `tinq-rep-${q.id || q._id}`, type: 'medium', iconType: 'inquiry',
        title: bn ? 'মালিক রিপ্লাই দিয়েছেন' : 'Landlord replied',
        subtitle: property,
        detail: bn
          ? `"${property}" নিয়ে মালিক উত্তর দিয়েছেন। কথা চালিয়ে যেতে যোগাযোগ করুন।`
          : `The landlord replied about "${property}". Reach out to continue the conversation.`,
      });
    }
  }

  const rank = { urgent: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => (rank[a.type] - rank[b.type]) || ((a.daysLeft ?? 999) - (b.daysLeft ?? 999)));
  return { alerts, resolved };
}