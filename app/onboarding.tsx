import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { Card, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import { useActiveHousehold, useHouseholdStore } from '@/state/household';

interface PermissionRationale {
  key: string;
  glyph: string;
  title: string;
  why: string;
}

const RATIONALES: PermissionRationale[] = [
  {
    key: 'background_location',
    glyph: '🛰️',
    title: 'Background Location',
    why: 'So BackSeat can notice when your trip ends, even with the app closed and your phone in your pocket.',
  },
  {
    key: 'bluetooth',
    glyph: '🔵',
    title: 'Bluetooth',
    why: 'To sense when you disconnect from your car — one of the signals we use to detect that a trip has ended.',
  },
  {
    key: 'notifications',
    glyph: '🔔',
    title: 'Notifications',
    why: 'To show the back-seat reminder and sound the alarm if you do not respond.',
  },
  {
    key: 'battery',
    glyph: '🔋',
    title: 'Battery Exemption',
    why: 'So your phone does not shut down our background monitoring to save power.',
  },
];

/**
 * Onboarding intro + plain-English, per-permission rationale, ending in a
 * working "Create my household" action that provisions the household + primary
 * guardian in Convex and routes into the monitor tab.
 */
export default function OnboardingScreen(): React.JSX.Element {
  const router = useRouter();
  const { userId } = useAuth();
  const createHousehold = useMutation(api.households.create);
  const addGuardian = useMutation(api.guardians.add);
  const setHouseholdId = useHouseholdStore((s) => s.setHouseholdId);
  // If the server (or local cache) already knows this user's household, don't
  // make them onboard again — recover straight into the app.
  const { householdId: existingHouseholdId } = useActiveHousehold();

  const [householdName, setHouseholdName] = useState('My Household');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !submitting &&
    guardianName.trim().length > 0 &&
    guardianPhone.trim().length >= 7;

  const handleCreate = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const name = householdName.trim().length > 0 ? householdName.trim() : 'My Household';
      const householdId = await createHousehold({ name });
      await addGuardian({
        householdId,
        userId: userId ?? `pending-${Date.now()}`,
        name: guardianName.trim(),
        phone: guardianPhone.trim(),
        role: 'primary',
        isEscalationContact: false,
      });
      setHouseholdId(householdId);
      router.replace('/(tabs)/monitor');
    } finally {
      setSubmitting(false);
    }
  };

  if (existingHouseholdId) {
    return <Redirect href="/(tabs)/monitor" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroGlyph}>🛡️</Text>
          <Text style={styles.title}>Welcome to BackSeat</Text>
          <Text style={styles.subtitle}>
            A background reminder to check the back seat when your trip ends.
          </Text>
        </View>

        <Card background={colors.secondaryFixed} outlined={false}>
          <Text style={styles.honest}>
            BackSeat does not detect children and cannot guarantee safety. It
            watches for trip-end signals and reminds you to check — that is all.
            Always check the back seat yourself.
          </Text>
        </Card>

        <Text style={styles.sectionLabel}>WHY WE ASK FOR PERMISSIONS</Text>
        <View style={styles.list}>
          {RATIONALES.map((r) => (
            <Card key={r.key}>
              <View style={styles.row}>
                <Text style={styles.rowGlyph}>{r.glyph}</Text>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowWhy}>{r.why}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <Text style={styles.sectionLabel}>SET UP YOUR HOUSEHOLD</Text>
        <View style={styles.list}>
          <Field label="Household name">
            <TextInput
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="My Household"
              placeholderTextColor={colors.outline}
              style={styles.input}
              autoCapitalize="words"
            />
          </Field>
          <Field label="Your name">
            <TextInput
              value={guardianName}
              onChangeText={setGuardianName}
              placeholder="Full name"
              placeholderTextColor={colors.outline}
              style={styles.input}
              autoCapitalize="words"
            />
          </Field>
          <Field label="Your phone">
            <TextInput
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              placeholder="(555) 000-0000"
              placeholderTextColor={colors.outline}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </Field>
        </View>

        <PrimaryButton
          label={submitting ? 'Creating…' : 'Create my household'}
          onPress={() => {
            void handleCreate();
          }}
          disabled={!canSubmit}
          style={styles.cta}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackMd },
  hero: { alignItems: 'center', gap: spacing.base, paddingTop: spacing.stackMd },
  heroGlyph: { fontSize: 56 },
  title: { ...type.headlineLg, color: colors.primary, textAlign: 'center' },
  subtitle: {
    ...type.bodyLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
  },
  honest: { ...type.bodyMd, color: colors.onSecondaryFixed, lineHeight: 22 },
  sectionLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  list: { gap: spacing.stackSm },
  row: { flexDirection: 'row', gap: spacing.gutter, alignItems: 'flex-start' },
  rowGlyph: { fontSize: 24, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  rowTitle: { ...type.titleMd, color: colors.onSurface },
  rowWhy: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    lineHeight: 22,
  },
  field: { gap: spacing.base },
  fieldLabel: { ...type.labelMd, color: colors.outline, letterSpacing: 1.5 },
  input: {
    ...type.bodyLg,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.button,
    paddingHorizontal: spacing.gutter,
    minHeight: spacing.touchTargetMin,
  },
  cta: { marginTop: spacing.base, marginBottom: spacing.stackMd },
});
