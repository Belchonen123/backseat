import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { GhostButton, Card } from '@/components';
import { colors, spacing, type } from '@/theme/tokens';

/** Static About & disclaimers screen — the honest description of what BackSeat is and is not. */
export default function AboutScreen(): React.JSX.Element {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>About BackSeat</Text>

        <Card background={colors.secondaryFixed} outlined={false}>
          <Text style={styles.callout}>
            BackSeat does not detect children and cannot guarantee safety. It
            watches for trip-end signals and reminds you to check the back seat —
            that is all. Always check the back seat yourself, every time.
          </Text>
        </Card>

        <Section title="What it does">
          BackSeat watches for the end of a drive (using your phone's location and
          motion, and — when available — your car's Bluetooth disconnecting). When
          it believes a trip just ended, it reminds you to check the back seat. If
          you don't respond, it escalates to a loud alarm and can page your Safety
          Circle.
        </Section>

        <Section title="What it is not">
          It is not a child-presence detector, a car-seat sensor, or a medical or
          life-safety device. It cannot tell whether anyone is actually in the
          car, and it cannot help if a child climbs into a parked car on their own.
          A muted phone, a dead battery, or a denied permission can stop it
          working — that is why BackSeat shows "Protection Paused" loudly when it
          cannot do its job.
        </Section>

        <Section title="Your responsibility">
          BackSeat is a reminder aid, not a substitute for your attention. Never
          rely on it as the only thing standing between a child and a hot car.
          Check the back seat yourself, every single time you park.
        </Section>

        <Section title="Privacy">
          Your household, contacts, and trip history sync to your private backend.
          Parked-location links are shared with your Safety Circle only during an
          active escalation, and only if you've left that option on.
        </Section>

        <Text style={styles.version}>Version {version}</Text>

        <GhostButton
          color={colors.onSurfaceVariant}
          label="Back"
          onPress={() => router.back()}
          style={styles.back}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd, paddingBottom: spacing.stackLg },
  title: { ...type.headlineLg, color: colors.primary },
  callout: { ...type.bodyMd, color: colors.onSecondaryFixed, lineHeight: 22 },
  section: { gap: spacing.base },
  sectionTitle: { ...type.titleMd, color: colors.onSurface },
  body: { ...type.bodyMd, color: colors.onSurfaceVariant, lineHeight: 22 },
  version: { ...type.labelMd, fontWeight: '400', color: colors.outline, textAlign: 'center' },
  back: { marginTop: spacing.base },
});
