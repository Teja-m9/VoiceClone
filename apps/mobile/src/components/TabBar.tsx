import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { palette, radius, shadow, spacing, motion } from '@/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  home: { active: 'sparkles', inactive: 'sparkles-outline' },
  feed: { active: 'people', inactive: 'people-outline' },
  create: { active: 'add-circle', inactive: 'add-circle-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
};

function TabItem({
  focused,
  label,
  icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: { active: IoniconName; inactive: IoniconName };
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.92, motion.spring.snappy))}
        onPressOut={() => (scale.value = withSpring(1, motion.spring.snappy))}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={[styles.item, focused && styles.itemActive]}
      >
        <Ionicons
          name={focused ? icon.active : icon.inactive}
          size={22}
          color={focused ? palette.textInverse : palette.textMuted}
        />
        {focused && (
          <Text variant="label" color={palette.textInverse} style={styles.itemLabel}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Floating pill bottom nav — the active tab expands into a lime pill with its label. */
export function TabBar({ state, descriptors, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadow.card]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const label = (options.title ?? route.name) as string;
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? ICONS.home!;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem key={route.key} focused={focused} label={label} icon={icon} onPress={onPress} />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  itemActive: {
    backgroundColor: palette.lime,
    paddingHorizontal: spacing.lg,
  },
  itemLabel: { marginLeft: spacing.sm },
});
