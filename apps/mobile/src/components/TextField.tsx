import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { palette, radius, spacing, typography } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
}

/** Labelled input with a focus-highlighted neon border. */
export function TextField({ label, style, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label" color={palette.textSecondary}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={palette.textMuted}
        selectionColor={palette.violet}
        style={[
          styles.input,
          { borderColor: focused ? palette.violet : palette.border },
          style,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  input: {
    ...typography.body,
    color: palette.textPrimary,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
