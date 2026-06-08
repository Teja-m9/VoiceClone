import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette, radius, spacing, typography } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  /** Render a show/hide eye toggle (for password fields). */
  secureToggle?: boolean;
}

/** Labelled input with a focus-highlighted border and optional password eye toggle. */
export function TextField({ label, style, secureToggle, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text variant="label" color={palette.textSecondary}>
        {label}
      </Text>
      <View
        style={[
          styles.field,
          { borderColor: focused ? palette.violet : palette.border },
          multiline && styles.fieldMultiline,
        ]}
      >
        <TextInput
          placeholderTextColor={palette.textMuted}
          selectionColor={palette.violet}
          secureTextEntry={secureToggle ? hidden : rest.secureTextEntry}
          multiline={multiline}
          style={[styles.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        {secureToggle && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Toggle password">
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={palette.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  fieldMultiline: { alignItems: 'flex-start' },
  input: { ...typography.body, color: palette.textPrimary, flex: 1, paddingVertical: spacing.md },
});
