
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fixed ErrorBoundary inheritance by using React.Component explicitly to ensure 'this.props' is correctly recognized by the TypeScript compiler.
// Class components are required for Error Boundaries in React as of current versions.
class ErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
          <div className="bg-red-900/20 border border-red-500 p-6 rounded-xl max-w-2xl text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              The application encountered an error. This is often due to stale data in your browser's local storage.
            </p>
            <pre className="bg-black/50 p-4 rounded text-left text-xs overflow-auto mb-6 max-h-40">
              {this.state.error?.toString()}
            </pre>
            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-all"
            >
              Clear Storage & Reset App
            </button>
          </div>
        </div>
      );
    }
    // Correctly accessing children via this.props from the Component base class
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
