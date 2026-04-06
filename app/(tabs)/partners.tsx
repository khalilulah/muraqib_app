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

interface Partner {
  id: string;
  username: string;
  email: string;
  gender: string;
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accountability Partners</Text>
        <Text style={styles.headerSub}>
          Same-gender partners keep each other consistent
        </Text>
      </View>

      {/* Tabs */}
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
        {/* My Partner Tab */}
        {activeTab === "partner" && (
          <>
            {partner ? (
              <View style={styles.partnerCard}>
                <View style={styles.partnerAvatar}>
                  <Text style={styles.partnerAvatarText}>
                    {partner.username[0]?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.partnerName}>{partner.username}</Text>
                <Text style={styles.partnerEmail}>{partner.email}</Text>
                <View style={styles.partnerGenderBadge}>
                  <Text style={styles.partnerGenderText}>
                    {partner.gender === "male" ? "Brother" : "Sister"}
                  </Text>
                </View>
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
                <Text style={styles.emptyTitle}>No active partner</Text>
                <Text style={styles.emptySub}>
                  Find a partner to keep each other accountable with daily
                  recitation
                </Text>
                <TouchableOpacity
                  style={styles.findBtn}
                  onPress={() => setActiveTab("find")}
                >
                  <Text style={styles.findBtnText}>Find a Partner</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <>
            {requests.length === 0 ? (
              <View style={styles.emptyCard}>
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

        {/* Find Tab */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerTitle: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },
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
  partnerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  partnerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  partnerAvatarText: { color: COLORS.white, fontSize: 28, fontWeight: "700" },
  partnerName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  partnerEmail: { fontSize: 13, color: COLORS.textLight, marginBottom: 12 },
  partnerGenderBadge: {
    backgroundColor: "#E8F5E9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 20,
  },
  partnerGenderText: { color: COLORS.primary, fontWeight: "600", fontSize: 13 },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelBtnText: { color: COLORS.error, fontWeight: "700", fontSize: 14 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    elevation: 2,
  },
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
  findBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  findBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
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
  findCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
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
