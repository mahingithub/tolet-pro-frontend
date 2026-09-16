import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import useLivingStore from '../../store/useLivingStore';
import { isNativeApp, nativeLoginUrl } from '../../utils/nativeExperience';

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

/** Allow browsing, but take native guests straight to the chosen-role login. */
export default function useLivingAction(module) {
  const { user } = useAuth();
  const navigate = useNavigate();
  return useCallback((action, targetModule = module) => {
    if (!isNativeApp() || user) return true;
    navigate(nativeLoginUrl({ next: livingActionPath(useLivingStore.getState().mode, targetModule, action) }));
    return false;
  }, [module, navigate, user]);
}
