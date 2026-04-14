import { Tabs } from "expo-router";
import { COLORS } from "../../src/constants";
import { Text } from "react-native";
import { useAuthStore } from "../../src/store/auth.store";
import api from "../../src/services/api";
import { useEffect, useState } from "react";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const [shouldLock, setShouldLock] = useState(false);

  // Check every minute
  useEffect(() => {
    checkLock();
    const interval = setInterval(checkLock, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function checkLock() {
    try {
      const [goalRes, streakRes] = await Promise.all([
        api.get("/api/recitation/goals/active"),
        api.get("/api/recitation/streak"),
      ]);
      const goal = goalRes.data.data;
      const streak = streakRes.data.data;

      if (!goal || streak?.completedToday) {
        setShouldLock(false);
        return;
      }

      const scheduledTime = goal.scheduled_time;
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(hours!, minutes!, 0, 0);
      const diffMins = (Date.now() - scheduled.getTime()) / 60000;
      setShouldLock(diffMins >= -30 && diffMins <= 120);
    } catch {
      setShouldLock(false);
    }
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: 65,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
      screenListeners={{
        tabPress: (e) => {
          if (shouldLock) {
            e.preventDefault(); // Block tab switching during recitation time
          }
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🕌" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="partners"
        options={{
          title: "Partners",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
