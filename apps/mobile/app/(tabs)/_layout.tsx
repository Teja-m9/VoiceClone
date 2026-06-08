import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform } from 'react-native';
import { palette, radius } from '@/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICONS = {
  home: { active: 'sparkles', inactive: 'sparkles-outline' },
  create: { active: 'mic', inactive: 'mic-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
} satisfies Record<string, { active: IoniconName; inactive: IoniconName }>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: palette.violet,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          ) : null,
        sceneStyle: { backgroundColor: palette.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={ICONS.home[focused ? 'active' : 'inactive']} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={ICONS.create[focused ? 'active' : 'inactive']} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={ICONS.profile[focused ? 'active' : 'inactive']} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : palette.bgElevated,
    height: 78,
    paddingTop: 8,
    paddingBottom: 18,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  label: { fontSize: 11, fontWeight: '600' },
});
