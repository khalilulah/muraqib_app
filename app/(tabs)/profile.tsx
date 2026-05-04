import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import api from "../../src/services/api";
import { useAuthStore } from "../../src/store/auth.store";
import { COLORS } from "../../src/constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Streak {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  quranFoundation: { days: number; status: string } | null;
}

interface HistoryItem {
  id: string;
  verification_status: string;
  similarity_score: number;
  verified_by: string | null;
  created_at: string;
  goal_type: string;
}

interface ActivityDay {
  id: string;
  date: string;
  versesRead: number;
  secondsRead: number;
  ranges: string[];
  progress: number;
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingQF, setConnectingQF] = useState(false);
  const [activityDays, setActivityDays] = useState<ActivityDay[]>([]);
  const [qfConnected, setQfConnected] = useState(user?.qfConnected ?? false);

  useEffect(() => {
    fetchData();
  }, []);

  console.log("gender:", user?.gender, typeof user?.gender);

  async function fetchData() {
    try {
      const requests: Promise<any>[] = [
        api.get("/api/recitation/streak"),
        api.get("/api/recitation/history?limit=5"),
      ];

      // if (user?.qfConnected) {
      //   requests.push(api.get("/api/recitation/activity-calendar"));
      // }

      const results = await Promise.all(requests);
      setStreak(results[0].data.data);
      setHistory(results[1].data.data);
      if (user?.qfConnected && results[2]) {
        setActivityDays(results[2].data.data ?? []);
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const isQFConnected = user?.qfConnected === true;

  async function connectQF() {
    try {
      setConnectingQF(true);
      const res = await api.get("/api/auth/qf");
      const { url } = res.data.data;

      await WebBrowser.openBrowserAsync(url);

      const [userRes, streakRes, historyRes] = await Promise.all([
        api.get("/api/users/me"),
        api.get("/api/recitation/streak"),
        api.get("/api/recitation/history?limit=5"),
      ]);

      const updatedUser = userRes.data.data;
      const currentState = useAuthStore.getState();
      if (
        currentState.user &&
        currentState.accessToken &&
        currentState.refreshToken
      ) {
        await currentState.setAuth(
          {
            ...currentState.user,
            qfConnected: updatedUser.qf_connected,
          },
          currentState.accessToken,
          currentState.refreshToken,
        );
      }

      setStreak(streakRes.data.data);
      setHistory(historyRes.data.data);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Something went wrong",
      );
    } finally {
      setConnectingQF(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  function getStatusColor(status: string) {
    if (status === "ai_verified" || status === "partner_verified")
      return COLORS.success;
    if (status === "pending") return "#F59E0B";
    return COLORS.error;
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      ai_verified: "AI Verified",
      partner_verified: "Partner Verified",
      pending: "Pending Review",
      rejected: "Rejected",
    };
    return labels[status] ?? status;
  }

  function getStatusIcon(status: string) {
    if (status === "ai_verified") return "✓";
    if (status === "partner_verified") return "✓";
    if (status === "pending") return "⏳";
    return "✗";
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

  function generateCalendarDots(activityDays: ActivityDay[]) {
    const activeDates = new Set(activityDays.map((d) => d.date));
    const dots = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]!;
      const isActive = activeDates.has(date);
      const day = new Date(date).getDate();

      dots.push(
        <View key={date} style={styles.calendarDotWrapper}>
          <View
            style={[
              styles.calendarDot,
              isActive ? styles.calendarDotActive : styles.calendarDotInactive,
            ]}
          />
          {day === 1 || i === 29 ? (
            <Text style={styles.calendarDotLabel}>
              {new Date(date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          ) : null}
        </View>,
      );
    }
    return dots;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
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
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Avatar */}
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username[0]?.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.headerBadges}>
          <View style={styles.genderBadge}>
            <Text style={styles.genderText}>
              {user?.gender === "male" ? "👤 Brother" : "👤 Sister"}
            </Text>
          </View>
          {streak?.completedToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>✓ Done today</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Streak Stats ───────────────────────────────────────────────────── */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{streak?.currentStreak ?? 0}</Text>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statLabel}>Current{"\n"}Streak</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{streak?.longestStreak ?? 0}</Text>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statLabel}>Best{"\n"}Streak</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statEmoji}>📖</Text>
          <Text style={styles.statLabel}>Sessions{"\n"}Logged</Text>
        </View>
      </View>

      {/* ── QF Connection ──────────────────────────────────────────────────── */}

      {/* ── QF Activity Calendar ───────────────────────────────────────────── */}

      {/* ── Recent Sessions ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardIcon}>🕌</Text>
            <Text style={styles.emptyCardText}>
              No sessions yet — start your first recitation
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {history.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  index === history.length - 1 && styles.historyItemLast,
                ]}
              >
                {/* Left: date + goal type */}
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>
                    {formatDate(item.created_at)}
                  </Text>
                  <Text style={styles.historyGoalType}>
                    {getGoalTypeLabel(item.goal_type)}
                  </Text>
                </View>

                {/* Right: score + status */}
                <View style={styles.historyRight}>
                  <Text style={styles.historyScore}>
                    {Math.round((item.similarity_score ?? 0) * 100)}%
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          getStatusColor(item.verification_status) + "18",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusIcon,
                        { color: getStatusColor(item.verification_status) },
                      ]}
                    >
                      {getStatusIcon(item.verification_status)}
                    </Text>
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusColor(item.verification_status) },
                      ]}
                    >
                      {getStatusLabel(item.verification_status)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Settings ───────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push("/(modals)/goal-setup")}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconText}>🎯</Text>
              </View>
              <Text style={styles.settingLabel}>Update Monthly Goal</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Logout ─────────────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F0" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F4F0",
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "800",
    color: COLORS.white,
  },
  username: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  email: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 14,
  },
  headerBadges: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  genderBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  genderText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 13,
  },
  todayBadge: {
    backgroundColor: "#D1FAE5",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayBadgeText: {
    color: "#065F46",
    fontWeight: "700",
    fontSize: 12,
  },

  // ── Stats Card ────────────────────────────────────────────────────────────
  statsCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 8,
    flexDirection: "row",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 34,
  },
  statEmoji: { fontSize: 16 },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 15,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
    marginVertical: 4,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  // ── QF Connected ──────────────────────────────────────────────────────────
  qfConnectedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    gap: 14,
  },
  qfConnectedTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qfLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1A5C38",
    justifyContent: "center",
    alignItems: "center",
  },
  qfLogoText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
    fontStyle: "italic",
  },
  qfConnectedInfo: { flex: 1 },
  qfConnectedTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 3,
  },
  qfConnectedStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qfConnectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  qfConnectedStatusText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: "600",
  },
  qfStreakPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  qfStreakPillEmoji: { fontSize: 18 },
  qfStreakPillCount: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  qfStreakPillLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    flex: 1,
  },
  qfStatusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qfStatusActive: { backgroundColor: "#D1FAE5" },
  qfStatusBroken: { backgroundColor: "#FEE2E2" },
  qfStatusText: { fontSize: 11, fontWeight: "700" },
  qfStatusTextActive: { color: "#065F46" },
  qfStatusTextBroken: { color: "#991B1B" },

  // ── QF Connect ────────────────────────────────────────────────────────────
  qfConnectCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
  },
  qfConnectLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  qfLogoDim: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
  },
  qfLogoTextDim: {
    color: "#999",
    fontSize: 22,
    fontWeight: "800",
    fontStyle: "italic",
  },
  qfConnectTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  qfConnectSub: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  qfConnectBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 16,
    minWidth: 80,
    alignItems: "center",
  },
  qfConnectBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Calendar ──────────────────────────────────────────────────────────────
  calendarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 12,
  },
  calendarDotWrapper: { alignItems: "center" },
  calendarDot: { width: 10, height: 10, borderRadius: 5 },
  calendarDotActive: { backgroundColor: COLORS.primary },
  calendarDotInactive: { backgroundColor: "#E5E5E5" },
  calendarDotLabel: { fontSize: 7, color: COLORS.textLight, marginTop: 2 },
  calendarFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarLegend: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  calendarLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  calendarLegendText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  calendarEmpty: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  calendarEmptyIcon: { fontSize: 28 },
  calendarEmptyText: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
  },
  lastActivity: {
    backgroundColor: "#F8F8F6",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  lastActivityLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  lastActivityDate: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  lastActivityDetail: { fontSize: 12, color: COLORS.textLight },

  // ── History ───────────────────────────────────────────────────────────────
  historyList: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  historyItemLast: {
    borderBottomWidth: 0,
  },
  historyLeft: { gap: 3 },
  historyDate: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  historyGoalType: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  historyRight: { alignItems: "flex-end", gap: 4 },
  historyScore: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusIcon: { fontSize: 10, fontWeight: "800" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
    elevation: 1,
  },
  emptyCardIcon: { fontSize: 32 },
  emptyCardText: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  settingIconText: { fontSize: 18 },
  settingLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
  },
  settingArrow: {
    fontSize: 22,
    color: COLORS.textLight,
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logoutBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.error,
    backgroundColor: "#FFF5F5",
  },
  logoutText: {
    color: COLORS.error,
    fontWeight: "700",
    fontSize: 15,
  },
});
