import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type } from '@/theme/tokens';

export interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  /** Background color. Defaults to teal primary (Safe/Resolved anchor). */
  color?: string;
  /** Text/foreground color. */
  textColor?: string;
  disabled?: boolean;
  /** Optional leading element (e.g. an icon glyph). */
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/**
 * Primary action button — 56px tall, full width, rounded 8px.
 * Used for the most important action on a screen.
 */
export function PrimaryButton({
  label,
  onPress,
  color = colors.primary,
  textColor = colors.onPrimary,
  disabled = false,
  leading,
  style,
  accessibilityHint,
}: PrimaryButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: spacing.primaryButtonHeight,
    width: '100%',
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
  },
  leading: {
    marginRight: spacing.base,
  },
  label: {
    ...type.titleMd,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
