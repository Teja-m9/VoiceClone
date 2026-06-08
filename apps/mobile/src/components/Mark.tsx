import { Text as RNText, type TextProps } from 'react-native';
import { palette } from '@/theme';

/**
 * Lime "highlighter" mark behind a word — the signature accent from the travel-app
 * design. Use INSIDE a <Text> heading: `Explore <Mark>the world</Mark> your way`.
 * Inline backgroundColor renders the highlight behind the glyphs.
 */
export function Mark({ children, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[{ backgroundColor: palette.lime, color: palette.textPrimary }, style]}
      {...rest}
    >
      {/* hair spaces give the marker a little horizontal padding */}
      {' '}
      {children}
      {' '}
    </RNText>
  );
}
