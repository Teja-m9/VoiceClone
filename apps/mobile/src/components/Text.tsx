import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { typography, type TypographyVariant } from '@/theme';

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  center?: boolean;
}

/** Typed text — always renders a token from the type scale. Avoid raw <Text>. */
export function Text({
  variant = 'body',
  color,
  center,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={[
        typography[variant],
        color ? { color } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}
