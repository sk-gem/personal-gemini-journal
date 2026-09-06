import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  onDismiss,
  isRetrying = false,
}) => {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-xs text-red-200 shadow-2xs backdrop-blur-xs"
    >
      <div className="flex items-center gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
        <p className="font-medium text-red-200">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1 rounded bg-red-900/60 px-2.5 py-1 text-xs font-semibold text-red-100 hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded p-1 text-red-400 hover:bg-red-900/40 transition-colors cursor-pointer"
          aria-label="Dismiss error"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
