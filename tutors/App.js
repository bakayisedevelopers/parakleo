import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ui/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import {
  GoogleNavigationProvider,
  GoogleTaskRemovedBehavior,
  googleNavigationSdkAvailable,
} from './src/services/googleNavigationSdk';

// JavaScript-only edits are delivered by Metro without rebuilding the APK.
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GoogleNavigationProvider
          {...(googleNavigationSdkAvailable ? {
            termsAndConditionsDialogOptions: {
              title: 'Navigation Terms',
              companyName: 'Parakleo',
              showOnlyDisclaimer: false,
              uiParams: {
                backgroundColor: '#ffffff',
                titleColor: '#0f172a',
                mainTextColor: '#334155',
                acceptButtonTextColor: '#059669',
                cancelButtonTextColor: '#64748b',
              },
            },
            taskRemovedBehavior: GoogleTaskRemovedBehavior.CONTINUE_SERVICE,
          } : {})}
        >
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </GoogleNavigationProvider>
      </SafeAreaProvider>
      <StatusBar style="auto" />
    </ErrorBoundary>
  );
}
