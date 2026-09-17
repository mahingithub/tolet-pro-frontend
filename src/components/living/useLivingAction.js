import { useCallback } from 'react';
import useLivingStore from '../../store/useLivingStore';

// Only these intentions may reopen a form after login. None performs a write.
export const LIVING_FORM_ACTIONS = {
  solo: {
    overview: ['settings'],
    spending: ['add', 'expense', 'lend', 'repay-out'],
    income: ['add', 'income', 'borrow', 'repay-in'],
    people: ['add'],
  },
  joint: {
    overview: ['roommate', 'connect'],
    expenses: ['add'],
    meals: ['add', 'deposit', 'bazar', 'rate'],
    bills: ['add'],
    balances: ['add'],
  },
};

export function livingActionPath(wallet, module, action) {
  const params = new URLSearchParams({ wallet: wallet === 'solo' ? 'solo' : 'joint', m: module });
  if (LIVING_FORM_ACTIONS[wallet]?.[module]?.includes(action)) params.set('livingAction', action);
  return `/living?${params}`;
}

/** Where login should return someone who was reaching for a form in Living. */
export function livingReturnPath(module, action) {
  return livingActionPath(useLivingStore.getState().mode, module, action);
}

/**
 * Opening a form is no longer gated.
 * ──────────────────────────────────────────────────────────────────────────
 * This hook used to send a signed-out visitor to login the moment they tapped
 * "add" — so they never saw what the form even asked for. The gate now sits on
 * the WRITE instead (store/useLivingStore.js `_apply`, and the fetch
 * interceptor for anything server-side): fill the form in, and the "sign in to
 * save" ask arrives at save time, dismissible, with everything still on screen.
 *
 * The call sites keep calling this — `if (!requireAction('add')) return;` — so
 * the gate has one obvious place to come back to if a screen ever needs to be
 * closed off again. Today it always allows.
 */
export default function useLivingAction(module) {
  return useCallback(() => true, [module]);
}
