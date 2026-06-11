import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_INTENT, normaliseIntent } from '../constants/listingIntents';

const usePropertyStore = create(
  persist(
    (set) => ({
      // Which listing intent the mode-switcher tabs are currently on. Canonical
      // values ('rent' / 'sale' / 'commercial') live in constants/listingIntents
      // — kept in lockstep with the backend Property model.
      activeMode: DEFAULT_INTENT,

      // Always normalise on the way in: a typo'd call or a legacy spelling
      // ('sell' / 'buy' / 'purchase') can never poison state or localStorage.
      setActiveMode: (mode) => set({ activeMode: normaliseIntent(mode) }),
    }),
    {
      name: 'property-store', // localStorage key

      // Persist ONLY the data, never the action functions.
      partialize: (state) => ({ activeMode: state.activeMode }),

      // Sanitise whatever comes back from localStorage. An old build (or manual
      // tampering) could have stored an invalid/legacy mode; normaliseIntent
      // maps legacy → 'sale' and anything unknown → DEFAULT_INTENT, so the UI
      // never boots into a tab that doesn't exist.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        activeMode: normaliseIntent((persisted || {}).activeMode),
      }),
    }
  )
);

export default usePropertyStore;