import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { useSettingsStore } from '@/state/settings';
import { testAlarm } from '@/alerts';

/**
 * Alarm screen. Honest scope: the escalation alarm uses the device's default
 * alarm sound on a high-importance channel that bypasses DND. Custom uploaded
 * tones require bundling raw audio resources into a native build (a prebuild +
 * road test), so that is an explicit "next build" item rather than a fake
 * picker.
 *
 * What this screen DOES do today, for real:
 *   - Play a short test alarm so the user can confirm loudness + DND override on
 *     their actual phone (the one thing the emulator can't prove).
 *   - Toggle the audible reminder chime (persisted setting).
 */
const TEST_SECONDS = 5;

export default function AlarmSoundScreen(): React.JSX.Element {
  const router = useRouter();
  const loudReminder = useSettingsStore((s) => s.loudReminder);
  const setSetting = useSettingsStore((s) => s.set);

  const [testing, setTesting] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  // Make sure a running test alarm is stopped if the screen unmounts.
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  const runTest = (): void => {
    if (testing) {
      cancelRef.current?.();
      cancelRef.current = null;
      setTesting(false);
      return;
    }
    setTesting(true);
    cancelRef.current = testAlarm(TEST_SECONDS);
    setTimeout(() => {
      cancelRef.current = null;
      setTesting(false);
    }, TEST_SECONDS * 1000);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Alarm</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>CURRENT ALARM SOUND</Text>
          <Text style={styles.cardValue}>Device default alarm</Text>
          <Text style={styles.cardNote}>
            Plays on a high-priority channel that bypasses Do Not Disturb and the
            silent ringer, and loops until you acknowledge. Muting the phone does
            not stop it.
          </Text>
        </View>

        <PrimaryButton
          label={testing ? `Stop test (${TEST_SECONDS}s)…` : 'Play test alarm'}
          color={testing ? colors.error : colors.primary}
          onPress={runTest}
          accessibilityHint="Fires the real alarm briefly so you can check it on this device"
        />
        <Text style={styles.help}>
          Test it on your actual phone — an emulator can't reproduce the ringer /
          DND override. If you don't hear it loudly, check System health.
        </Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Audible reminder chime</Text>
            <Text style={styles.toggleHelp}>
              The first, gentle reminder also plays a chime. The escalation alarm
              is always loud regardless.
            </Text>
          </View>
          <Switch
            value={loudReminder}
            onValueChange={(v) => setSetting('loudReminder', v)}
            trackColor={{ true: colors.primary, false: colors.outlineVariant }}
            thumbColor={colors.surfaceContainerLowest}
          />
        </View>

        <View style={styles.soonCard}>
          <View style={styles.soonHeader}>
            <Text style={styles.soonTitle}>Custom alarm tones</Text>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>NEXT BUILD</Text>
            </View>
          </View>
          <Text style={styles.soonBody}>
            Choosing your own alarm tone needs the audio bundled into a native
            build. It ships with the on-device detection update — not available in
            the current JS build.
          </Text>
        </View>

        <GhostButton color={colors.onSurfaceVariant} label="Back" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd },
  title: { ...type.headlineLg, color: colors.primary },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.card,
    padding: spacing.stackMd,
    gap: spacing.base,
  },
  cardLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  cardValue: { ...type.titleMd, color: colors.onSurface },
  cardNote: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  help: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gutter,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.gutter,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...type.bodyLg, color: colors.onSurface },
  toggleHelp: { ...type.bodyMd, fontSize: 12, color: colors.onSurfaceVariant },
  soonCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.gutter,
    gap: spacing.base,
  },
  soonHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  soonTitle: { ...type.titleMd, color: colors.onSurfaceVariant, flex: 1 },
  soonBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 2,
  },
  soonBadgeText: { ...type.labelMd, fontSize: 10, color: colors.onSurfaceVariant, letterSpacing: 1 },
  soonBody: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
});
