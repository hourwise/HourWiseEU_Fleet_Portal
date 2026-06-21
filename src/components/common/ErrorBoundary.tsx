import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const isChunkLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(errorMessage);

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="bg-brand-card border border-brand-border rounded-lg p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-white">{isChunkLoadError ? 'Portal update available' : t('errors.somethingWentWrong')}</h2>
        </div>

        <p className="text-slate-400 text-sm mb-6">
          {isChunkLoadError
            ? 'The portal has been updated since this browser tab loaded. Reload to fetch the latest files and keep your session.'
            : errorMessage || t('errors.unexpectedError')}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => isChunkLoadError ? window.location.reload() : resetErrorBoundary()}
            className="w-full flex items-center justify-center gap-2 bg-brand-accent-dark hover:bg-brand-accent text-white font-medium py-2 px-4 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            {isChunkLoadError ? 'Reload portal' : t('common.tryAgain')}
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-brand-card border border-brand-border text-slate-300 hover:text-white font-medium py-2 px-4 rounded-lg transition"
          >
            {t('navigation.home')}
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && errorStack && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
              Error details
            </summary>
            <pre className="mt-2 text-xs bg-brand-dark p-2 rounded overflow-auto text-red-400">
              {errorStack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}

