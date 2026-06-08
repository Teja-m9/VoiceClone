import { TextStyle } from 'react-native';
import { palette } from './colors';

/**
 * Type scale. Uses the system font by default; if you bundle a display font
 * (e.g. via expo-font) set FONT_DISPLAY / FONT_BODY and they flow through here.
 */
export const FONT_DISPLAY: string | undefined = undefined; // e.g. 'ClashDisplay'
export const FONT_BODY: string | undefined = undefined; // e.g. 'Inter'

export const typography = {
  displayXl: {
    fontFamily: FONT_DISPLAY,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1,
    color: palette.textPrimary,
  },
  display: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: palette.textPrimary,
  },
  h1: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: palette.textPrimary,
  },
  h2: {
    fontFamily: FONT_BODY,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  title: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    color: palette.textSecondary,
  },
  label: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  caption: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: palette.textMuted,
  },
  overline: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
