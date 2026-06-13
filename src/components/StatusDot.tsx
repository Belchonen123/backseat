import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';

export interface StatusDotProps {
  /** Dot color — encodes state. Defaults to teal (safe). */
  color?: string;
  /** Diameter in px. */
  size?: number;
  /** Soft outer halo ring in the same color. */
  halo?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small circular status indicator (full radius). */
export function StatusDot({
  color = colors.primary,
  size = 12,
  halo = false,
  style,
}: StatusDotProps): React.JSX.Element {
  return (
    <View
      style={[
        halo && {
          padding: size * 0.5,
          borderRadius: radius.full,
          backgroundColor: color + '33', // ~20% alpha halo
        },
        style,
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
