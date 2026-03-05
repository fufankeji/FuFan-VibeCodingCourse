import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional: scope label shown in the fallback UI */
  scope?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.scope ? ` ${this.props.scope}` : ""}]`, error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px]">
          <AlertTriangle size={28} className="text-amber-glow" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-slate-200">
              {this.props.scope ? `${this.props.scope} 渲染出错` : "页面渲染出错"}
            </p>
            <p className="text-xs text-slate-500 font-mono max-w-md truncate">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-glow/10 text-amber-glow border border-amber-glow/20 hover:bg-amber-glow/20 transition-colors"
          >
            <RotateCcw size={12} />
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
