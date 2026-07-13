/**
 * livingUtils — pure, framework-free helpers for the Living / Roommate Wallet
 * tab: money/number/date formatting plus every derived calculation (expense
 * splitting, the shared ledger, debt simplification, meal cost distribution,
 * the monthly report and the wallet summary).
 *
 * Nothing here touches React, the store, or the DOM, so it stays trivially
 * testable and can be reused verbatim if a real backend is added later.
 */

// ── formatting ─────────────────────────────────────────────────────────────
const localeFor = (lang) => (lang === 'বাংলা' ? 'bn-BD' : 'en-BD');

export const num = (n, lang) => (Number(n) || 0).toLocaleString(localeFor(lang));

export const taka = (n, lang) => `৳${num(Math.round(Number(n) || 0), lang)}`;

export const takaSigned = (n, lang) => {
  const v = Math.round(Number(n) || 0);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}৳${num(Math.abs(v), lang)}`;
};

export const monthKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}`;
};

export const isSameMonth = (d, ref = new Date()) => monthKey(d) === monthKey(ref);

export const monthStart = (offset = 0) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, 1);
};

export const monthLabel = (ref, lang) =>
  new Date(ref).toLocaleDateString(lang === 'বাংলা' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });

export const dateLabel = (d, lang) =>
  new Date(d).toLocaleDateString(lang === 'বাংলা' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' });

export const timeAgo = (d, lang) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const isBn = lang === 'বাংলা';
  if (mins < 1) return isBn ? 'এইমাত্র' : 'just now';
  if (mins < 60) return isBn ? `${num(mins, lang)} মিনিট আগে` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isBn ? `${num(hrs, lang)} ঘণ্টা আগে` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isBn ? `${num(days, lang)} দিন আগে` : `${days}d ago`;
  return dateLabel(d, lang);
};

// ── expense splitting ────────────────────────────────────────────────────────
/**
 * Resolve how much each participant owes for a single expense.
 * Returns a map { roommateId: amount }. Supports equal / percentage / custom.
 */
export function expenseShares(expense, roommates) {
  const parts =
    expense.splitWith && expense.splitWith.length ? expense.splitWith : roommates.map((r) => r.id);
  const amount = Number(expense.amount) || 0;
  const out = {};
  if (!parts.length) return out;

  if (expense.splitType === 'percentage') {
    const shares = expense.shares || {};
    const totalPct = parts.reduce((s, id) => s + (Number(shares[id]) || 0), 0) || 100;
    parts.forEach((id) => {
      out[id] = (amount * (Number(shares[id]) || 0)) / totalPct;
    });
  } else if (expense.splitType === 'custom') {
    const shares = expense.shares || {};
    parts.forEach((id) => {
      out[id] = Number(shares[id]) || 0;
    });
  } else {
    const each = amount / parts.length;
    parts.forEach((id) => {
      out[id] = each;
    });
  }
  return out;
}

// Total meals (b+l+d) per roommate, optionally scoped to a month reference.
export function mealCountByRoommate(meals, roommates, monthRef = null) {
  const counts = {};
  roommates.forEach((r) => (counts[r.id] = 0));
  meals.forEach((m) => {
    if (monthRef && monthKey(m.date) !== monthKey(monthRef)) return;
    if (!(m.roommateId in counts)) counts[m.roommateId] = 0;
    counts[m.roommateId] += (Number(m.breakfast) || 0) + (Number(m.lunch) || 0) + (Number(m.dinner) || 0);
  });
  return counts;
}

// ── shared ledger + debt simplification ──────────────────────────────────────
/**
 * Net position per roommate across expenses, the meal grocery pot and
 * settlements. Positive = the group owes this person; negative = they owe.
 * Grocery is distributed by each roommate's share of meals in the grocery's
 * own month (equal split fallback when no meals are logged).
 */
export function computeLedger({ expenses = [], groceries = [], meals = [], bills = [], settlements = [], roommates = [] }) {
  const net = {};
  roommates.forEach((r) => (net[r.id] = 0));
  const ensure = (id) => {
    if (!(id in net)) net[id] = 0;
  };

  expenses.forEach((e) => {
    const amount = Number(e.amount) || 0;
    ensure(e.paidBy);
    net[e.paidBy] += amount;
    const shares = expenseShares(e, roommates);
    Object.entries(shares).forEach(([id, amt]) => {
      ensure(id);
      net[id] -= amt;
    });
  });

  // Paid bills feed the ledger like an equal-split expense: the payer (paidBy)
  // is credited what they ACTUALLY paid (full or partial), while every member is
  // debited an equal share of the full bill. For a partial payment the shortfall
  // stays unmatched (still owed to the utility) → no phantom roommate debt.
  // Unpaid bills don't move balances (nobody paid yet).
  bills.forEach((b) => {
    const paid = billPaid(b);
    if (paid <= 0) return;
    const payer = b.paidBy || b.createdBy;
    if (!payer) return; // can't attribute → leave balances untouched
    ensure(payer);
    net[payer] += paid;
    const each = (Number(b.amount) || 0) / (roommates.length || 1);
    roommates.forEach((r) => {
      net[r.id] -= each;
    });
  });

  groceries.forEach((g) => {
    const amount = Number(g.amount) || 0;
    ensure(g.paidBy);
    net[g.paidBy] += amount;
    const counts = mealCountByRoommate(meals, roommates, new Date(g.date));
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    if (total > 0) {
      roommates.forEach((r) => {
        net[r.id] -= amount * ((counts[r.id] || 0) / total);
      });
    } else {
      const each = amount / (roommates.length || 1);
      roommates.forEach((r) => (net[r.id] -= each));
    }
  });

  settlements.forEach((st) => {
    ensure(st.from);
    ensure(st.to);
    net[st.from] += Number(st.amount) || 0;
    net[st.to] -= Number(st.amount) || 0;
  });

  return net;
}

/** Greedy minimal-transaction simplification → [{ from, to, amount }]. */
export function simplifyDebts(net, roommates) {
  const creditors = [];
  const debtors = [];
  roommates.forEach((r) => {
    const v = net[r.id] || 0;
    if (v > 0.5) creditors.push({ id: r.id, amt: v });
    else if (v < -0.5) debtors.push({ id: r.id, amt: -v });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const out = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0.5) out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay) });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt <= 0.5) i++;
    if (creditors[j].amt <= 0.5) j++;
  }
  return out;
}

/**
 * Transparent "who paid what" breakdown. For every roommate returns the total
 * they personally paid out, plus a per-category split (expense categories, the
 * meal bazar pot → 'groceries', and PAID bills → their bill type). This is the
 * "why" behind the balances: exactly who paid, for what, and how much.
 * Rows are sorted by total paid (desc); categories within a row likewise.
 */
export function paymentBreakdown(state) {
  const { expenses = [], groceries = [], bills = [], roommates = [] } = state;
  const byMember = {};
  const bump = (memberId, categoryKey, amount) => {
    if (!memberId || !(amount > 0)) return;
    if (!byMember[memberId]) byMember[memberId] = { total: 0, cats: {} };
    byMember[memberId].total += amount;
    byMember[memberId].cats[categoryKey] = (byMember[memberId].cats[categoryKey] || 0) + amount;
  };

  expenses.forEach((e) => bump(e.paidBy, e.category || 'other', Number(e.amount) || 0));
  groceries.forEach((g) => bump(g.paidBy, 'groceries', Number(g.amount) || 0));
  bills.forEach((b) => {
    const paid = billPaid(b);
    if (paid <= 0) return;
    bump(b.paidBy || b.createdBy, b.type || 'other', paid);
  });

  const grandTotal = Object.values(byMember).reduce((s, m) => s + m.total, 0);
  const rows = roommates
    .map((r) => {
      const m = byMember[r.id] || { total: 0, cats: {} };
      const cats = Object.entries(m.cats)
        .map(([key, amount]) => ({ key, amount }))
        .sort((a, b) => b.amount - a.amount);
      return { id: r.id, name: r.name, color: r.color, avatar: r.avatar, isMe: r.isMe, total: m.total, cats };
    })
    .sort((a, b) => b.total - a.total);

  return { rows, grandTotal };
}

// ── meals ────────────────────────────────────────────────────────────────────
/**
 * Per-roommate meal summary for a month: count, breakdown, and the grocery
 * cost attributed to that roommate (grocery pot distributed by meal count).
 */
export function mealSummary(state, monthOffset = 0) {
  const ref = monthStart(monthOffset);
  const { meals = [], groceries = [], roommates = [] } = state;
  const perRoommate = roommates.map((r) => ({ id: r.id, name: r.name, color: r.color, isMe: r.isMe, breakfast: 0, lunch: 0, dinner: 0, count: 0, cost: 0 }));
  const byId = Object.fromEntries(perRoommate.map((p) => [p.id, p]));

  meals.forEach((m) => {
    if (monthKey(m.date) !== monthKey(ref)) return;
    const p = byId[m.roommateId];
    if (!p) return;
    p.breakfast += Number(m.breakfast) || 0;
    p.lunch += Number(m.lunch) || 0;
    p.dinner += Number(m.dinner) || 0;
  });
  perRoommate.forEach((p) => (p.count = p.breakfast + p.lunch + p.dinner));

  const totalGrocery = groceries.filter((g) => monthKey(g.date) === monthKey(ref)).reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const totalMeals = perRoommate.reduce((s, p) => s + p.count, 0);
  const rate = totalMeals > 0 ? totalGrocery / totalMeals : 0;
  perRoommate.forEach((p) => (p.cost = p.count * rate));

  return { perRoommate, totalGrocery, totalMeals, rate, ref };
}

// ── monthly report ────────────────────────────────────────────────────────────
export function monthlyReport(state, monthOffset = 0) {
  const ref = monthStart(monthOffset);
  const inMonth = (d) => monthKey(d) === monthKey(ref);
  const { expenses = [], groceries = [], bills = [] } = state;

  const rent = Number(state.rent) || 0;
  const billsTotal = bills.filter((b) => inMonth(b.dueDate)).reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const grocery = expenses.filter((e) => e.category === 'groceries' && inMonth(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const mealsCost = groceries.filter((g) => inMonth(g.date)).reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const other = expenses.filter((e) => e.category !== 'groceries' && inMonth(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const total = rent + billsTotal + grocery + mealsCost + other;
  const income = Number(state.monthlyIncome) || 0;
  const savings = income - total;

  const buckets = [
    { key: 'rent', amount: rent },
    { key: 'bills', amount: billsTotal },
    { key: 'grocery', amount: grocery },
    { key: 'meals', amount: mealsCost },
    { key: 'other', amount: other },
  ];

  return { ref, rent, bills: billsTotal, grocery, meals: mealsCost, other, total, income, savings, buckets };
}

// Personal share of this month's living cost for one roommate (default me).
export function myMonthlyShare(state, meId = 'me', monthOffset = 0) {
  const ref = monthStart(monthOffset);
  const inMonth = (d) => monthKey(d) === monthKey(ref);
  const { expenses = [], groceries = [], bills = [], meals = [], roommates = [] } = state;
  const n = roommates.length || 1;

  const rentShare = (Number(state.rent) || 0) / n;
  const billsShare = bills.filter((b) => inMonth(b.dueDate)).reduce((s, b) => s + (Number(b.amount) || 0), 0) / n;

  let expenseShare = 0;
  expenses.filter((e) => inMonth(e.date)).forEach((e) => {
    const shares = expenseShares(e, roommates);
    expenseShare += shares[meId] || 0;
  });

  let mealShare = 0;
  groceries.filter((g) => inMonth(g.date)).forEach((g) => {
    const counts = mealCountByRoommate(meals, roommates, new Date(g.date));
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const amount = Number(g.amount) || 0;
    mealShare += total > 0 ? amount * ((counts[meId] || 0) / total) : amount / n;
  });

  return rentShare + billsShare + expenseShare + mealShare;
}

// ── wallet summary ────────────────────────────────────────────────────────────
export function walletSummary(state, meId = 'me') {
  const { expenses, groceries, meals, bills, settlements, roommates } = state;
  const net = computeLedger({ expenses, groceries, meals, bills, settlements, roommates });
  const debts = simplifyDebts(net, roommates);
  const youOwe = debts.filter((d) => d.from === meId).reduce((s, d) => s + d.amount, 0);
  const othersOweYou = debts.filter((d) => d.to === meId).reduce((s, d) => s + d.amount, 0);
  const totalBalance = othersOweYou - youOwe;
  const report = monthlyReport(state, 0);
  const thisMonthSpending = myMonthlyShare(state, meId, 0);
  return {
    totalBalance,
    youOwe,
    othersOweYou,
    thisMonthSpending,
    totalLivingCost: report.total,
    net,
    debts,
  };
}

// ── bills ──────────────────────────────────────────────────────────────────────
/**
 * How much has actually been paid toward a bill (clamped to its total).
 * Supports partial payment via `paidAmount`; legacy fully-paid bills that
 * predate the field fall back to their full amount.
 */
export function billPaid(bill) {
  const total = Number(bill?.amount) || 0;
  if (bill?.paidAmount != null && bill.paidAmount !== '') {
    return Math.max(0, Math.min(total, Number(bill.paidAmount) || 0));
  }
  return bill?.status === 'paid' ? total : 0;
}

/** Effective status: 'paid' | 'partial' | 'overdue' | 'due-soon' | 'unpaid'. */
export function deriveBillStatus(bill) {
  if (bill.status === 'paid') return 'paid';
  const total = Number(bill.amount) || 0;
  const paid = billPaid(bill);
  if (paid >= total && total > 0) return 'paid';
  if (bill.status === 'partial' || (paid > 0 && paid < total)) return 'partial';
  const diffDays = (new Date(bill.dueDate).getTime() - Date.now()) / 86400000;
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 5) return 'due-soon';
  return 'unpaid';
}

export function daysUntil(dateISO) {
  return Math.ceil((new Date(dateISO).getTime() - Date.now()) / 86400000);
}

export const roommateById = (roommates, id) => roommates.find((r) => r.id === id) || { id, name: '—', color: '#94a3b8' };

// Deterministic initials for avatars.
export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

// ── smart reminders ─────────────────────────────────────────────────────────────
/**
 * Derive actionable reminders from raw state (bills due/overdue, pending
 * payments, and grocery/meal budgets near or over cap). Returns structured
 * data only — the component maps `kind`/`severity` to icons, colours and
 * localised copy so this stays pure.
 */
export function buildReminders(state, meId = 'me') {
  const out = [];
  const { bills = [], budgets = {} } = state;

  bills.forEach((b) => {
    const st = deriveBillStatus(b);
    // Respect the per-bill reminder toggle (payment reminder support).
    if ((st === 'due-soon' || st === 'overdue') && b.reminder !== false) {
      out.push({
        id: `bill-${b.id}`,
        kind: 'bill',
        refId: b.id,
        billType: b.type,
        statusKey: st,
        severity: st === 'overdue' ? 'high' : 'medium',
        amount: Number(b.amount) || 0,
        dueDate: b.dueDate,
        daysLeft: daysUntil(b.dueDate),
        actionModule: 'bills',
      });
    }
  });

  const ws = walletSummary(state, meId);
  if (ws.youOwe > 0) {
    out.push({ id: 'pending-pay', kind: 'payment', severity: 'high', amount: ws.youOwe, actionModule: 'balances' });
  }
  if (ws.othersOweYou > 0) {
    out.push({ id: 'collect', kind: 'collect', severity: 'low', amount: ws.othersOweYou, actionModule: 'balances' });
  }

  const report = monthlyReport(state, 0);
  const groceryBudget = Number(budgets.grocery) || 0;
  if (groceryBudget > 0 && report.grocery >= groceryBudget * 0.8) {
    out.push({
      id: 'grocery-budget',
      kind: 'grocery-budget',
      severity: report.grocery > groceryBudget ? 'high' : 'medium',
      amount: report.grocery,
      budget: groceryBudget,
      actionModule: 'report',
    });
  }
  const mealBudget = Number(budgets.meal) || 0;
  if (mealBudget > 0 && report.meals >= mealBudget * 0.8) {
    out.push({
      id: 'meal-budget',
      kind: 'meal-budget',
      severity: report.meals > mealBudget ? 'high' : 'medium',
      amount: report.meals,
      budget: mealBudget,
      actionModule: 'report',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── mess / meal manager (Bangladeshi mess accounting) ──────────────────────────
// Period range: 'week' = rolling last 7 days, 'month' = current calendar month.
export function periodRange(period = 'month') {
  const now = new Date();
  if (period === 'week') {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

const inRange = (d, range) => {
  const t = new Date(d).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
};

/**
 * The heart of the mess/meal manager. For a period, computes:
 *   • totals — deposit (জমা), meals, meal cost (bazar), meal rate, mess balance
 *   • per member — meals, deposit, meal cost (meals × rate), balance (deposit − cost)
 * Meal rate = total bazar cost ÷ total meals. A member's balance is what the
 * mess owes them (+) or what they still need to deposit (−).
 */
export function messSummary(state, period = 'month') {
  const range = periodRange(period);
  const { meals = [], groceries = [], deposits = [], roommates = [] } = state;

  const perMember = roommates.map((r) => ({
    id: r.id, name: r.name, color: r.color, isMe: r.isMe,
    meals: 0, deposit: 0, mealCost: 0, balance: 0,
  }));
  const byId = Object.fromEntries(perMember.map((p) => [p.id, p]));

  meals.forEach((m) => {
    if (!inRange(m.date, range)) return;
    const p = byId[m.roommateId];
    if (!p) return;
    p.meals += (Number(m.breakfast) || 0) + (Number(m.lunch) || 0) + (Number(m.dinner) || 0);
  });
  deposits.forEach((d) => {
    if (!inRange(d.date, range)) return;
    const p = byId[d.roommateId];
    if (!p) return;
    p.deposit += Number(d.amount) || 0;
  });

  const totalMealCost = groceries.filter((g) => inRange(g.date, range)).reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const totalMeals = perMember.reduce((s, p) => s + p.meals, 0);
  const totalDeposit = perMember.reduce((s, p) => s + p.deposit, 0);

  // Rate is either auto (bazar ÷ meals) or a fixed value the manager set.
  const autoRate = totalMeals > 0 ? totalMealCost / totalMeals : 0;
  const manualRate = Number(state.mealRate) || 0;
  const rateMode = manualRate > 0 ? 'manual' : 'auto';
  const mealRate = manualRate > 0 ? manualRate : autoRate;

  perMember.forEach((p) => {
    p.mealCost = p.meals * mealRate;
    p.balance = p.deposit - p.mealCost;
  });

  return {
    period,
    range,
    totalDeposit,
    totalMeals,
    totalMealCost,
    mealRate,
    autoRate,
    rateMode,
    messBalance: totalDeposit - totalMealCost,
    perMember,
  };
}
