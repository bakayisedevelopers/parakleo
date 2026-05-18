import { useEffect, useMemo, useState } from 'react';
import 'tldraw/tldraw.css';
import { debugError, debugLog } from '../../utils/devLogger';

const TLDRAW_RELOAD_RETRY_KEY = 'parakleo_tldraw_chunk_reload_retry';
const LEGACY_TLDRAW_RELOAD_RETRY_KEY = 'claxi_tldraw_chunk_reload_retry';

export default function TldrawSdkEmbed({ roomId, licenseKey, onMount }) {
  const [TldrawComponent, setTldrawComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  const persistenceKey = useMemo(
    () => `parakleo-${roomId || 'session-board'}`,
    [roomId]
  );

  useEffect(() => {
    let canceled = false;

    async function loadSdk() {
      try {
        setLoadError('');
        debugLog('tldraw', 'Loading tldraw SDK runtime module.');

        const module = await import('tldraw');

        if (canceled) return;

        const sdkComponent = module?.Tldraw || null;

        if (!sdkComponent) {
          debugError('tldraw', 'SDK module missing Tldraw export.');
          setLoadError('Whiteboard failed to initialize (missing Tldraw export).');
          return;
        }

        debugLog('tldraw', 'tldraw SDK loaded successfully.');
        setTldrawComponent(() => sdkComponent);
      } catch (error) {
        if (canceled) return;
        debugError('tldraw', 'Whiteboard SDK load failed.', {
          message: error?.message,
        });

        const isChunkLoadFailure = /Failed to fetch dynamically imported module/i.test(error?.message || '');
        const hasRetried = typeof window !== 'undefined'
          && window.sessionStorage?.getItem(TLDRAW_RELOAD_RETRY_KEY) === 'true';

        if (isChunkLoadFailure && !hasRetried && typeof window !== 'undefined') {
          debugLog('tldraw', 'Retrying once after dynamic import chunk load failure.');
          window.sessionStorage?.setItem(TLDRAW_RELOAD_RETRY_KEY, 'true');
          window.sessionStorage?.removeItem(LEGACY_TLDRAW_RELOAD_RETRY_KEY);
          window.location.reload();
          return;
        }

        if (typeof window !== 'undefined') {
          window.sessionStorage?.removeItem(TLDRAW_RELOAD_RETRY_KEY);
          window.sessionStorage?.removeItem(LEGACY_TLDRAW_RELOAD_RETRY_KEY);
        }
        setLoadError(error?.message || 'Unable to load tldraw SDK.');
      }
    }

    loadSdk();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!TldrawComponent || typeof window === 'undefined') return;
    window.sessionStorage?.removeItem(TLDRAW_RELOAD_RETRY_KEY);
    window.sessionStorage?.removeItem(LEGACY_TLDRAW_RELOAD_RETRY_KEY);
  }, [TldrawComponent]);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-semibold text-rose-600">
          Whiteboard is temporarily unavailable.
        </p>
        <p className="text-xs text-zinc-500">{loadError}</p>
      </div>
    );
  }

  if (!TldrawComponent) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-500">
        Loading collaborative whiteboard SDK...
      </div>
    );
  }

  return (
    <TldrawComponent
      persistenceKey={persistenceKey}
      licenseKey={licenseKey || undefined}
      onMount={onMount}
    />
  );
}
