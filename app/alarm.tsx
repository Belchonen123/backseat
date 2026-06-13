import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { ALARM_TOTAL_SECONDS, useSession } from '@/state/session';

const HOLD_MS = 2000;
const HOLD_TICK_MS = 50;

/**
 * Full-screen red alarm (takeover). The timer counts toward auto-escalation to
 * the Safety Circle. The user must PRESS AND HOLD ~2s to confirm safety, which
 * flips the screen to the teal "Safety Confirmed" state.
 */
export default function AlarmScreen(): React.JSX.Element {
  const router = useRouter();
  const acknowledge = useSession((s) => s?.acknowledge);
  const reset = useSession((s) => s?.reset);
  const total = useSession((s) => s?.alarmSecondsLeft) ?? ALARM_TOTAL_SECONDS;

  const [secondsLeft, setSecondsLeft] = useState(total);
  const [holdProgress, setHoldProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Escalation countdown.
  useEffect(() => {
    if (confirmed || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, confirmed]);

  const clearHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const onPressIn = useCallback(
    (_e: GestureResponderEvent) => {
      if (confirmed) return;
      let elapsed = 0;
      clearHold();
      holdRef.current = setInterval(() => {
        elapsed += HOLD_TICK_MS;
        setHoldProgress(Math.min(elapsed / HOLD_MS, 1));
        if (elapsed >= HOLD_MS) {
          clearHold();
          setConfirmed(true);
          // TODO(@teammate FSM): require biometric before dismissing.
          acknowledge?.();
        }
      }, HOLD_TICK_MS);
    },
    [confirmed, clearHold, acknowledge],
  );

  const onPressOut = useCallback(() => {
    clearHold();
    if (!confirmed) setHoldProgress(0);
  }, [clearHold, confirmed]);

  useEffect(() => clearHold, [clearHold]);

  if (confirmed) {
    return (
      <SafeAreaView style={[styles.safe, styles.safeConfirmed]}>
        <View style={styles.confirmedWrap}>
          <Text style={styles.confirmedGlyph}>✓</Text>
          <Text style={styles.confirmedTitle}>SAFETY CONFIRMED</Text>
          <Text style={styles.confirmedBody}>
            The reminder has been cleared. Your Safety Circle has been notified
            that everything is okay.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.returnBtn}
            onPress={() => {
              reset?.();
              router.replace('/(tabs)/monitor');
            }}
          >
            <Text style={styles.returnBtnText}>Return to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const fraction = total > 0 ? secondsLeft / total : 0;

  return (
    <SafeAreaView style={[styles.safe, styles.safeAlarm]}>
      <View style={styles.top}>
        <Text style={styles.warnGlyph}>⚠️</Text>
        <Text style={styles.bigTitle}>CHECK THE{'\n'}BACK SEAT</Text>
        <Text style={styles.subTitle}>Reminder Aid Active</Text>
      </View>

      <View style={styles.middle}>
        <View style={styles.glassCard}>
          <Text style={styles.escalationLabel}>ESCALATION IN PROGRESS</Text>
          <Text style={styles.timerBig}>{timeStr}</Text>
          <Text style={styles.escalationBody}>
            Paging your Safety Circle in {timeStr}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${Math.max(fraction * 100, 0)}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.locPill}>
          <Text style={styles.locText}>📍 Parked at: 1248 Oakwood Ave</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Press and hold for two seconds to confirm your child is with you"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.confirmBtn}
        >
          <Text style={styles.confirmBtnTitle}>CONFIRM SAFETY</Text>
          <Text style={styles.confirmBtnHint}>
            Hold to verify your child is with you
          </Text>
          <View style={styles.holdTrack}>
            <View
              style={[styles.holdFill, { width: `${holdProgress * 100}%` }]}
            />
          </View>
        </Pressable>
        <Text style={styles.muteNote}>
          Muting your device does not pause this timer.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  safeAlarm: { backgroundColor: colors.error },
  safeConfirmed: { backgroundColor: colors.primaryContainer },

  top: {
    alignItems: 'center',
    paddingTop: spacing.stackLg,
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.base,
  },
  warnGlyph: { fontSize: 64 },
  bigTitle: {
    ...type.displayLg,
    color: colors.onError,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subTitle: { ...type.titleMd, color: colors.errorContainer },

  middle: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.gutter,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.card,
    padding: spacing.stackMd,
    alignItems: 'center',
    gap: spacing.stackSm,
  },
  escalationLabel: {
    ...type.labelMd,
    color: colors.errorContainer,
    letterSpacing: 2,
  },
  timerBig: { ...type.statusNumber, color: colors.onError },
  escalationBody: {
    ...type.bodyMd,
    color: colors.onError,
    fontWeight: '600',
    textAlign: 'center',
  },
  track: {
    width: '100%',
    height: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    marginTop: spacing.base,
  },
  trackFill: { height: '100%', backgroundColor: colors.onError },
  locPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.card,
    padding: spacing.gutter,
  },
  locText: { ...type.bodyMd, color: colors.onError, fontWeight: '600' },

  bottom: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.stackMd,
    gap: spacing.stackSm,
  },
  confirmBtn: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
    paddingVertical: spacing.stackMd,
    alignItems: 'center',
    gap: spacing.base,
  },
  confirmBtnTitle: { ...type.headlineLgMobile, color: colors.error },
  confirmBtnHint: { ...type.labelMd, color: colors.error, fontWeight: '400' },
  holdTrack: {
    width: 192,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
    overflow: 'hidden',
    marginTop: spacing.base,
  },
  holdFill: { height: '100%', backgroundColor: colors.error },
  muteNote: {
    ...type.labelMd,
    fontSize: 11,
    color: colors.errorContainer,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  confirmedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.marginMobile,
    gap: spacing.stackMd,
  },
  confirmedGlyph: { fontSize: 96, color: colors.onPrimaryContainer },
  confirmedTitle: {
    ...type.displayLg,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
  },
  confirmedBody: {
    ...type.bodyLg,
    color: colors.onPrimaryContainer,
    textAlign: 'center',
    opacity: 0.9,
  },
  returnBtn: {
    marginTop: spacing.stackMd,
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: spacing.stackLg,
    paddingVertical: spacing.gutter,
    borderRadius: radius.full,
  },
  returnBtnText: { ...type.titleMd, color: colors.primaryContainer },
});
