import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { recordCrash } from '@/lib/crash-reporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordCrash(error, { source: 'react-error-boundary', componentStack: info.componentStack });
  }

  handleRestart = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Something went wrong</p>
              <p className="text-xs text-muted-foreground">Your data is safe. Restart to continue.</p>
            </div>
          </div>
          <div className="p-5">
            <button
              onClick={this.handleRestart}
              className="w-full rounded-xl px-4 py-3 bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={15} />
              Restart App
            </button>
          </div>
        </div>
      </div>
    );
  }
}

