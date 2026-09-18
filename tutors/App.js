import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ui/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
      <StatusBar style="auto" />
    </ErrorBoundary>
  );
}

