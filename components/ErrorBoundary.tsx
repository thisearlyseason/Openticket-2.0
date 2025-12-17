import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: any): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleHardReset = () => {
    try {
        localStorage.clear();
        window.location.reload();
    } catch (e) {
        console.error("Failed to clear storage", e);
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      let errorMessage = 'An unexpected error occurred.';
      let errorStack = '';

      if (error) {
          if (typeof error === 'string') {
              errorMessage = error;
          } else if (error instanceof Error) {
              errorMessage = error.message;
              errorStack = error.stack || '';
          } else if (typeof error === 'object') {
              try {
                  if ((error as any).message) {
                      errorMessage = String((error as any).message);
                  } else if ((error as any).code) {
                      errorMessage = `Error Code: ${String((error as any).code)}`;
                  } else {
                      try {
                          const cache = new Set();
                          errorMessage = JSON.stringify(error, (key, value) => {
                              if (typeof value === 'object' && value !== null) {
                                  if (cache.has(value)) return '[Circular]';
                                  cache.add(value);
                              }
                              return value;
                          }, 2);
                      } catch (inner) {
                          errorMessage = "Error object could not be displayed (Circular Reference)";
                      }
                  }
              } catch (e) {
                  errorMessage = String(error);
              }
          } else {
              errorMessage = String(error);
          }
      }
      
      if (errorInfo && errorInfo.componentStack) {
          errorStack += `\n\nComponent Stack:\n${errorInfo.componentStack}`;
      }

      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-8">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <AlertTriangle size={32} />
                </div>
                
                <h1 className="text-2xl font-black text-center text-zinc-900 dark:text-white mb-2">Something went wrong</h1>
                <p className="text-zinc-500 text-center mb-6">The application encountered an unexpected error.</p>

                <div className="bg-zinc-100 dark:bg-black p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 overflow-auto max-h-64 custom-scrollbar">
                    <p className="font-mono text-xs text-red-600 font-bold mb-2 break-words">{errorMessage}</p>
                    {errorStack && <pre className="font-mono text-[10px] text-zinc-500 whitespace-pre-wrap break-words">{errorStack}</pre>}
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={this.handleReset}
                        className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-3 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCcw size={18} /> Reload
                    </button>
                    <button 
                        onClick={this.handleHardReset}
                        className="px-4 bg-red-50 text-red-500 border border-red-100 font-bold py-3 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
                        title="Clear Data & Reload"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}