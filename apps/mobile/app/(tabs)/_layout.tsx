import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { TabBar } from '@/components/TabBar';

// Material top tabs give finger-swipe between screens; we render our own floating bottom
// bar via the `tabBar` prop and position it at the bottom.
const { Navigator } = createMaterialTopTabNavigator();
const SwipeTabs = withLayoutContext(Navigator);

export default function TabsLayout() {
  return (
    <SwipeTabs
      tabBarPosition="bottom"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ swipeEnabled: true }}
    >
      <SwipeTabs.Screen name="home" options={{ title: 'Discover' }} />
      <SwipeTabs.Screen name="create" options={{ title: 'Create' }} />
      <SwipeTabs.Screen name="songs" options={{ title: 'Songs' }} />
      <SwipeTabs.Screen name="feed" options={{ title: 'Shared' }} />
      <SwipeTabs.Screen name="profile" options={{ title: 'You' }} />
    </SwipeTabs>
  );
}
