import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { GhostButton, PrimaryButton } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import type { Id } from '@/convex/_api';
import { useHouseholdStore } from '@/state/household';
import type { ContactRole } from './safety-circle';

/**
 * Add / edit a Safety Circle contact. Fields: name, phone, role, and whether
 * this contact is paged on escalation. Persists via Convex guardian mutations.
 */
export default function ContactEditScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === 'string' && id.length > 0;
  const guardianId = isEdit ? (id as Id<'guardians'>) : null;

  const { userId } = useAuth();
  const householdId = useHouseholdStore((s) => s.householdId);
  const addGuardian = useMutation(api.guardians.add);
  const updateGuardian = useMutation(api.guardians.update);
  const removeGuardian = useMutation(api.guardians.remove);

  // When editing, load the household's guardians and find this one to prefill.
  const guardians = useQuery(
    api.guardians.listByHousehold,
    householdId ? { householdId } : 'skip',
  );

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<ContactRole>('secondary');
  const [isEscalationContact, setIsEscalationContact] = useState(true);
  const [prefilled, setPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit || prefilled || !guardians) return;
    const existing = guardians.find((g) => g._id === guardianId);
    if (existing) {
      setName(existing.name);
      setPhone(existing.phone);
      setRole(existing.role);
      setIsEscalationContact(existing.isEscalationContact);
      setPrefilled(true);
    }
  }, [isEdit, prefilled, guardians, guardianId]);

  const canSave =
    !submitting && name.trim().length > 0 && phone.trim().length >= 7;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (isEdit && guardianId) {
        await updateGuardian({
          guardianId,
          name: name.trim(),
          phone: phone.trim(),
          role,
          isEscalationContact,
        });
      } else {
        if (!householdId) return;
        await addGuardian({
          householdId,
          userId: userId ?? `pending-${Date.now()}`,
          name: name.trim(),
          phone: phone.trim(),
          role,
          isEscalationContact,
        });
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!guardianId) return;
    await removeGuardian({ guardianId });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>
          {isEdit ? 'Edit Contact' : 'Add Contact'}
        </Text>

        {!isEdit && !householdId ? (
          <Text style={styles.notice}>
            Set up your household first before adding contacts.
          </Text>
        ) : null}

        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.outline}
            style={styles.input}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Phone">
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 000-0000"
            placeholderTextColor={colors.outline}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Field>

        <Field label="Role">
          <View style={styles.segment}>
            {(['primary', 'secondary'] as const).map((r) => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setRole(r)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {r === 'primary' ? 'Primary' : 'Secondary'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Escalation contact</Text>
            <Text style={styles.toggleHint}>
              Paged by SMS with your parked location if you do not respond.
            </Text>
          </View>
          <Switch
            value={isEscalationContact}
            onValueChange={setIsEscalationContact}
            trackColor={{ true: colors.primary, false: colors.outlineVariant }}
            thumbColor={colors.surfaceContainerLowest}
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={submitting ? 'Saving…' : 'Save Contact'}
            onPress={() => {
              void handleSave();
            }}
            disabled={!canSave || (!isEdit && !householdId)}
          />
          <GhostButton label="Cancel" onPress={() => router.back()} />
          {isEdit ? (
            <GhostButton
              label="Remove Contact"
              color={colors.error}
              onPress={() => {
                void handleRemove();
              }}
            />
          ) : null}
        </View>
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
  pageTitle: { ...type.headlineLgMobile, color: colors.primary },
  notice: { ...type.bodyMd, color: colors.error },
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
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.button,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: spacing.touchTargetMin - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { ...type.labelMd, color: colors.onSurfaceVariant },
  segmentTextActive: { color: colors.onPrimary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gutter,
  },
  toggleText: { flex: 1 },
  toggleLabel: { ...type.bodyLg, color: colors.onSurface },
  toggleHint: { ...type.bodyMd, fontSize: 13, color: colors.onSurfaceVariant },
  actions: { gap: spacing.gutter, marginTop: spacing.base },
});
