/**
 * fetchInterceptor.js
 * ──────────────────────────────────────────────────────────────────────────
 * Monkey-patches window.fetch once (from main.jsx) so every API call:
 *   - sends cookies, so the httpOnly refresh cookie reaches /auth/refresh
 *   - on a 401, transparently refreshes the access token and replays itself
 *
 * Access tokens live 15 minutes, so hitting a 401 is the NORMAL state of a
 * session that has been open a while — not a sign the session is over. Only the
 * server can say a session is finished, and this module records what it said so
 * AuthContext can tell the two apart (see isSessionTerminated).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const TOKEN_KEY = 'auth:token';

let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Outcome of the most recent /auth/refresh attempt.
 *   null                     → succeeded, or none has run yet
 *   { terminal: true,  ... } → the server said this session is over
 *   { terminal: false, ... } → something transient went wrong; the session is
 *                              probably still fine
 */
let lastRefreshOutcome = null;

/**
 * Codes that mean the stored session is genuinely finished.
 *
 * Everything NOT listed here — a 429 from the refresh rate limiter, a 5xx, a
 * backend restart, being offline — is transient and must never end a session.
 * Conflating the two is what logged people out mid-use.
 */
const TERMINAL_REFRESH_CODES = new Set([
  'missing_refresh_token', // the browser holds no refresh cookie at all
  'invalid_refresh_token', // expired, revoked, or unknown to the server
  'token_reuse_detected',  // security event: the server revoked everything
  'user_not_found',
  'account_banned',
]);

/**
 * True only when the server has positively told us the session is over.
 * AuthContext uses this to decide whether a 401 justifies a logout.
 */
export function isSessionTerminated() {
  return lastRefreshOutcome?.terminal === true;
}

/** Diagnostic detail about the last refresh attempt (or null on success). */
export function getLastRefreshOutcome() {
  return lastRefreshOutcome;
}

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (err) => {
  const subs = refreshSubscribers;
  refreshSubscribers = [];
  subs.forEach((cb) => cb(err));
};

/** One /auth/refresh round-trip. Throws on failure, annotating status + code. */
async function attemptRefresh(originalFetch) {
  const res = await originalFetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    if (!data.token) {
      // A 200 with no token shouldn't happen. Treat it as transient rather than
      // tearing down a session over a malformed response.
      throw Object.assign(new Error('Refresh returned no token'), { transient: true });
    }
    window.localStorage.setItem(TOKEN_KEY, data.token);
    return;
  }

  throw Object.assign(new Error(data.code || `Refresh failed (${res.status})`), {
    status: res.status,
    code: data.code,
  });
}

/**
 * Kick off exactly one /auth/refresh; concurrent 401s piggyback on it via the
 * subscriber list. Callers MUST subscribe BEFORE this runs — otherwise the
 * refresh can finish (and flush an empty subscriber list) before they register,
 * leaving their request pending forever.
 */
function startRefresh(originalFetch) {
  isRefreshing = true;

  (async () => {
    try {
      await attemptRefresh(originalFetch);
      lastRefreshOutcome = null;
      return null;
    } catch (firstErr) {
      let err = firstErr;

      // No HTTP status means we never reached the server (offline, DNS, the
      // backend bouncing). Worth one more try before concluding anything.
      const networkLevel = err.status === undefined && !err.transient;
      if (networkLevel) {
        try {
          await new Promise((resolve) => { setTimeout(resolve, 1200); });
          await attemptRefresh(originalFetch);
          lastRefreshOutcome = null;
          return null;
        } catch (retryErr) {
          err = retryErr;
        }
      }

      lastRefreshOutcome = {
        terminal: TERMINAL_REFRESH_CODES.has(err.code),
        code: err.code || null,
        status: err.status ?? null,
        at: Date.now(),
      };
      return err;
    }
  })().then((err) => {
    isRefreshing = false;
    // Storage is deliberately NOT wiped here, whatever went wrong. A refresh can
    // fail for reasons that have nothing to do with the session being over, and
    // wiping was silently logging people out mid-session (most visibly on
    // /living, the only screen that polls every 25s, so it was the only one that
    // reliably hit an expired access token while idle). The original 401 goes
    // back to the caller, and AuthContext stays the single place that decides a
    // session is finished — now via isSessionTerminated(), so it can tell a dead
    // session from a bad minute.
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
          // Return the original 401 so callers can handle it gracefully. Whether
          // it ends the session is AuthContext's call, not ours.
          resolve(response);
          return;
        }
        // Retry the original request with the freshly minted access token.
        const newToken = window.localStorage.getItem(TOKEN_KEY);
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
