import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getFunctionEndpoint } from '../../firebase/config';

export function StudentAiSessionView({ authHandoff, onBridgeMessage, sessionId }) {
  const sessionUrl = useMemo(() => {
    const useFirebaseEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://parakleo.bakayise.com').trim().replace(/\/+$/, '');
    const sessionPath = `/app/session/${encodeURIComponent(String(sessionId || ''))}`;
    const params = new URLSearchParams({
      sessionId: String(sessionId || ''),
      target: `${webBaseUrl}${sessionPath}`,
      source: 'mobile',
      apiKey: String(process.env.EXPO_PUBLIC_FIREBASE_API_KEY || ''),
      authDomain: String(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || ''),
      projectId: String(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || ''),
      appId: String(process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ''),
    });
    if (useFirebaseEmulators) {
      return `${getFunctionEndpoint('mobileWebviewAuth')}?${params.toString()}`;
    }
    return `${webBaseUrl}/mobile-webview-auth?${params.toString()}`;
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
        } catch (_error) {
          // no-op
        }
      })();
      true;
    `;
  }, [authHandoff]);

  return (
    <View style={styles.wrap}>
      <WebView
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        domStorageEnabled
        javaScriptEnabled
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onError={(event) => {
          onBridgeMessage?.({
            nativeEvent: {
              data: JSON.stringify({
                type: 'ai_state',
                payload: {
                  networkError: event?.nativeEvent?.description || 'Unable to load AI session room.',
                },
              }),
            },
          });
        }}
        source={{ uri: sessionUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedAuthBootstrap}
        onMessage={onBridgeMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
});
