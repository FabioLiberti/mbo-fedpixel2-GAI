import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic Error Boundary that catches render errors in child components.
 * Prevents a single panel crash from taking down the entire app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const label = this.props.name || 'Component';
    console.error(`[ErrorBoundary:${label}]`, error, errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(200, 50, 50, 0.15)',
          border: '1px solid rgba(200, 50, 50, 0.3)',
          borderRadius: '6px',
          color: '#ccc',
          fontSize: '13px',
        }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>{this.props.name || 'Componente'}</strong>: errore di rendering
          </p>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#999' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: '#ccc',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
