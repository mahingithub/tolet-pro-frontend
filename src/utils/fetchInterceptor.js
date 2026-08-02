const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (err) => {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((cb) => cb(err));
};

// Kick off exactly one /auth/refresh round-trip; concurrent 401s piggyback on
// it via the subscriber list. Callers MUST subscribe BEFORE awaiting this —
// otherwise the refresh can finish (and flush the empty subscriber list)
// before they ever register, leaving their request pending forever.
function startRefresh(originalFetch) {
  isRefreshing = true;
  originalFetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
      const data = await res.json().catch(() => ({}));
      if (!data.token) throw new Error('No token returned');
      window.localStorage.setItem('auth:token', data.token);
      return null;
    })
    .catch((err) => err)
    .then((err) => {
      isRefreshing = false;
      // On failure we do NOT wipe local storage. A refresh can fail for
      // reasons that have nothing to do with the session being dead — the
      // refresh cookie not being sent (cross-site / SameSite), a 429 from the
      // refresh rate limiter, a backend restart, being offline. Wiping here
      // was silently logging people out mid-session (most visibly on /living,
      // the only screen that polls every 25s, so it was the only screen that
      // reliably hit an expired access token while idle). The original 401 is
      // handed back to the caller, and AuthContext's /me check remains the one
      // place that decides a session is genuinely over.
      onRefreshed(err || null);
    });
}

export function setupFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';

    // Check if this is a request to our API
    const isApiRequest = url.startsWith(API_BASE) || (url.startsWith('/') && !url.includes('.'));

    if (isApiRequest) {
      init = init || {};
      // Ensure cross-origin or same-origin requests send cookies
      if (!init.credentials) {
        init.credentials = 'include';
      }
    }

    const response = await originalFetch(input, init);

    // Infinite loop prevention: Ignore 401s from login or refresh endpoints
    if (
      response.status !== 401 ||
      !isApiRequest ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')
    ) {
      return response;
    }

    return new Promise((resolve, reject) => {
      subscribeTokenRefresh(async (err) => {
        if (err) {
          // Return original 401 so callers can handle it gracefully (e.g. show login)
          resolve(response);
          return;
        }
        // Retry the original request with the freshly minted access token.
        const newToken = window.localStorage.getItem('auth:token');
        if (newToken) {
          const newHeaders = new Headers(init?.headers || {});
          newHeaders.delete('Authorization');
          newHeaders.delete('authorization');
          newHeaders.set('Authorization', `Bearer ${newToken}`);
          init = { ...(init || {}), headers: newHeaders };
        }
        try {
          resolve(await originalFetch(input, init));
        } catch (retryErr) {
          reject(retryErr);
        }
      });

      if (!isRefreshing) startRefresh(originalFetch);
    });
  };
}
