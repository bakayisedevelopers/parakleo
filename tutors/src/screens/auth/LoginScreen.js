import { HomeScreen } from './HomeScreen';

export function LoginScreen(props) {
  return <HomeScreen {...props} initialMode="signin" />;
}
