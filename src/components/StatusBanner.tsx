import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, type } from '@/theme/tokens';

export interface StatusBannerProps {
  title: string;
  subtitle?: string;
  /** Background color — encodes escalation state (blue/amber/red/teal). */
  background?: string;
  /** Foreground text color. */
  foreground?: string;
  /** Optional leading element (icon glyph). */
  leading?: React.ReactNode;
  /** When true, render edge-to-edge with no corner radius. */
  fullBleed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-bleed colored header that changes color with the safety state.
 * Blue (monitoring) -> Amber (reminder) -> Red (alarm) -> Teal (resolved).
 */
export function StatusBanner({
  title,
  subtitle,
  background = colors.secondaryContainer,
  foreground = colors.onSecondaryContainer,
  leading,
  fullBleed = false,
  style,
}: StatusBannerProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="header"
      style={[
        styles.banner,
        { backgroundColor: background },
        fullBleed ? styles.fullBleed : styles.rounded,
        style,
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: foreground }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.gutter,
    gap: spacing.gutter,
  },
  rounded: {
    borderRadius: radius.card,
  },
  fullBleed: {
    borderRadius: 0,
    width: '100%',
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: spacing.base / 2,
  },
  title: {
    ...type.titleMd,
  },
  subtitle: {
    ...type.bodyMd,
    opacity: 0.9,
  },
});
