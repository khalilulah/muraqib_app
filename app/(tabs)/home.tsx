import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "../../src/store/auth.store";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";

interface Streak {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  quranFoundation: { days: number; status: string } | null;
}

interface Goal {
  id: string;
  goal_type: string;
  scheduled_time: string;
  daily_ayah_count: number;
  current_surah: number;
  current_ayah: number;
}

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  async function fetchData() {
    try {
      const [streakRes, goalRes, reviewsRes] = await Promise.all([
        api.get("/api/recitation/streak"),
        api.get("/api/recitation/goals/active"),
        api.get("/api/recitation/sessions/pending-reviews"),
      ]);
      setStreak(streakRes.data.data);
      setGoal(goalRes.data.data);
      setPendingReviews(reviewsRes.data.data ?? []);
    } catch (error) {
      console.error("Home fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function getGoalTypeLabel(type: string) {
    const labels: Record<string, string> = {
      ayah_count: "Daily Ayahs",
      juz: "Juz Goal",
      quran: "Full Quran",
      random: "Random Verses",
      fixed: "Fixed Verses",
    };
    return labels[type] ?? type;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchData();
          }}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.username}>{user?.username}</Text>
        </View>
        <Text style={styles.headerArabic}>بِسْمِ ٱللَّهِ</Text>
      </View>

      {/* Side-by-side Streak Cards */}
      <View style={styles.streakSection}>
        {/* Muraqib Streak */}
        <View style={styles.streakCard}>
          <View style={styles.streakCardHeader}>
            <Text style={styles.streakCardTitle}>Muraqib</Text>
            {streak?.completedToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>Done</Text>
              </View>
            )}
          </View>
          <View style={styles.streakNumbers}>
            <View style={styles.streakMain}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>
                {streak?.currentStreak ?? 0}
              </Text>
              <Text style={styles.streakUnit}>days</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakBest}>
              <Text style={styles.streakBestLabel}>Best</Text>
              <Text style={styles.streakBestCount}>
                {streak?.longestStreak ?? 0}d
              </Text>
            </View>
          </View>
        </View>

        {/* QF Streak */}
        {/* QF Streak */}
        <View
          style={[
            styles.streakCard,
            styles.qfStreakCard,
            !user?.qfConnected && styles.qfStreakCardDisconnected,
          ]}
        >
          <View style={styles.streakCardHeader}>
            <Text style={styles.streakCardTitle}>Quran.com</Text>
            <View
              style={[
                styles.syncBadge,
                user?.qfConnected
                  ? styles.syncBadgeActive
                  : styles.syncBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.syncBadgeText,
                  user?.qfConnected
                    ? styles.syncBadgeTextActive
                    : styles.syncBadgeTextInactive,
                ]}
              >
                {user?.qfConnected ? "Synced" : "Not linked"}
              </Text>
            </View>
          </View>

          {user?.qfConnected ? (
            <View style={styles.streakNumbers}>
              <View style={styles.streakMain}>
                <Text style={styles.streakFire}>📖</Text>
                <Text style={styles.streakCount}>
                  {streak?.quranFoundation?.days ?? "—"}
                </Text>
                <Text style={styles.streakUnit}>days</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakBest}>
                <Text style={styles.streakBestLabel}>Status</Text>
                <Text
                  style={[styles.streakBestCount, styles.streakBestCountSmall]}
                >
                  {streak?.quranFoundation?.status === "ACTIVE"
                    ? "Active"
                    : "Syncing"}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectQFBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Text style={styles.connectQFBtnText}>Connect Account</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Partner Review Needed */}
      {pendingReviews.length > 0 && (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>
            Partner Review Needed ({pendingReviews.length})
          </Text>
          {pendingReviews.map((review: any) => (
            <TouchableOpacity
              key={review.id}
              style={styles.reviewItem}
              onPress={() =>
                router.push({
                  pathname: "/(modals)/review",
                  params: { sessionId: review.id },
                })
              }
            >
              <Text style={styles.reviewItemText}>
                {review.partner_username} submitted a recitation
              </Text>
              <Text style={styles.reviewItemArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Today's Goal */}
      <Text style={styles.sectionTitle}>Today's Goal</Text>
      {goal ? (
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalType}>
              {getGoalTypeLabel(goal.goal_type)}
            </Text>
            <Text style={styles.goalTime}>{goal.scheduled_time}</Text>
          </View>
          <Text style={styles.goalDetail}>
            {goal.daily_ayah_count} ayahs · Surah {goal.current_surah}, Ayah{" "}
            {goal.current_ayah}
          </Text>

          <TouchableOpacity
            style={[
              styles.reciteButton,
              streak?.completedToday && styles.reciteButtonDone,
            ]}
            onPress={() =>
              router.push({
                pathname: "/(modals)/recitation",
                params: { goalId: goal.id },
              })
            }
            disabled={streak?.completedToday}
          >
            <Text style={styles.reciteButtonText}>
              {streak?.completedToday
                ? "Completed for Today"
                : "Start Recitation"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noGoalCard}>
          <Text style={styles.noGoalTitle}>No goal set yet</Text>
          <Text style={styles.noGoalSub}>
            Set your monthly recitation goal to get started
          </Text>
          <TouchableOpacity
            style={styles.setGoalButton}
            onPress={() => router.push("/(modals)/goal-setup")}
          >
            <Text style={styles.setGoalButtonText}>Set Goal</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  greeting: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },
  username: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.white,
  },
  headerArabic: {
    fontSize: 22,
    color: COLORS.secondary,
    fontFamily: "Amiri_400Regular",
  },

  // Streak Section
  streakSection: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  streakCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  qfStreakCard: {
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
  },
  qfStreakCardDisconnected: {
    borderColor: "#E5E5E5",
  },
  streakCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  streakCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  todayBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.success,
  },
  syncBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  syncBadgeActive: {
    backgroundColor: "#FEF3C7",
  },
  syncBadgeInactive: {
    backgroundColor: "#F3F4F6",
  },
  syncBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  syncBadgeTextActive: {
    color: "#D97706",
  },
  syncBadgeTextInactive: {
    color: COLORS.textLight,
  },
  streakNumbers: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  streakFire: {
    fontSize: 18,
  },
  streakCount: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  streakUnit: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
  },
  streakDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E5E5",
    marginHorizontal: 8,
  },
  streakBest: {
    alignItems: "center",
  },
  streakBestLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: "600",
    marginBottom: 2,
  },
  streakBestCount: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primary,
  },
  streakBestCountSmall: {
    fontSize: 11,
  },
  connectQFBtn: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.secondary,
    marginTop: 2,
  },
  connectQFBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Review Card
  reviewCard: {
    backgroundColor: "#FEF3C7",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
  },
  reviewItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5E5",
  },
  reviewItemText: { fontSize: 13, color: COLORS.text, flex: 1 },
  reviewItemArrow: { fontSize: 20, color: COLORS.textLight },

  // Goal Card
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  goalCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalType: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  goalTime: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  goalDetail: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  reciteButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    elevation: 3,
  },
  reciteButtonDone: {
    backgroundColor: COLORS.success,
  },
  reciteButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  // No Goal Card
  noGoalCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    elevation: 2,
  },
  noGoalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  noGoalSub: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 20,
  },
  setGoalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  setGoalButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
