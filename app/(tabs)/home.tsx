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
      const [streakRes, goalRes] = await Promise.all([
        api.get("/api/recitation/streak"),
        api.get("/api/recitation/goals/active"),
      ]);
      const reviewsRes = await api.get(
        "/api/recitation/sessions/pending-reviews",
      );
      setPendingReviews(reviewsRes.data.data ?? []);
      setStreak(streakRes.data.data);
      setGoal(goalRes.data.data);
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
          <Text style={styles.username}>{user?.username} 👋</Text>
        </View>
        <Text style={styles.headerArabic}>بِسْمِ ٱللَّهِ</Text>
      </View>

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakFire}>🔥</Text>
          <View>
            <Text style={styles.streakCount}>
              {streak?.currentStreak ?? 0} days
            </Text>
            <Text style={styles.streakLabel}>Current Streak</Text>
          </View>
        </View>
        <View style={styles.streakRight}>
          <Text style={styles.longestLabel}>Best</Text>
          <Text style={styles.longestCount}>{streak?.longestStreak ?? 0}d</Text>
        </View>
      </View>

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

      {/* Completed today badge */}
      {streak?.completedToday && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>
            ✅ You completed today's recitation!
          </Text>
        </View>
      )}

      {/* QF Streak */}
      {streak?.quranFoundation && (
        <View style={styles.qfCard}>
          <Text style={styles.qfTitle}>🕌 Quran Foundation Streak</Text>
          <Text style={styles.qfDays}>
            {streak.quranFoundation.days} days — {streak.quranFoundation.status}
          </Text>
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
            <Text style={styles.goalTime}>⏰ {goal.scheduled_time}</Text>
          </View>
          <Text style={styles.goalDetail}>
            {goal.daily_ayah_count} ayahs · Surah {goal.current_surah}, Ayah{" "}
            {goal.current_ayah}
          </Text>

          {/* Recite Button */}
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
                ? "✅ Done for Today"
                : "🎙️ Start Recitation"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // No goal set yet
        <View style={styles.noGoalCard}>
          <Text style={styles.noGoalEmoji}>📖</Text>
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

      <View style={{ height: 30 }} />
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
  streakCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
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
  streakLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  streakFire: {
    fontSize: 36,
  },
  streakCount: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  streakLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  streakRight: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  longestLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
  },
  longestCount: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary,
  },
  completedBadge: {
    backgroundColor: "#D1FAE5",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  completedText: {
    color: COLORS.success,
    fontWeight: "600",
    fontSize: 14,
  },
  qfCard: {
    backgroundColor: "#FFF8E7",
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  qfTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  qfDays: {
    fontSize: 13,
    color: COLORS.textLight,
  },
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
  noGoalCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    elevation: 2,
  },
  noGoalEmoji: {
    fontSize: 44,
    marginBottom: 12,
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
