import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { Card } from '@/components';
import { colors, radius, spacing, type } from '@/theme/tokens';
import { api } from '@/convex/_api';
import { useHouseholdStore } from '@/state/household';

export type ContactRole = 'primary' | 'secondary';

export interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  role: ContactRole;
  isEscalationContact: boolean;
  initials: string;
}

const MAX_SECONDARY = 5;

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function SafetyCircleScreen(): React.JSX.Element {
  const router = useRouter();
  const householdId = useHouseholdStore((s) => s.householdId);
  // Live Convex query — skipped until a household is selected.
  const guardians = useQuery(
    api.guardians.listByHousehold,
    householdId ? { householdId } : 'skip',
  );

  const contacts: Contact[] = (guardians ?? []).map((g) => ({
    id: g._id,
    name: g.name,
    relation: g.role === 'primary' ? 'You' : 'Guardian',
    phone: g.phone,
    role: g.role,
    isEscalationContact: g.isEscalationContact,
    initials: initialsOf(g.name),
  }));

  const primary = contacts.find((c) => c.role === 'primary');
  const secondary = contacts.filter((c) => c.role === 'secondary');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Safety Circle</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoGlyph}>ℹ️</Text>
          <Text style={styles.infoText}>
            If you do not respond to an alarm within your escalation window, your
            Safety Circle receives your parked location by SMS. This is a
            best-effort notification, not a guaranteed emergency response.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>PRIMARY GUARDIAN</Text>
        {primary ? (
          <Card>
            <ContactBody contact={primary} />
          </Card>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>SECONDARY GUARDIANS</Text>
          <Text style={styles.slots}>
            {secondary.length} / {MAX_SECONDARY} slots
          </Text>
        </View>

        <View style={styles.list}>
          {secondary.map((c) => (
            <Card key={c.id} onPress={() => router.push(`/contact-edit?id=${c.id}`)}>
              <ContactBody contact={c} />
            </Card>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/contact-edit')}
            style={({ pressed }) => [styles.addBtn, pressed && styles.addPressed]}
          >
            <Text style={styles.addGlyph}>＋</Text>
            <Text style={styles.addLabel}>Invite Secondary Guardian</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactBody({ contact }: { contact: Contact }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{contact.initials}</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name}>{contact.name}</Text>
          <Text style={styles.meta}>
            {contact.relation} · {contact.phone}
          </Text>
        </View>
      </View>
      {contact.isEscalationContact ? (
        <View style={styles.escPill}>
          <Text style={styles.escText}>Paging</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.marginMobile, gap: spacing.stackSm },
  pageTitle: { ...type.headlineLgMobile, color: colors.primary },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.gutter,
    backgroundColor: colors.secondaryFixed,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.gutter,
    marginVertical: spacing.base,
  },
  infoGlyph: { fontSize: 20 },
  infoText: {
    ...type.bodyMd,
    color: colors.onSecondaryFixed,
    flex: 1,
    lineHeight: 22,
  },
  sectionLabel: {
    ...type.labelMd,
    color: colors.outline,
    letterSpacing: 1.5,
    marginTop: spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.base,
  },
  slots: { ...type.labelMd, color: colors.outline, fontWeight: '400' },
  list: { gap: spacing.stackSm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.gutter, flexShrink: 1 },
  rowText: { flexShrink: 1 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.titleMd, color: colors.onPrimaryContainer },
  name: { ...type.titleMd, color: colors.onSurface },
  meta: { ...type.bodyMd, color: colors.outline },
  escPill: {
    paddingHorizontal: spacing.stackSm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  escText: { ...type.labelMd, color: colors.onSurfaceVariant, fontSize: 12 },
  addBtn: {
    height: 96,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  addPressed: { backgroundColor: colors.surfaceContainerLow },
  addGlyph: { fontSize: 28, color: colors.primary },
  addLabel: { ...type.labelMd, color: colors.primary },
});
