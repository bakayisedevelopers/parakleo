import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { FIREBASE_PUBLIC_CONFIG, USE_FIREBASE_EMULATORS, WEB_APP_BASE_URL } from '../../constants/runtimeConfig';
import { getFunctionEndpoint } from '../../firebase/config';

export function TutorRtcSessionView({
  authHandoff,
  bridgeRef,
  idToken,
  onBridgeMessage,
  sessionId,
}) {
  const webViewRef = useRef(null);

  const sessionUrl = useMemo(() => {
    const sessionPath = `/app/session/${encodeURIComponent(String(sessionId || ''))}`;
    const params = new URLSearchParams({
      sessionId: String(sessionId || ''),
      target: `${WEB_APP_BASE_URL}${sessionPath}`,
      source: 'mobile_tutor',
      apiKey: FIREBASE_PUBLIC_CONFIG.apiKey,
      authDomain: FIREBASE_PUBLIC_CONFIG.authDomain,
      projectId: FIREBASE_PUBLIC_CONFIG.projectId,
      appId: FIREBASE_PUBLIC_CONFIG.appId,
    });
    if (USE_FIREBASE_EMULATORS) {
      return `${getFunctionEndpoint('mobileWebviewAuth')}?${params.toString()}`;
    }
    return `${WEB_APP_BASE_URL}${sessionPath}?source=mobile_tutor&sessionId=${encodeURIComponent(String(sessionId || ''))}`;
  }, [sessionId]);

  const injectedAuthBootstrap = useMemo(() => {
    const payload = JSON.stringify(authHandoff || {});
    return `
      (function () {
        try {
          var handoff = ${payload};
          if (!handoff || !handoff.apiKey || !handoff.user) return;
          var appName = '[DEFAULT]';
          var authKey = 'firebase:authUser:' + handoff.apiKey + ':' + appName;
          var persistenceKey = 'firebase:persistence:' + handoff.apiKey + ':' + appName;
          window.localStorage.setItem(authKey, JSON.stringify(handoff.user));
          window.localStorage.setItem(persistenceKey, 'local');

          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              payload: { message: 'Tutor Auth handoff persisted to localStorage.' }
            }));
          }
        } catch (error) {
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              payload: { message: 'Tutor Auth handoff persistence failed.', error: String(error && error.message || error) }
            }));
          }
        }
      })();
      true;
    `;
  }, [authHandoff]);

  const injectedRuntimeProbe = `
    (function () {
      try {
        if (!window.__PARAKLEO_CONSOLE_BRIDGED__) {
          window.__PARAKLEO_CONSOLE_BRIDGED__ = true;
          var originalLog = console.log;
          var originalWarn = console.warn;
          var originalError = console.error;
          function forward(level, args) {
            try {
              var serialized = Array.prototype.map.call(args || [], function (entry) {
                if (typeof entry === 'string') return entry;
                try { return JSON.stringify(entry); } catch (_e) { return String(entry); }
              }).join(' ');
              if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'log',
                  payload: { message: 'Tutor WebView console ' + level, detail: serialized }
                }));
              }
            } catch (_err) {}
          }
          console.log = function () { forward('log', arguments); originalLog && originalLog.apply(console, arguments); };
          console.warn = function () { forward('warn', arguments); originalWarn && originalWarn.apply(console, arguments); };
          console.error = function () { forward('error', arguments); originalError && originalError.apply(console, arguments); };
        }
      } catch (_e) {}
    })();
    true;
  `;

  useEffect(() => {
    if (bridgeRef) {
      bridgeRef.current = {
        postMessage: (type, payload) => {
          if (!webViewRef.current) return;
          const serialized = JSON.stringify({ type, payload: payload || {} });
          webViewRef.current.injectJavaScript(`
            (function () {
              try {
                window.dispatchEvent(new CustomEvent('parakleo:mobile-bridge', { detail: ${serialized} }));
              } catch (err) {}
            })();
            true;
          `);
        },
      };
    }
  }, [bridgeRef]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || '{}');
      onBridgeMessage?.(data.type, data.payload);
    } catch {
      // ignore message parse errors
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: sessionUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedAuthBootstrap}
        injectedJavaScript={injectedRuntimeProbe}
        onMessage={handleMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        )}
        startInLoadingState
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  webView: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
