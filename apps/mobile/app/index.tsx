import { Redirect } from 'expo-router';

/** Entry point — AuthGate in _layout handles the real redirect; default to home. */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
