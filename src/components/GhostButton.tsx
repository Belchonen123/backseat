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

export interface GhostButtonProps {
  label: string;
  onPress?: () => void;
  /** Stroke + text color. Defaults to outline neutral. */
  color?: string;
  disabled?: boolean;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/**
 * Ghost / dismissal button — transparent with a 2px stroke.
 * Used for non-emergency secondary actions ("Snooze", "Still in vehicle").
 */
export function GhostButton({
  label,
  onPress,
  color = colors.outline,
  disabled = false,
  leading,
  style,
  accessibilityHint,
}: GhostButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: color },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: spacing.touchTargetMin,
    width: '100%',
    borderRadius: radius.button,
    borderWidth: 2,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.stackSm,
  },
  leading: {
    marginRight: spacing.base,
  },
  label: {
    ...type.titleMd,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
