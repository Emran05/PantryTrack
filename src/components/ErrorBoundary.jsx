import { Component } from 'react';
import Icon from './Icon';
import { reportError } from '../lib/errorReporting';

// The only class component in the app — React error boundaries can't be
// written as hooks. Catches render/lazy-chunk failures that would otherwise
// unmount the entire root and leave a blank screen (common on flaky campus
// wifi when a code-split route chunk fails to load).
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error caught by boundary:', error, info);
    // Without this the owner never learns the app crashed for a real user.
    reportError('render', error, { componentStack: info?.componentStack });
  }

  handleRetry = () => {
    // Chunk-load failures need a real reload to refetch assets; plain state
    // reset is enough for transient render errors. Reload covers both.
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
          <span style={{ color: '#d29922' }}><Icon name="warning" size={30} /></span>
          <p style={{ margin: 0, fontWeight: 600 }}>Something went wrong</p>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
            You may be offline, or a new version of the app was just published.
          </p>
          <button className="btn btn-primary" onClick={this.handleRetry} style={{ marginTop: '8px' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
