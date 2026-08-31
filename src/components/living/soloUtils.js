/**
 * soloUtils — every derived number for the SOLO wallet (living alone): cash in
 * hand, what went out and what came in, the category breakdown, and the
 * per-person দেনা-পাওনা ledger.
 *
 * Pure and framework-free like livingUtils.js — no React, no store, no DOM.
 *
 * The one rule the whole module is built around: **a ধার is not a খরচ.** Money
 * lent to a friend leaves the pocket but was never spent, so it moves `cash`
 * and that friend's balance, and stays out of every spending total. That single
 * distinction is what makes the app's monthly figure match reality when the
 * paper খাতা's doesn't.
 */
import { monthKey, monthStart, taka } from './livingUtils';
import { ENTRY_TYPES, getEntryType } from './soloConfig';

const amountOf = (e) => Math.max(0, Number(e?.amount) || 0);

/**
 * Money that is allowed to go negative (cash in hand, what was left over).
 * `taka(-350)` renders "৳-৩৫০" — the minus stranded after the sign — so the
 * sign is pulled out in front: "−৳৩৫০".
 */
export const takaBalance = (n, lang) => {
  const v = Number(n) || 0;
  return v < 0 ? `−${taka(Math.abs(v), lang)}` : taka(v, lang);
};

/** What this entry did to the cash in my pocket (+ in, − out). */
export const cashDelta = (e) => (getEntryType(e?.type).flow === 'in' ? amountOf(e) : -amountOf(e));

/** What it did to that friend's balance (+ they owe me more, − I owe more). */
export const personDelta = (e) => getEntryType(e?.type).person * amountOf(e);

/** Real spending only — a lend / repayment is a transfer, never a খরচ. */
export const isSpending = (e) => e?.type === 'expense';
export const isEarning = (e) => e?.type === 'income';

export const entriesOfFlow = (entries = [], flow) =>
  entries.filter((e) => getEntryType(e.type).flow === flow);

export const inMonth = (date, offset = 0) => monthKey(date) === monthKey(monthStart(offset));

export const monthEntries = (entries = [], offset = 0) => entries.filter((e) => inMonth(e.date, offset));

/** Newest first; ties broken by when the row was written, so same-day edits keep their order. */
export const byNewest = (a, b) =>
  new Date(b.date) - new Date(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/**
 * Cash in hand right now: what was already in the pocket when the খাতা started,
 * plus every entry ever logged. All-time on purpose — money doesn't reset on
 * the 1st of the month.
 */
export function soloCash(solo = {}) {
  const { opening = 0, entries = [] } = solo;
  return entries.reduce((sum, e) => sum + cashDelta(e), Number(opening) || 0);
}

/** Total for a set of entries, filtered by type. */
const totalOf = (entries, type) =>
  entries.filter((e) => e.type === type).reduce((s, e) => s + amountOf(e), 0);

/**
 * Everything the Overview and Report need for one month:
 *   spent / earned          — real consumption and real income
 *   lent / borrowed / …     — transfers, kept separate so they never inflate খরচ
 *   byCategory              — where the spending went, biggest first
 *   bySource                — where the income came from, biggest first
 *   cash, budget            — cash in hand (all-time) + this month's cap usage
 */
export function soloSummary(solo = {}, offset = 0) {
  const { entries = [], budget = 0 } = solo;
  const rows = monthEntries(entries, offset);

  const spent = totalOf(rows, 'expense');
  const earned = totalOf(rows, 'income');
  const lent = totalOf(rows, 'lend');
  const borrowed = totalOf(rows, 'borrow');
  const gotBack = totalOf(rows, 'repay-in');
  const paidBack = totalOf(rows, 'repay-out');

  const group = (list, pick) => {
    const acc = {};
    list.forEach((e) => {
      const key = pick(e) || 'other';
      acc[key] = (acc[key] || 0) + amountOf(e);
    });
    const total = Object.values(acc).reduce((s, v) => s + v, 0);
    return Object.entries(acc)
      .map(([key, amount]) => ({ key, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  };

  const cap = Math.max(0, Number(budget) || 0);
  return {
    ref: monthStart(offset),
    offset,
    entries: rows,
    spent,
    earned,
    lent,
    borrowed,
    gotBack,
    paidBack,
    // What actually left / entered the pocket this month, transfers included.
    cashOut: spent + lent + paidBack,
    cashIn: earned + borrowed + gotBack,
    saved: earned - spent,
    cash: soloCash(solo),
    byCategory: group(rows.filter(isSpending), (e) => e.category),
    bySource: group(rows.filter(isEarning), (e) => e.category),
    budget: cap,
    budgetUsed: cap > 0 ? Math.min(999, (spent / cap) * 100) : 0,
    budgetLeft: cap > 0 ? cap - spent : 0,
  };
}

/**
 * The দেনা-পাওনা ledger: one row per friend, `net` positive = they owe me,
 * negative = I owe them. Sorted by how much is outstanding so the people I
 * need to chase (or pay) sit at the top.
 */
export function personRows(solo = {}) {
  const { people = [], entries = [] } = solo;
  const acc = {};
  people.forEach((p) => (acc[p.id] = { ...p, net: 0, count: 0, lastDate: null }));

  entries.forEach((e) => {
    const row = acc[e.personId];
    if (!row) return; // entry with no person (a plain খরচ) or a deleted friend
    row.net += personDelta(e);
    row.count += 1;
    if (!row.lastDate || new Date(e.date) > new Date(row.lastDate)) row.lastDate = e.date;
  });

  const rows = Object.values(acc).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const theyOweMe = rows.reduce((s, r) => s + (r.net > 0 ? r.net : 0), 0);
  const iOwe = rows.reduce((s, r) => s + (r.net < 0 ? -r.net : 0), 0);
  return { rows, theyOweMe, iOwe, net: theyOweMe - iOwe };
}

/** One friend's balance + their entries, newest first (for the detail sheet). */
export function personDetail(solo = {}, personId) {
  const entries = (solo.entries || []).filter((e) => e.personId === personId).sort(byNewest);
  const net = entries.reduce((s, e) => s + personDelta(e), 0);
  return { entries, net };
}

/** Spent vs. earned for the last `months` calendar months (oldest → newest). */
export function soloTrend(solo = {}, months = 6) {
  const out = [];
  for (let o = -(months - 1); o <= 0; o++) {
    const rows = monthEntries(solo.entries || [], o);
    out.push({ ref: monthStart(o), spent: totalOf(rows, 'expense'), earned: totalOf(rows, 'income') });
  }
  return out;
}

/**
 * Group entries into days (newest first) with each day's own in/out totals —
 * this is what turns a flat list into something that reads like a real খাতা.
 */
export function groupByDay(entries = []) {
  const days = new Map();
  [...entries].sort(byNewest).forEach((e) => {
    const key = toDateInput(e.date); // local day, so "আজ" means today HERE
    if (!days.has(key)) days.set(key, { key, date: e.date, entries: [], out: 0, in: 0 });
    const day = days.get(key);
    day.entries.push(e);
    if (ENTRY_TYPES[e.type]?.flow === 'in') day.in += amountOf(e);
    else day.out += amountOf(e);
  });
  return [...days.values()];
}

/** `YYYY-MM-DD` for a date input, in LOCAL time (never the UTC shift). */
export const toDateInput = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Back to an ISO timestamp, pinned to midday so timezones can't shift the day. */
export const fromDateInput = (value) =>
  value ? new Date(`${value}T12:00:00`).toISOString() : new Date().toISOString();
