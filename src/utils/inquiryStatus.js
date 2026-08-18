/*
 * inquiryStatus.js
 * ──────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for turning a raw inquiry `status` into one of the
 * four buckets the landlord actually sees: Pending · Accepted · Rented ·
 * Rejected.
 *
 * WHY THIS FILE EXISTS
 * The backend pipeline has EIGHT statuses (models/Inquiry.js):
 *   sent · delivered · viewed · accepted · rejected · visit_scheduled ·
 *   final_booking · rented
 * The UI only has FOUR tabs. Every screen that used to do its own
 * `status === '...'` check drifted apart, and rows fell through the cracks:
 * the dashboard KPI counted all 4 inquiries while the tabs could only render
 * 3, because the Pending filter tested for a legacy `'new'` label that the
 * backend never writes (its default is `'sent'`). One inquiry was counted
 * everywhere and reachable nowhere.
 *
 * THE INVARIANT THAT PREVENTS IT COMING BACK
 * `inquiryBucket()` is TOTAL: every input — including `null`, `undefined`,
 * a typo, or a status added to the backend enum tomorrow — lands in exactly
 * one bucket (unknown ⇒ `pending`, the landlord's action queue, because an
 * unrecognised inquiry still deserves a human look). Therefore:
 *
 *     pending + accepted + rented + rejected === inquiries.length
 *
 * always holds. No inquiry can ever be invisible again, and the dashboard
 * KPI can never disagree with the sum of the tabs.
 */

/** Landlord-facing buckets, in the order the tabs are displayed. */
export const INQUIRY_BUCKETS = ['pending', 'accepted', 'rented', 'rejected'];

/**
 * status → bucket. Keys cover the backend enum plus the legacy/alias labels
 * still produced by older rows and a few frontend-only screens (`new`,
 * `active`, `replied`, `converted`, `completed`).
 */
const STATUS_TO_BUCKET = {
  // ─── Pending: in the pipeline, awaiting the landlord's decision ─────────
  sent: 'pending',
  delivered: 'pending',
  viewed: 'pending',
  replied: 'pending',
  new: 'pending', // legacy label
  pending: 'pending', // legacy label
  active: 'pending', // legacy label

  // ─── Accepted: landlord said yes; conversation + visits are unlocked ────
  accepted: 'accepted',
  visit_scheduled: 'accepted',

  // ─── Rented: converted into a booking / deal closed ─────────────────────
  rented: 'rented',
  final_booking: 'rented',
  converted: 'rented', // legacy label
  completed: 'rented', // legacy label

  // ─── Rejected: terminal no ──────────────────────────────────────────────
  rejected: 'rejected',
};

/**
 * The bucket an inquiry belongs to. Never returns null — an unrecognised or
 * missing status falls back to `pending` so the row stays visible and
 * actionable rather than silently vanishing from the UI.
 */
export const inquiryBucket = (statusOrInquiry) => {
  const raw =
    statusOrInquiry && typeof statusOrInquiry === 'object'
      ? statusOrInquiry.status
      : statusOrInquiry;
  const key = String(raw || '').trim().toLowerCase();
  return STATUS_TO_BUCKET[key] || 'pending';
};

/** True when the inquiry belongs to `bucket`. */
export const isInBucket = (inquiry, bucket) => inquiryBucket(inquiry) === bucket;

/**
 * Count every bucket in one pass, plus the grand total.
 * `total` is exactly `inquiries.length`, and the four buckets always sum to
 * it — that is the guarantee the tab chips and the dashboard KPI both rely
 * on to stay in agreement.
 */
export const countInquiryBuckets = (inquiries) => {
  const counts = { pending: 0, accepted: 0, rented: 0, rejected: 0, total: 0 };
  (Array.isArray(inquiries) ? inquiries : []).forEach((inq) => {
    counts[inquiryBucket(inq)] += 1;
    counts.total += 1;
  });
  return counts;
};

/** Bilingual bucket label, so the tabs, the count pill and the summary agree. */
export const inquiryBucketLabel = (bucket, language) => {
  const bn = language === 'বাংলা';
  switch (bucket) {
    case 'pending':
      return bn ? 'পেন্ডিং' : 'Pending';
    case 'accepted':
      return bn ? 'একসেপ্টেড' : 'Accepted';
    case 'rented':
      return bn ? 'ভাড়া হয়েছে' : 'Rented';
    case 'rejected':
      return bn ? 'রিজেক্টেড' : 'Rejected';
    default:
      return bucket;
  }
};

/**
 * Fine-grained stage label for a single row — the honest answer to "why is
 * this inquiry sitting in this tab?".
 *
 * The bucket alone can't say it: `accepted` and `visit_scheduled` share the
 * Accepted tab, `rented` and `final_booking` share Rented. The list used to
 * hard-label every Pending row "New" regardless of whether the landlord had
 * already opened it, which made the badge meaningless. Returns `null` when the
 * bucket already says everything (a plain `accepted` / `rejected` row).
 */
export const inquiryStageLabel = (statusOrInquiry, language) => {
  const bn = language === 'বাংলা';
  const raw =
    statusOrInquiry && typeof statusOrInquiry === 'object'
      ? statusOrInquiry.status
      : statusOrInquiry;
  switch (String(raw || '').trim().toLowerCase()) {
    case 'sent':
    case 'delivered':
    case 'new':
    case '':
      return { text: bn ? 'নতুন' : 'New', tone: 'bg-blue-50 text-blue-600' };
    case 'viewed':
    case 'replied':
      return { text: bn ? 'দেখা হয়েছে' : 'Opened', tone: 'bg-gray-100 text-gray-500' };
    case 'visit_scheduled':
      return { text: bn ? 'ভিজিট ঠিক' : 'Visit set', tone: 'bg-blue-50 text-blue-600' };
    case 'final_booking':
    case 'converted':
    case 'completed':
      return { text: bn ? 'বুক হয়েছে' : 'Booked', tone: 'bg-indigo-50 text-indigo-600' };
    default:
      return null; // plain accepted / rejected / rented — the tab already says it
  }
};

/**
 * One-line plain-language explanation of what each bucket holds. Shown under
 * the inquiry list so a landlord never has to guess why a row sits where it
 * does — the fix for "3 here but 4 on the dashboard" is partly a labelling
 * problem, not just a filtering one.
 */
export const inquiryBucketHint = (bucket, language) => {
  const bn = language === 'বাংলা';
  switch (bucket) {
    case 'pending':
      return bn
        ? 'নতুন অনুরোধ — আপনার সিদ্ধান্তের অপেক্ষায়। একসেপ্ট করলে মেসেজ, কল ও ভিজিট চালু হবে।'
        : 'New requests waiting on your decision. Accepting unlocks messaging, calls and visits.';
    case 'accepted':
      return bn
        ? 'আপনি একসেপ্ট করেছেন — কথা বলুন, ভিজিট ঠিক করুন, তারপর বুকিং এ রূপান্তর করুন।'
        : "You've accepted these. Chat, arrange a visit, then convert to a booking.";
    case 'rented':
      return bn
        ? 'বুকিং এ রূপান্তরিত — ভাড়া হয়ে গেছে। প্রয়োজনে একসেপ্টেড এ ফেরত পাঠাতে পারেন।'
        : 'Converted into a booking. You can send one back to Accepted if plans change.';
    case 'rejected':
      return bn
        ? 'আপনি রিজেক্ট করেছেন — রেকর্ডের জন্য রাখা আছে।'
        : "Requests you've declined, kept here for your records.";
    default:
      return '';
  }
};
