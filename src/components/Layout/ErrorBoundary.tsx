import React from 'react';
import i18n from '../../config/i18n';
import { error as logError } from '../../services/logging';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches runtime errors in the React tree so a single broken component
 * shows a readable fallback with a reload button instead of a white page.
 * Chats and settings live in IndexedDB/localStorage and survive the crash.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logError('UI-Fehler abgefangen:', error, info.componentStack);
  }

  public override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <div className="text-4xl mb-4" aria-hidden="true">🧌</div>
            <h1 className="text-xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
              {i18n.t('errorBoundary.title')}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
              {i18n.t('errorBoundary.text')}
            </p>
            <button
              type="button"
              onClick={(): void => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
            >
              {i18n.t('errorBoundary.reload')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
