import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '400px', width: '100%', background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid rgba(15,23,42,0.05)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.5rem' }}>Something went wrong.</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>Please refresh the page or go back.</p>
            <button 
              onClick={() => window.location.href = '/'}
              style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #ba0036 0%, #7c0026 100%)', color: 'white', borderRadius: '0.75rem', border: 'none', fontWeight: '900', cursor: 'pointer', width: '100%', fontSize: '0.875rem', boxShadow: '0 8px 22px rgba(186,0,54,0.22)' }}
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
