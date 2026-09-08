import React from 'react';

/**
 * Two different failures used to land on the same screen.
 *
 *   • A real crash — a component threw, there is a bug. "Something went wrong."
 *   • A route chunk that could not be downloaded because the phone has no
 *     connection. Nothing went wrong at all; the app is offline.
 *
 * Telling a user their app is broken when their internet is off is bad enough
 * on its own, but the button made it worse: the only action offered was "Go to
 * Home", a full navigation to '/', which offline throws away the running app
 * and re-boots into the same failure. People read that as "the app does not
 * work without internet", which was very nearly true.
 *
 * lazyRoute() (utils/lazyRoute.js) tags the errors it throws with
 * `isChunkLoadError`, so this boundary can say the honest thing and offer the
 * action that actually helps.
 */

// Chunk failures thrown by code we don't control (a bare import(), a library's
// own lazy boundary) don't carry our flag, so match the browser's wording too.
const CHUNK_MESSAGE = /(dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported)/i;

const isChunkError = (error) =>
  !!error && (error.isChunkLoadError === true || CHUNK_MESSAGE.test(error.message || ''));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, online: true };
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      online: typeof navigator === 'undefined' || navigator.onLine !== false,
    };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  handleOnline() {
    this.setState({ online: true });
    // The connection came back while the user was looking at "you're offline".
    // The missing chunk is now reachable, and there is nothing on this screen
    // worth preserving, so recover without making them tap anything.
    if (isChunkError(this.state.error)) window.location.reload();
  }

  handleOffline() {
    this.setState({ online: false });
  }

  retry() {
    // A reload, not a setState. React.lazy caches the promise it created for a
    // component — including a rejected one — so re-rendering the same route
    // re-throws the same error without ever retrying the download. Only a new
    // document gets a new lazy component. The shell is precached by the
    // service worker, so this boots from cache even with no connection.
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const chunk = isChunkError(this.state.error);
    const offline = chunk && !this.state.online;

    const title = offline ? 'ইন্টারনেট সংযোগ নেই' : chunk ? 'পেজটি লোড করা গেল না' : 'কিছু একটা সমস্যা হয়েছে';
    const titleEn = offline ? "You're offline" : chunk ? "This page didn't load" : 'Something went wrong';
    const body = offline
      ? 'এই পেজটি এখনো ডাউনলোড হয়নি। ইন্টারনেট এলে নিজে থেকেই খুলে যাবে — অথবা নিচের বাটনে চাপ দিন।'
      : chunk
        ? 'পেজটির ফাইল আনা যায়নি। আবার চেষ্টা করুন।'
        : 'পেজটি রিফ্রেশ করুন অথবা পিছনে যান।';
    const bodyEn = offline
      ? "This page hasn't been downloaded yet. It will open by itself once you're back online."
      : chunk
        ? "The page's files couldn't be fetched. Please try again."
        : 'Please refresh the page or go back.';

    return (
      <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid rgba(15,23,42,0.05)' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.15rem' }}>{title}</h2>
          <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.75rem' }}>{titleEn}</p>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.35rem', fontWeight: 'bold' }}>{body}</p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '1.5rem', fontWeight: 600 }}>{bodyEn}</p>
          <button
            onClick={this.retry}
            style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #ba0036 0%, #7c0026 100%)', color: 'white', borderRadius: '0.75rem', border: 'none', fontWeight: '900', cursor: 'pointer', width: '100%', fontSize: '0.875rem', boxShadow: '0 8px 22px rgba(186,0,54,0.22)' }}
          >
            {chunk ? 'আবার চেষ্টা করুন / Try again' : 'রিফ্রেশ করুন / Refresh'}
          </button>
          {/* Offline, '/' is the one route certain to be in the cache: the
              service worker precaches the shell and the homepage chunk, so
              this is a way out rather than a second dead end. */}
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{ marginTop: '0.6rem', padding: '0.7rem 1.5rem', background: 'transparent', color: '#7c0026', borderRadius: '0.75rem', border: '1px solid rgba(186,0,54,0.25)', fontWeight: '800', cursor: 'pointer', width: '100%', fontSize: '0.8125rem' }}
          >
            হোমে যান / Go to Home
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
