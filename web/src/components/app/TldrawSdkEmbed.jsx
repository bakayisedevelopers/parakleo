import { useEffect, useMemo, useState } from 'react';
import 'tldraw/tldraw.css';
import { debugError, debugLog } from '../../utils/devLogger';

export default function TldrawSdkEmbed({ roomId, licenseKey }) {
  const [TldrawComponent, setTldrawComponent] = useState(null);
  const [loadError, setLoadError] = useState('');

  const persistenceKey = useMemo(
    () => `claxi-${roomId || 'session-board'}`,
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
        setLoadError(error?.message || 'Unable to load tldraw SDK.');
      }
    }

    loadSdk();

    return () => {
      canceled = true;
    };
  }, []);

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
    />
  );
}