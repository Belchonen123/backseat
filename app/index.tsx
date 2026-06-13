import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useActiveHousehold } from "@/state/household";
import { colors } from "@/theme/tokens";

/**
 * Entry gate: signed-out -> sign-in; signed-in without a household -> onboarding;
 * otherwise -> monitor. The household is recovered from the server / local cache
 * (useActiveHousehold), so a cold start lands a returning user back on monitor
 * rather than re-running onboarding.
 */
export default function Index() {
  const { isSignedIn } = useAuth();
  const { householdId, loading } = useActiveHousehold();

  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!householdId) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/monitor" />;
}
