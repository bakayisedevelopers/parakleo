import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { TutorRtcSessionView } from '../../components/session/TutorRtcSessionView';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { useAuth } from '../../context/AuthContext';
import { FIREBASE_PUBLIC_CONFIG } from '../../constants/runtimeConfig';
import { getFirebaseClients } from '../../firebase/config';
import { colors } from '../../theme/colors';

export function SessionRoomScreen({ route, navigate, goBack }) {
  const { user } = useAuth();
  const sessionId = route?.params?.sessionId || '';
  const bridgeRef = useRef(null);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState(Platform.OS === 'android' ? null : true);
  const [idToken, setIdToken] = useState('');
  const [authHandoff, setAuthHandoff] = useState(null);

  // Subscribe to real-time session updates
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return () => {};
    }

    const { db } = getFirebaseClients();
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId),
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Session not found or has expired.');
        }
        setLoading(false);
      },
      (err) => {
        setError(err?.message || 'Failed to load session.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [sessionId]);

  // Request Android Audio/Mic permissions for WebRTC
  useEffect(() => {
    let active = true;
    const requestMicPermission = async () => {
      if (Platform.OS !== 'android') {
        if (active) setHasMicPermission(true);
        return;
      }

      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission Required',
            message: 'Parakleo needs microphone access so your voice audio connects to the student live in the classroom.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          }
        );
        if (active) {
          setHasMicPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        }
      } catch {
        if (active) setHasMicPermission(false);
      }
    };

    requestMicPermission();
    return () => {
      active = false;
    };
  }, []);

  // Generate Auth Handoff for WebView local storage
  useEffect(() => {
    let active = true;
    const resolveAuth = async () => {
      try {
        const { auth } = getFirebaseClients();
        const firebaseUser = auth.currentUser;
        const apiKey = String(FIREBASE_PUBLIC_CONFIG.apiKey || '').trim();

        if (!firebaseUser || !apiKey) {
          if (active) setAuthHandoff(null);
          return;
        }

        const serialized = typeof firebaseUser.toJSON === 'function' ? firebaseUser.toJSON() : null;
        const token = await firebaseUser.getIdToken();

        if (active) {
          setIdToken(token || '');
          if (serialized) {
            setAuthHandoff({ apiKey, user: serialized });
          }
        }
      } catch {
        if (active) setAuthHandoff(null);
      }
    };

    resolveAuth();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const handleBridgeMessage = (type, payload) => {
    if (type === 'session:ended') {
      Alert.alert('Session Concluded', 'The tutoring session has ended and billing has been finalized.', [
        { text: 'Back to Dashboard', onPress: goBack },
      ]);
    }
  };

  if (loading) {
    return <LoadingState message="Connecting to secure virtual classroom..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={goBack} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.roomContainer}>
        <TutorRtcSessionView
          sessionId={sessionId}
          authHandoff={authHandoff}
          idToken={idToken}
          bridgeRef={bridgeRef}
          onBridgeMessage={handleBridgeMessage}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  roomContainer: {
    flex: 1,
    backgroundColor: '#09090b',
  },
});
