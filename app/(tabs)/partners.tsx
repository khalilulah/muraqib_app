import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState } from "react";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";

// Updated interface
interface PartnerGoal {
  goalType: string;
  dailyAyahCount: number | null;
  dailyJuzCount: number | null;
  currentSurah: number | null;
  currentAyah: number | null;
  scheduledTime: string;
  validUntil: string;
}

interface Partner {
  id: string;
  username: string;
  email: string;
  gender: string;
  goal: PartnerGoal | null;
}

interface PartnerRequest {
  id: string;
  status: string;
  created_at: string;
  requester_username: string;
  requester_gender: string;
}

type TabType = "partner" | "requests" | "find";

export default function PartnersScreen() {
  const [activeTab, setActiveTab] = useState<TabType>("partner");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [requests, setRequests] = useState<PartnerRequest[]>([]);
  const [searchUsername, setSearchUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [partnerRes, requestsRes] = await Promise.all([
        api.get("/api/partners/me"),
        api.get("/api/partners/requests"),
      ]);
      setPartner(partnerRes.data.data);
      setRequests(requestsRes.data.data);
    } catch (error) {
      console.error("Partners fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function sendRequest() {
    if (!searchUsername.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }
    try {
      setActionLoading("send");
      await api.post("/api/partners/request", {
        username: searchUsername.trim(),
      });
      Alert.alert("Done", `Partner request sent to ${searchUsername}`);
      setSearchUsername("");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Something went wrong",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function respondToRequest(id: string, action: "accepted" | "rejected") {
    try {
      setActionLoading(id);
      await api.patch(`/api/partners/request/${id}`, { action });
      await fetchData();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Something went wrong",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelPartnership() {
    Alert.alert(
      "Cancel Partnership",
      "Are you sure? Your partner will be notified. Your streak will not be affected.",
      [
        { text: "Keep Partner", style: "cancel" },
        {
          text: "Cancel Partnership",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading("cancel");
              await api.delete("/api/partners/cancel");
              setPartner(null);
              Alert.alert("Done", "Partnership cancelled");
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message ?? "Something went wrong",
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accountability Partners</Text>
        <Text style={styles.headerSub}>
          Same-gender partners keep each other consistent
        </Text>
      </View>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <View style={styles.tabs}>
        {(["partner", "requests", "find"] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab === "partner"
                ? "My Partner"
                : tab === "requests"
                  ? `Requests${requests.length > 0 ? ` (${requests.length})` : ""}`
                  : "Find"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
        {/* ── My Partner Tab ───────────────────────────────────────────────── */}
        {activeTab === "partner" && (
          <>
            {partner ? (
              <View>
                {/* Profile card */}
                <View style={styles.partnerCard}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.partnerAvatarText}>
                      {partner.username[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{partner.username}</Text>
                    <Text style={styles.partnerEmail}>{partner.email}</Text>
                    <View style={styles.genderBadge}>
                      <Text style={styles.genderBadgeText}>
                        {partner.gender === "male" ? "Brother" : "Sister"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Partner's recitation plan */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {partner.username}'s Daily Plan
                  </Text>
                </View>

                {partner.goal ? (
                  <View style={styles.goalCard}>
                    {/* Goal type + daily target */}
                    <View style={styles.goalMain}>
                      <View style={styles.goalSurahBadge}>
                        <Text style={styles.goalBadgeIcon}>
                          {goalTypeIcon(partner.goal.goalType)}
                        </Text>
                      </View>
                      <View style={styles.goalDetails}>
                        <Text style={styles.goalSurahName}>
                          {formatGoalType(partner.goal.goalType)}
                        </Text>
                        <Text style={styles.goalAyahRange}>
                          {goalDescription(partner.goal)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.goalDivider} />

                    {/* Progress + time row */}
                    <View style={styles.goalMeta}>
                      <View style={styles.goalMetaItem}>
                        <Text style={styles.goalMetaLabel}>
                          Current Position
                        </Text>
                        <Text style={styles.goalMetaValue}>
                          {partner.goal.currentSurah
                            ? `Surah ${partner.goal.currentSurah}, Ayah ${partner.goal.currentAyah}`
                            : "Not started"}
                        </Text>
                      </View>
                      <View style={styles.goalMetaDot} />
                      <View style={styles.goalMetaItem}>
                        <Text style={styles.goalMetaLabel}>Daily Time</Text>
                        <Text style={styles.goalMetaValue}>
                          {formatTime(partner.goal.scheduledTime)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noGoalCard}>
                    <Text style={styles.noGoalIcon}>📖</Text>
                    <Text style={styles.noGoalText}>
                      {partner.username} hasn't set a recitation goal yet
                    </Text>
                  </View>
                )}

                {/* Cancel partnership */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={cancelPartnership}
                  disabled={actionLoading === "cancel"}
                >
                  {actionLoading === "cancel" ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <Text style={styles.cancelBtnText}>Cancel Partnership</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🤝</Text>
                <Text style={styles.emptyTitle}>No active partner</Text>
                <Text style={styles.emptySub}>
                  Find a partner to keep each other accountable with daily
                  recitation
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setActiveTab("find")}
                >
                  <Text style={styles.primaryBtnText}>Find a Partner</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── Requests Tab ─────────────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <>
            {requests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📬</Text>
                <Text style={styles.emptyTitle}>No pending requests</Text>
                <Text style={styles.emptySub}>
                  Partner requests sent to you will appear here
                </Text>
              </View>
            ) : (
              requests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestAvatar}>
                    <Text style={styles.requestAvatarText}>
                      {req.requester_username[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUsername}>
                      {req.requester_username}
                    </Text>
                    <Text style={styles.requestGender}>
                      {req.requester_gender === "male" ? "Brother" : "Sister"}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => respondToRequest(req.id, "rejected")}
                      disabled={actionLoading === req.id}
                    >
                      <Text style={styles.rejectBtnText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respondToRequest(req.id, "accepted")}
                      disabled={actionLoading === req.id}
                    >
                      {actionLoading === req.id ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ── Find Tab ─────────────────────────────────────────────────────── */}
        {activeTab === "find" && (
          <View style={styles.findCard}>
            <Text style={styles.findTitle}>Search by username</Text>
            <Text style={styles.findSub}>
              Partners must be the same gender. Share your username with a
              friend and search for theirs.
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Enter username"
                placeholderTextColor={COLORS.textLight}
                value={searchUsername}
                onChangeText={setSearchUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.searchBtn,
                  !searchUsername && styles.btnDisabled,
                ]}
                onPress={sendRequest}
                disabled={!searchUsername || actionLoading === "send"}
              >
                {actionLoading === "send" ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.searchBtnText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGoalType(type: string): string {
  const map: Record<string, string> = {
    fixed: "Fixed verses",
    ayah_count: "Daily count",
    random: "Random",
    juz: "By Juz",
    quran: "Full Quran",
  };
  return map[type] ?? type;
}

function formatTime(time: string): string {
  // Converts "06:30" → "6:30 AM", "18:00" → "6:00 PM"
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr ?? "0");
  const minute = minuteStr ?? "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${ampm}`;
}

function goalTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    fixed: "📌",
    ayah_count: "📖",
    random: "🎁",
    juz: "📚",
    quran: "🕋",
  };
  return icons[type] ?? "📖";
}

function goalDescription(goal: PartnerGoal): string {
  switch (goal.goalType) {
    case "ayah_count":
      return `${goal.dailyAyahCount ?? "?"} ayahs per day`;
    case "juz":
      return `${goal.dailyJuzCount ?? "?"} juz per day`;
    case "quran":
      return "Full Quran — 208 ayahs/day";
    case "random":
      return `${goal.dailyAyahCount ?? "?"} random ayahs/day`;
    case "fixed":
      return "Same verses every day";
    default:
      return "Custom goal";
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },

  // Tabs
  tabs: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: 20 },

  // ── Partner card ─────────────────────────────────────────────────────────
  partnerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    marginBottom: 20,
  },
  partnerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  partnerAvatarText: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  partnerInfo: { flex: 1 },
  partnerName: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  partnerEmail: { fontSize: 12, color: COLORS.textLight, marginBottom: 8 },
  genderBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  genderBadgeText: { color: COLORS.primary, fontWeight: "600", fontSize: 12 },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ── Goal card ─────────────────────────────────────────────────────────────
  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  goalMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  goalSurahBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  goalSurahNumber: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  goalDetails: { flex: 1 },
  goalSurahName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  goalBadgeIcon: {
    fontSize: 22,
  },
  goalAyahRange: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  goalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EBEBEB",
    marginBottom: 16,
  },
  goalMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  goalMetaItem: { flex: 1, alignItems: "center" },
  goalMetaLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  goalMetaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  goalMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
  },

  // ── No goal card ──────────────────────────────────────────────────────────
  noGoalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    elevation: 1,
  },
  noGoalIcon: { fontSize: 32, marginBottom: 10 },
  noGoalText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Cancel button ─────────────────────────────────────────────────────────
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  cancelBtnText: { color: COLORS.error, fontWeight: "700", fontSize: 14 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  // ── Request cards ─────────────────────────────────────────────────────────
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  requestAvatarText: { color: COLORS.white, fontSize: 18, fontWeight: "700" },
  requestInfo: { flex: 1 },
  requestUsername: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  requestGender: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  requestActions: { flexDirection: "row", gap: 8 },
  rejectBtn: {
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rejectBtnText: { color: COLORS.textLight, fontWeight: "600", fontSize: 13 },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  acceptBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 13 },

  // ── Find card ─────────────────────────────────────────────────────────────
  findCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  findTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  findSub: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 16,
  },
  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  searchBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});
