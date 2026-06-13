import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, View } from "react-native";
import { convex } from "@/convex/client";
import { tokenCache } from "@/auth/tokenCache";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9ff" }}>
      <ActivityIndicator color="#006767" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <ClerkLoaded>
            <Navigation />
          </ClerkLoaded>
        </SafeAreaProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function Navigation() {
  const { isLoaded } = useAuth();
  if (!isLoaded) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="reminder" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="alarm" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="protection-paused" />
      <Stack.Screen name="safety-circle" />
      <Stack.Screen name="contact-edit" options={{ presentation: "modal" }} />
      <Stack.Screen name="test-drive" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="pair-car" options={{ presentation: "modal" }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="about" />
      <Stack.Screen name="alarm-sound" />
      <Stack.Screen name="escalation-timing" />
      <Stack.Screen name="debug" />
    </Stack>
  );
}
