import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import { useActiveHousehold } from '@/state/household';

/**
 * Profile — view and edit the signed-in guardian's name + phone, read live from
 * Convex (proof the onboarding data persisted) and saved back via guardians.update.
 */
export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { guardian, household, loading } = useActiveHousehold();
  const updateGuardian = useMutation(api.guardians.update);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Seed the fields once the guardian loads.
  useEffect(() => {
    if (guardian) {
      setName(guardian.name);
      setPhone(guardian.phone);
    }
  }, [guardian]);

  const dirty =
    guardian != null &&
    (name.trim() !== guardian.name || phone.trim() !== guardian.phone);
  const canSave =
    !saving && dirty && name.trim().length > 0 && phone.trim().length >= 7;

  const handleSave = async (): Promise<void> => {
    if (!guardian || !canSave) return;
    setSaving(true);
    try {
      await updateGuardian({
        guardianId: guardian._id,
        name: name.trim(),
        phone: phone.trim(),
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile</Text>

        {loading && !guardian ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !guardian ? (
          <Text style={styles.body}>
            No guardian profile found for your account yet.
          </Text>
        ) : (
          <>
            {household ? (
              <Text style={styles.household}>{household.name}</Text>
            ) : null}

            <Field label="Your name">
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setSavedAt(null);
                }}
                placeholder="Full name"
                placeholderTextColor={colors.outline}
                style={styles.input}
                autoCapitalize="words"
              />
            </Field>
            <Field label="Your phone">
              <TextInput
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setSavedAt(null);
                }}
                placeholder="(555) 000-0000"
                placeholderTextColor={colors.outline}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </Field>
            <Text style={styles.roleNote}>
              Role: {guardian.role === 'primary' ? 'Primary guardian' : 'Secondary guardian'}
            </Text>

            <PrimaryButton
              label={saving ? 'Saving…' : savedAt ? 'Saved ✓' : 'Save changes'}
              onPress={() => void handleSave()}
              disabled={!canSave}
              style={styles.save}
            />
          </>
        )}

        <GhostButton
          color={colors.onSurfaceVariant}
          label="Back"
          onPress={() => router.back()}
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
  title: { ...type.headlineLg, color: colors.primary },
  household: { ...type.titleMd, color: colors.onSurface },
  center: { paddingVertical: spacing.stackLg, alignItems: 'center' },
  body: { ...type.bodyMd, color: colors.onSurfaceVariant },
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
  roleNote: { ...type.bodyMd, color: colors.onSurfaceVariant },
  save: { marginTop: spacing.base },
});
