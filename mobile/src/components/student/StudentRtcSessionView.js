import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getFunctionEndpoint } from '../../firebase/config';

function toBridgeMessage(type, payload) {
  return {
    nativeEvent: {
      data: JSON.stringify({ type, payload: payload || {} }),
    },
  };
}

export function StudentRtcSessionView({
  authHandoff,
  bridgeRef,
  idToken,
  onBridgeMessage,
  sessionId,
}) {
  const webViewRef = useRef(null);
  const mutedRef = useRef(false);

  const sessionUrl = useMemo(() => {
    const webBaseUrl = String(process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://parakleo.co.za').trim().replace(/\/+$/, '');
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
    return `${getFunctionEndpoint('mobileWebviewAuth')}?${params.toString()}`;
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
        } catch (error) {
          // no-op
        }
      })();
      true;
    `;
  }, [authHandoff]);

  const emitBridge = (type, payload) => {
    onBridgeMessage?.(toBridgeMessage(type, payload));
  };

  const toggleAudio = async () => {
    mutedRef.current = !mutedRef.current;
    webViewRef.current?.injectJavaScript(`
      (function () {
        var muted = ${mutedRef.current ? 'true' : 'false'};
        var media = document.querySelectorAll('video, audio');
        media.forEach(function (el) { el.muted = muted; });
        if (window.ParakleoSessionBridge && typeof window.ParakleoSessionBridge.toggleAudio === 'function') {
          window.ParakleoSessionBridge.toggleAudio();
        }
      })();
      true;
    `);
    emitBridge('rtc_state', { isMuted: mutedRef.current });
    return !mutedRef.current;
  };

  const closeRtc = async () => {
    webViewRef.current?.injectJavaScript(`
      (function () {
        if (window.ParakleoSessionBridge && typeof window.ParakleoSessionBridge.close === 'function') {
          window.ParakleoSessionBridge.close();
        }
      })();
      true;
    `);
  };

  useEffect(() => {
    bridgeRef.current = {
      toggleAudio,
      close: closeRtc,
    };

    return () => {
      if (bridgeRef.current?.close === closeRtc) {
        bridgeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeRef]);

  useEffect(() => {
    emitBridge('rtc_state', {
      connectionMessage: 'Opening secure session room...',
      networkError: '',
      isPeerConnected: false,
      isRemoteScreenSharing: false,
      hasLiveRemoteScreenTrack: false,
      isMuted: mutedRef.current,
    });

    return () => closeRtc().catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <View style={styles.wrap}>
      <WebView
        allowsInlineMediaPlayback
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        onError={(event) => {
          emitBridge('rtc_state', {
            connectionMessage: 'Unable to load secure session room.',
            networkError: event?.nativeEvent?.description || 'Please check your internet connection and try again.',
            isPeerConnected: false,
            isRemoteScreenSharing: false,
            hasLiveRemoteScreenTrack: false,
          });
        }}
        onLoadEnd={() => {
          emitBridge('rtc_state', {
            connectionMessage: 'Secure session room ready.',
            networkError: '',
            isPeerConnected: true,
            isRemoteScreenSharing: true,
            hasLiveRemoteScreenTrack: true,
            isMuted: mutedRef.current,
          });
        }}
        onMessage={(event) => {
          onBridgeMessage?.(event);
        }}
        originWhitelist={['https://*']}
        ref={webViewRef}
        injectedJavaScriptBeforeContentLoaded={injectedAuthBootstrap}
        source={{
          uri: sessionUrl,
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        }}
        renderLoading={() => (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
        )}
        startInLoadingState
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
});
