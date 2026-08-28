/*
 * rentLedger.js
 * ──────────────────────────────────────────────────────────────────────────
 * How money already received is combined with money received now.
 *
 * THE BUG THIS FIXES
 * A month's ledger entry was REPLACED by every new payment. Rent ৳6,000, ৳5,000
 * collected as a partial, then the remaining ৳1,000 arrives — recording it
 * overwrote the entry with `amount: 1000, balance: 5000`. The ৳5,000 the
 * landlord had already banked simply vanished from the record, and the month
 * still showed ৳5,000 outstanding. Marking it "Full" was worse: it claimed the
 * month was settled while recording only ৳1,000 of the ৳6,000.
 *
 * A month's entry holds the TOTAL received for that month, so a second payment
 * adds to the first. `status` is then a fact derived from the money — it is not
 * a label the landlord picks and the numbers have to live with.
 *
 * CORRECTING A MISTAKE IS A DIFFERENT ACTION
 * Adding and correcting cannot both be "type a number and save", or one of them
 * silently does the other. Adding accumulates; to fix a typo the landlord
 * removes the payment (undo) and enters it again.
 */

/** What has already been banked for this month. 'due' entries have no money. */
export const paidSoFar = (entry) => (
  entry && (entry.paid || entry.status === 'partial') ? Math.max(0, Number(entry.amount) || 0) : 0
);

/** What is still outstanding for the month, given what has been received. */
export const remainingFor = (entry, expected) => Math.max(
  0,
  (Math.max(0, Number(expected) || 0)) - paidSoFar(entry),
);

/**
 * Fold a newly received amount into the month's entry.
 *
 * @param {object|undefined} existing  the month's current ledger entry
 * @param {object} payment
 * @param {number} payment.amount    what was received THIS time (the increment)
 * @param {number} payment.expected  the month's full obligation (rent + service)
 * @param {object} [payment.meta]    paidOn / method / txnId, carried through
 * @returns {object} the replacement entry, holding the month TOTAL
 */
export const applyPaymentToEntry = (existing, { amount, expected, meta = {} }) => {
  const already   = paidSoFar(existing);
  const increment = Math.max(0, Number(amount) || 0);
  const total     = already + increment;
  const due       = Math.max(0, Number(expected) || 0);
  const balance   = Math.max(0, due - total);

  return {
    ...meta,
    paid: true,
    // Derived, never chosen: if the money covers the month it is full, and if
    // it doesn't, calling it "full" would only make the ledger lie.
    status: balance <= 0 ? 'full' : 'partial',
    amount: total,
    balance,
  };
};
