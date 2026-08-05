import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '40vh', gap: '1rem',
          color: '#374151', textAlign: 'center', padding: '2rem',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠</div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', maxWidth: 360 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1.25rem', background: '#2563eb', color: 'white',
              border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
