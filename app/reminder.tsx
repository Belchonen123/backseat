import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Card,
  GhostButton,
  PrimaryButton,
  RadialTimer,
  StatusBanner,
} from '@/components';
import { colors, spacing, type } from '@/theme/tokens';
import {
  REMINDER_TOTAL_SECONDS,
  useSession,
} from '@/state/session';

/**
 * Amber first-reminder screen. Trip has ended; a countdown runs to the loud
 * alarm. Single-tap "I have my child" clears it. "Still in vehicle" snoozes.
 */
export default function ReminderScreen(): React.JSX.Element {
  const router = useRouter();
  const acknowledge = useSession((s) => s?.acknowledge);
  const escalate = useSession((s) => s?.escalate);
  const storeSeconds =
    useSession((s) => s?.reminderSecondsLeft) ?? REMINDER_TOTAL_SECONDS;

  const [secondsLeft, setSecondsLeft] = useState(storeSeconds);

  useEffect(() => {
    // TODO(@teammate FSM): the real countdown lives in the store/native timer.
    // Local interval here keeps the screen functional standalone.
    if (secondsLeft <= 0) {
      escalate?.();
      router.replace('/alarm');
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, escalate, router]);

  const critical = secondsLeft <= 10;

  const handleConfirm = (): void => {
    acknowledge?.();
    router.replace('/(tabs)/monitor');
  };

  const handleStillInVehicle = (): void => {
    // TODO(@teammate FSM): proper snooze policy (capped). Local +30s for now.
    setSecondsLeft((s) => Math.min(s + 30, 120));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <StatusBanner
          title="Trip Ended: Check the Back Seat"
          subtitle="Did you grab everyone? Confirm to clear this reminder."
          background={colors.tertiaryContainer}
          foreground={colors.onTertiaryContainer}
          leading={<Text style={styles.bannerGlyph}>⚠️</Text>}
        />

        <View style={styles.timerWrap}>
          <RadialTimer
            secondsLeft={secondsLeft}
            totalSeconds={REMINDER_TOTAL_SECONDS}
            progressColor={critical ? colors.error : colors.tertiaryContainer}
            numberColor={critical ? colors.error : colors.tertiary}
          />
          <Text style={styles.criticalNote}>
            {critical
              ? 'LOUD ALARM TRIGGERING SOON'
              : 'Reminder will escalate if not cleared'}
          </Text>
        </View>

        <Card>
          <Text style={styles.cardLabel}>PARKED LOCATION</Text>
          <Text style={styles.cardValue}>452 Willow Lane</Text>
        </Card>

        <View style={styles.actions}>
          <PrimaryButton
            label="I Have My Child"
            onPress={handleConfirm}
            accessibilityHint="Clears this reminder"
          />
          <GhostButton
            label="Still in Vehicle"
            onPress={handleStillInVehicle}
          />
        </View>

        <Text style={styles.disclaimer}>
          This reminder fires because your trip ended. BackSeat cannot detect
          whether a child is actually present — it is a prompt to check.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: {
    padding: spacing.marginMobile,
    gap: spacing.stackMd,
    flexGrow: 1,
  },
  bannerGlyph: { fontSize: 32 },
  timerWrap: {
    alignItems: 'center',
    gap: spacing.gutter,
    paddingVertical: spacing.stackMd,
  },
  criticalNote: {
    ...type.labelMd,
    color: colors.error,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  cardLabel: { ...type.labelMd, color: colors.onSurfaceVariant },
  cardValue: { ...type.titleMd, color: colors.onSurface, marginTop: 2 },
  actions: { gap: spacing.gutter },
  disclaimer: {
    ...type.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.gutter,
  },
});
