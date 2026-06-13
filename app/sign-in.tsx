import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSignIn, useSignUp, useAuth } from "@clerk/clerk-expo";
import { PrimaryButton, GhostButton } from "@/components";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Mode = "signIn" | "signUp";
type Step = "credentials" | "code";

/**
 * Email + password auth (Clerk default for *.accounts.dev dev instances).
 * Sign in: email + password -> session. Sign up: email + password -> 6-digit
 * email code -> session. The active session is what ConvexProviderWithClerk
 * uses to authenticate every Convex call.
 */
export default function SignInScreen(): React.JSX.Element {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, setActive: setActiveSignIn } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();

  const [mode, setMode] = useState<Mode>("signIn");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSignedIn) {
    router.replace("/");
  }

  async function submitCredentials() {
    if (!signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signIn") {
        const res = await signIn.create({ identifier: email, password });
        if (res.createdSessionId && setActiveSignIn) {
          await setActiveSignIn({ session: res.createdSessionId });
          router.replace("/");
        } else {
          setError(`Sign-in incomplete (${res.status ?? "unknown"})`);
        }
      } else {
        const res = await signUp.create({ emailAddress: email, password });
        if (res.status === "complete" && res.createdSessionId && setActiveSignUp) {
          // Some instances (and +clerk_test emails) auto-verify — go straight in.
          await setActiveSignUp({ session: res.createdSessionId });
          router.replace("/");
        } else {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setStep("code");
        }
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!signUp || !setActiveSignUp) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      if (res.createdSessionId) {
        await setActiveSignUp({ session: res.createdSessionId });
        router.replace("/");
      } else {
        setError(`Verification incomplete (${res.status ?? "unknown"})`);
      }
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const passwordTooShort = password.length > 0 && password.length < 8;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.brand}>BackSeat</Text>
          <Text style={styles.tagline}>
            A reminder to check the back seat. Sign in to sync your Safety Circle.
          </Text>
        </View>

        {step === "credentials" ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.outline}
                secureTextEntry
                autoCapitalize="none"
                textContentType={mode === "signIn" ? "password" : "newPassword"}
              />
              {passwordTooShort ? (
                <Text style={styles.hint}>Use at least 8 characters.</Text>
              ) : null}
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                label={mode === "signIn" ? "Sign in" : "Create account"}
                onPress={submitCredentials}
                disabled={busy || !email || password.length < 8}
              />
              <GhostButton
                color={colors.onSurfaceVariant}
                label={
                  mode === "signIn"
                    ? "Need an account? Sign up"
                    : "Have an account? Sign in"
                }
                onPress={() => {
                  setMode(mode === "signIn" ? "signUp" : "signIn");
                  setError(null);
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>6-digit code sent to {email}</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
              />
            </View>
            <View style={styles.actions}>
              <PrimaryButton
                label="Verify"
                onPress={verifyCode}
                disabled={busy || code.length < 6}
              />
              <GhostButton
                color={colors.onSurfaceVariant}
                label="Back"
                onPress={() => setStep("credentials")}
              />
            </View>
          </View>
        )}

        {busy ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object" && "errors" in e) {
    const errs = (e as { errors?: Array<{ message?: string }> }).errors;
    if (errs && errs[0]?.message) return errs[0].message;
  }
  return "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceContainerLowest },
  body: {
    flex: 1,
    paddingHorizontal: spacing.marginDesktop,
    paddingTop: spacing.stackLg * 1.5,
    gap: spacing.stackLg,
  },
  header: { gap: spacing.gutter },
  brand: { ...type.displayLg, color: colors.primary },
  tagline: {
    ...type.bodyMd,
    fontSize: 15,
    color: colors.onSurfaceVariant,
    maxWidth: 300,
  },
  form: { gap: spacing.stackMd },
  field: { gap: spacing.base },
  label: { ...type.labelMd, color: colors.onSurfaceVariant, marginLeft: spacing.base / 2 },
  input: {
    ...type.bodyLg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.button,
    paddingHorizontal: spacing.gutter,
    paddingVertical: 14,
    backgroundColor: colors.surfaceContainerLowest,
  },
  hint: { ...type.labelMd, fontWeight: "400", color: colors.onSurfaceVariant, marginLeft: spacing.base / 2 },
  actions: { gap: spacing.stackSm, marginTop: spacing.base },
  spinner: { marginTop: spacing.gutter },
  error: { ...type.bodyMd, color: colors.error, marginTop: spacing.gutter },
});
