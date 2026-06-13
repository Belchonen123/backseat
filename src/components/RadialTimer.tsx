import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/theme/tokens';

export interface RadialTimerProps {
  /** Seconds remaining. */
  secondsLeft: number;
  /** Total seconds the ring represents (for the fill fraction). */
  totalSeconds: number;
  /** Diameter of the ring in px. */
  size?: number;
  /** Ring stroke thickness in px. */
  strokeWidth?: number;
  /** Progress (filled) color. */
  progressColor?: string;
  /** Unfilled track color. */
  trackColor?: string;
  /** Color of the central number. */
  numberColor?: string;
  /** Caption under the number. Defaults to "SECONDS". */
  caption?: string;
}

/**
 * Dependency-free circular countdown ring.
 *
 * Uses the standard two-half-circle masking technique (no SVG):
 *  - The circle is split into a left and right half by two clipping wrappers.
 *  - Each half contains a half-ring that rotates to reveal the filled arc.
 *  - For 0–180deg only the right half rotates; past 180deg the right half is
 *    fully shown and the left half rotates for the remainder.
 * The remaining-time number sits in the center.
 */
export function RadialTimer({
  secondsLeft,
  totalSeconds,
  size = 256,
  strokeWidth = 12,
  progressColor = colors.tertiaryContainer,
  trackColor = colors.surfaceContainerHigh,
  numberColor = colors.tertiary,
  caption = 'SECONDS',
}: RadialTimerProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(secondsLeft, totalSeconds));
  const fraction = totalSeconds > 0 ? clamped / totalSeconds : 0;
  const degrees = fraction * 360;

  const half = size / 2;
  const firstHalfDeg = Math.min(degrees, 180);
  const secondHalfDeg = Math.max(0, degrees - 180);

  // A half-ring: a full ring whose visible part is the right semicircle.
  const baseRing = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: strokeWidth,
    borderColor: progressColor,
    position: 'absolute' as const,
  };

  // Right clip wrapper shows the right semicircle of its child ring.
  const rightWrap = {
    position: 'absolute' as const,
    width: half,
    height: size,
    left: half,
    overflow: 'hidden' as const,
  };
  const leftWrap = {
    position: 'absolute' as const,
    width: half,
    height: size,
    left: 0,
    overflow: 'hidden' as const,
  };

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* Full track ring */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: trackColor,
          position: 'absolute',
        }}
      />

      {/* First 180deg: right half rotates from the top (-180 -> 0). */}
      <View style={rightWrap}>
        <View
          style={[
            baseRing,
            { left: -half, transform: [{ rotate: `${firstHalfDeg - 180}deg` }] },
          ]}
        />
      </View>

      {/* Once past 180deg, the right half is fully filled. */}
      {degrees >= 180 ? (
        <View style={rightWrap}>
          <View style={[baseRing, { left: -half }]} />
        </View>
      ) : null}

      {/* Second 180deg: left half rotates. */}
      {secondHalfDeg > 0 ? (
        <View style={leftWrap}>
          <View
            style={[baseRing, { transform: [{ rotate: `${secondHalfDeg}deg` }] }]}
          />
        </View>
      ) : null}

      {/* Center label */}
      <View style={styles.center}>
        <Text style={[styles.number, { color: numberColor }]}>{clamped}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    ...type.statusNumber,
  },
  caption: {
    ...type.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
});
