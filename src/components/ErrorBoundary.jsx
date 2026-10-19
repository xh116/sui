import { Component } from "react";

// Keeps one broken screen from unmounting the whole dashboard.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-400">
          Something went wrong. Reload the page to try again.
        </div>
      );
    }
    return this.props.children;
  }
}
