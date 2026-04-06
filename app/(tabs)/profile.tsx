import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import api from "../../src/services/api";
import { useAuthStore } from "../../src/store/auth.store";
import { COLORS } from "../../src/constants";

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

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingQF, setConnectingQF] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  console.log("gender:", user?.gender, typeof user?.gender);
  async function fetchData() {
    try {
      const [streakRes, historyRes] = await Promise.all([
        api.get("/api/recitation/streak"),
        api.get("/api/recitation/history?limit=5"),
      ]);
      setStreak(streakRes.data.data);
      setHistory(historyRes.data.data);
    } catch (error) {
      console.error("Profile fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function connectQF() {
    try {
      setConnectingQF(true);
      const res = await api.get("/api/auth/qf");
      const { url } = res.data.data;
      await WebBrowser.openBrowserAsync(url);
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username[0]?.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.genderBadge}>
          <Text style={styles.genderText}>
            {user?.gender === "male" ? "Brother" : "Sister"}
          </Text>
        </View>
      </View>

      {/* Streak Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{streak?.currentStreak ?? 0}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{streak?.longestStreak ?? 0}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
      </View>

      {/* QF Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quran Foundation</Text>
        {user?.qfConnected ? (
          <View style={styles.qfConnected}>
            <View style={styles.qfConnectedDot} />
            <Text style={styles.qfConnectedText}>Account connected</Text>
            {streak?.quranFoundation && (
              <Text style={styles.qfStreakText}>
                {streak.quranFoundation.days} day streak on QF
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.qfButton}
            onPress={connectQF}
            disabled={connectingQF}
          >
            {connectingQF ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.qfButtonText}>
                Connect Quran Foundation Account
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Recent History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>
              No sessions yet — start your first recitation
            </Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyDate}>
                  {formatDate(item.created_at)}
                </Text>
                <Text style={styles.historyGoalType}>{item.goal_type}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyScore}>
                  {Math.round((item.similarity_score ?? 0) * 100)}%
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        getStatusColor(item.verification_status) + "20",
                    },
                  ]}
                >
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
          ))
        )}
      </View>

      {/* Goal Setup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push("/(modals)/goal-setup")}
        >
          <Text style={styles.settingLabel}>Update Monthly Goal</Text>
          <Text style={styles.settingArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 28,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: COLORS.primary },
  username: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 4,
  },
  email: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 },
  genderBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  genderText: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statCard: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },
  statDivider: { width: 1, backgroundColor: "#E5E5E5" },
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  qfConnected: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    elevation: 1,
  },
  qfConnectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  qfConnectedText: { fontSize: 14, fontWeight: "600", color: COLORS.success },
  qfStreakText: {
    fontSize: 13,
    color: COLORS.textLight,
    width: "100%",
    marginTop: 4,
  },
  qfButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    elevation: 3,
  },
  qfButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  emptyHistory: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
  },
  historyItem: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  historyLeft: {},
  historyDate: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  historyGoalType: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  historyRight: { alignItems: "flex-end" },
  historyScore: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  settingRow: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
  },
  settingLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  settingArrow: { fontSize: 22, color: COLORS.textLight },
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.error,
  },
  logoutText: { color: COLORS.error, fontWeight: "700", fontSize: 15 },
});
