import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Background color. Defaults to lowest surface container. */
  background?: string;
  /** Draw a 1px outline (clinical, no shadow per design system). */
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rounded 16px container. Low-contrast outline, no heavy shadow
 * (tonal layering per the design system).
 */
export function Card({
  children,
  onPress,
  background = colors.surfaceContainerLowest,
  outlined = true,
  style,
}: CardProps): React.JSX.Element {
  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: background },
        outlined && styles.outlined,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.gutter,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
