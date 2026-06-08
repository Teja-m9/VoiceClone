export { palette, colors, gradients } from './colors';
export type { GradientName } from './colors';
export { spacing, radius, shadow } from './spacing';
export type { Spacing, Radius } from './spacing';
export { typography, FONT_DISPLAY, FONT_BODY } from './typography';
export type { TypographyVariant } from './typography';
export { motion } from './motion';

import { palette } from './colors';
import { spacing, radius, shadow } from './spacing';
import { typography } from './typography';
import { motion } from './motion';

/** Single theme object for convenience: `import { theme } from '@/theme'`. */
export const theme = {
  colors: palette,
  spacing,
  radius,
  shadow,
  typography,
  motion,
} as const;

export type Theme = typeof theme;
