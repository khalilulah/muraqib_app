import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import api from "../services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    // This will fail silently in Expo Go SDK 53+ — works in dev build
    const tokenData = await Notifications.getExpoPushTokenAsync().catch(
      () => null,
    );
    if (!tokenData) return null;

    const token = tokenData.data;

    await api
      .patch("/api/users/fcm-token", { fcmToken: token })
      .catch(() => {});

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1B4332",
      });
    }

    return token;
  } catch {
    // Silently fail in Expo Go — will work in production build
    return null;
  }
}
