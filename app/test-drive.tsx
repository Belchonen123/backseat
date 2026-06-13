import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, GhostButton, PrimaryButton, StatusDot } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';

type Step = 'intro' | 'monitoring' | 'success';

/**
 * Test Drive — a 3-step local-state flow that lets a caregiver verify the
 * end-to-end alert before relying on it: intro -> active monitoring -> success.
 */
export default function TestDriveScreen(): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>('intro');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 'intro' ? (
          <IntroStep onStart={() => setStep('monitoring')} />
        ) : step === 'monitoring' ? (
          <MonitoringStep onTriggered={() => setStep('success')} />
        ) : (
          <SuccessStep onDone={() => router.replace('/(tabs)/monitor')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function IntroStep({ onStart }: { onStart: () => void }): React.JSX.Element {
  const steps = [
    {
      n: 1,
      title: 'Drive',
      body: 'Start monitoring as if beginning a normal trip.',
    },
    {
      n: 2,
      title: 'Park',
      body: 'Simulate ending the trip and stepping away from the car.',
    },
    {
      n: 3,
      title: 'Confirm',
      body: 'Respond to the test reminder to verify alerts reach you.',
    },
  ];
  return (
    <View style={styles.block}>
      <View style={styles.hero}>
        <Text style={styles.heroGlyph}>🚗</Text>
        <Text style={styles.title}>Test Drive</Text>
        <Text style={styles.subtitle}>
          Verify BackSeat works before you rely on it for a real trip.
        </Text>
      </View>

      <Card>
        <Text style={styles.intro}>
          This quick test confirms your reminder and alarm reach you when a trip
          ends. No contacts in your Safety Circle will be paged.
        </Text>
      </Card>

      {steps.map((s) => (
        <View key={s.n} style={styles.timelineRow}>
          <View style={styles.timelineDot}>
            <Text style={styles.timelineNum}>{s.n}</Text>
          </View>
          <View style={styles.timelineText}>
            <Text style={styles.rowTitle}>{s.title}</Text>
            <Text style={styles.rowBody}>{s.body}</Text>
          </View>
        </View>
      ))}

      <PrimaryButton label="Start Test" onPress={onStart} style={styles.cta} />
    </View>
  );
}

function MonitoringStep({
  onTriggered,
}: {
  onTriggered: () => void;
}): React.JSX.Element {
  return (
    <View style={[styles.block, styles.centered]}>
      <View style={styles.pulseCore}>
        <StatusDot color={colors.secondary} size={20} halo />
        <Text style={styles.activeLabel}>TEST ACTIVE</Text>
      </View>
      <Text style={[styles.title, { color: colors.secondary }]}>
        Monitoring Test Drive
      </Text>
      <Text style={styles.subtitle}>
        Pretend you have parked and walked away. Tap below to simulate the
        trip-end trigger.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label="Simulate Trip End"
          color={colors.secondary}
          textColor={colors.onSecondary}
          onPress={onTriggered}
        />
        <GhostButton label="Cancel Test" onPress={onTriggered} />
      </View>
    </View>
  );
}

function SuccessStep({ onDone }: { onDone: () => void }): React.JSX.Element {
  return (
    <View style={[styles.block, styles.centered]}>
      <View style={[styles.pulseCore, { backgroundColor: colors.primaryContainer }]}>
        <Text style={styles.successGlyph}>✓</Text>
      </View>
      <Text style={[styles.title, { color: colors.primary }]}>
        Test Passed
      </Text>
      <Text style={styles.subtitle}>
        The reminder reached your device. BackSeat is ready to remind you to
        check the back seat when a real trip ends.
      </Text>
      <Text style={styles.disclaimer}>
        Remember: BackSeat is a reminder aid. It does not detect children and is
        not a substitute for checking the back seat yourself.
      </Text>
      <PrimaryButton label="Finish" onPress={onDone} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, flexGrow: 1 },
  block: { gap: spacing.stackMd, flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.base, paddingTop: spacing.stackMd },
  heroGlyph: { fontSize: 56 },
  title: { ...type.headlineLgMobile, color: colors.primary, textAlign: 'center' },
  subtitle: {
    ...type.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  intro: { ...type.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
  timelineRow: { flexDirection: 'row', gap: spacing.gutter, alignItems: 'flex-start' },
  timelineDot: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNum: { ...type.titleMd, color: colors.onPrimary },
  timelineText: { flex: 1, paddingTop: spacing.base },
  rowTitle: { ...type.titleMd, color: colors.onSurface },
  rowBody: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
  pulseCore: {
    width: 176,
    height: 176,
    borderRadius: radius.full,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    marginBottom: spacing.stackMd,
  },
  activeLabel: {
    ...type.labelMd,
    color: colors.onSecondaryContainer,
    letterSpacing: 3,
  },
  successGlyph: { fontSize: 72, color: colors.onPrimaryContainer },
  actions: { width: '100%', gap: spacing.gutter, marginTop: spacing.stackMd },
  cta: { marginTop: spacing.base },
  disclaimer: {
    ...type.bodyMd,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.gutter,
  },
});
