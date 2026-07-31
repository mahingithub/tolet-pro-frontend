import { clearAllAppData } from '../services/authService.js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (err) => {
  refreshSubscribers.forEach((cb) => cb(err));
  refreshSubscribers = [];
};

export function setupFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : input?.url || '';
    
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
      response.status === 401 &&
      isApiRequest &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh')
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          
          if (!refreshRes.ok) {
            throw new Error('Refresh failed');
          }
          
          const data = await refreshRes.json();
          
          if (data.token) {
            window.localStorage.setItem('auth:token', data.token);
            onRefreshed(null); // Success
          } else {
            throw new Error('No token returned');
          }
        } catch (err) {
          onRefreshed(err); // Failure
          clearAllAppData(); // Wipes local storage -> triggers redirect via AuthContext
        } finally {
          isRefreshing = false;
        }
      }

      // Return a Promise that resolves when the refresh is complete
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (err) => {
          if (err) {
            // Return original 401 so callers can handle it gracefully (e.g. show login)
            resolve(response);
          } else {
            // Retry the original request
            if (init && init.headers) {
              const newHeaders = new Headers(init.headers);
              const newToken = window.localStorage.getItem('auth:token');
              // If there was an Authorization header, update it
              if (newToken && (newHeaders.has('Authorization') || newHeaders.has('authorization'))) {
                newHeaders.delete('Authorization');
                newHeaders.delete('authorization');
                newHeaders.set('Authorization', `Bearer ${newToken}`);
              } else if (newToken) {
                // For cases where headers is a plain object or undefined
                // If it wasn't a Headers object, we still reconstructed it as one above
                newHeaders.set('Authorization', `Bearer ${newToken}`);
              }
              init.headers = newHeaders;
            } else if (init) {
              const newToken = window.localStorage.getItem('auth:token');
              if (newToken) {
                init.headers = { 'Authorization': `Bearer ${newToken}` };
              }
            }
            
            try {
              const retryResponse = await originalFetch(input, init);
              resolve(retryResponse);
            } catch (retryErr) {
              reject(retryErr);
            }
          }
        });
      });
    }

    return response;
  };
}
