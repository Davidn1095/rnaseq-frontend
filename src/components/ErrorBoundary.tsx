import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallbackTitle = "Something went wrong", fallbackMessage } = this.props;

    if (hasError) {
      return (
        <div className="panel">
          <div className="h3">{fallbackTitle}</div>
          <div className="muted small">{fallbackMessage ?? "Please try another tab."}</div>
          {error?.message ? <div className="muted small">Details: {error.message}</div> : null}
        </div>
      );
    }

    return children;
  }
}
