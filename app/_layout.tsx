import { useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../src/store/auth.store";

import {
  useFonts,
  Amiri_400Regular,
  Amiri_700Bold,
} from "@expo-google-fonts/amiri";

import { ScheherazadeNew_400Regular } from "@expo-google-fonts/scheherazade-new";

import * as SplashScreen from "expo-splash-screen";
import { registerForPushNotifications } from "../src/utils/notifications";
import { ActivityIndicator, View } from "react-native";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage);

  const responseListener = useRef<Notifications.Subscription | null>(null);

  const hasNavigated = useRef<boolean>(false);

  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    ScheherazadeNew_400Regular,
  });

  useEffect(() => {
    async function init() {
      await loadFromStorage();
      await registerForPushNotifications();

      // Handle notification when app was CLOSED
      const lastResponse =
        await Notifications.getLastNotificationResponseAsync();

      if (lastResponse) {
        handleNavigation(lastResponse);

        // NEW — clear it so it doesn't fire again
        await Notifications.clearLastNotificationResponseAsync();
      }
    }

    init();

    // Handle notification when app is OPEN / BACKGROUND
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        async (response) => {
          handleNavigation(response);

          // Also clear after handling
          await Notifications.clearLastNotificationResponseAsync();
        },
      );

    return () => {
      responseListener.current?.remove();
    };
  }, [loadFromStorage]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // CENTRALIZED navigation handler
  function handleNavigation(response: any) {
    // Prevent duplicate navigation
    if (hasNavigated.current) return;

    const data = response.notification.request.content.data as any;

    if (data?.type === "PARTNER_REVIEW" && data?.sessionId) {
      hasNavigated.current = true;

      router.push({
        pathname: "/(modals)/review",
        params: {
          sessionId: data.sessionId,
        },
      });

      return;
    }

    if (data?.type === "REVIEW_RESULT") {
      hasNavigated.current = true;

      router.push("/(tabs)/home");
    }
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F9F5F0",
        }}
      >
        <ActivityIndicator size="large" color="#1B4332" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
