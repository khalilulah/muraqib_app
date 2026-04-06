import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";

interface Session {
  id: string;
  similarity_score: number;
  transcription: string;
  audio_file_url: string;
  verification_status: string;
  created_at: string;
}

type AudioState = "idle" | "loading" | "playing";

export default function ReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    fetchSession();
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function fetchSession() {
    try {
      const res = await api.get(`/api/recitation/sessions/${sessionId}`);
      setSession(res.data.data);
    } catch (error: any) {
      Alert.alert("Error", "Could not load session", [
        { text: "Go Back", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function playAudio() {
    if (!session?.audio_file_url) {
      Alert.alert("Error", "No audio found");
      return;
    }

    if (audioState === "playing") {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setAudioState("idle");
      return;
    }

    try {
      setAudioState("loading");
      const { sound } = await Audio.Sound.createAsync(
        { uri: session.audio_file_url }, // direct Cloudinary URL
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setAudioState("playing");
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setAudioState("idle");
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error("Audio error:", error);
      setAudioState("idle");
      Alert.alert("Error", "Could not play audio");
    }
  }

  async function submitReview(action: "approved" | "rejected") {
    Alert.alert(
      action === "approved" ? "Approve Recitation" : "Reject Recitation",
      action === "approved"
        ? "Are you sure you want to approve this recitation? Their streak will be updated."
        : "Are you sure you want to reject this recitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "approved" ? "Approve" : "Reject",
          style: action === "approved" ? "default" : "destructive",
          onPress: async () => {
            try {
              setActionLoading(action);
              await api.patch(`/api/recitation/sessions/${sessionId}/review`, {
                action,
              });
              Alert.alert(
                "Done",
                action === "approved"
                  ? "Recitation approved — their streak has been updated"
                  : "Recitation rejected",
                [{ text: "OK", onPress: () => router.replace("/(tabs)/home") }],
              );
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
        <Text style={styles.loadingText}>Loading recitation...</Text>
      </View>
    );
  }

  if (!session) return null;

  const score = Math.round((session.similarity_score ?? 0) * 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Recitation</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Submitted</Text>
          <Text style={styles.infoValue}>
            {new Date(session.created_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* AI Score */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>AI Similarity Score</Text>
          <Text
            style={[
              styles.scoreValue,
              {
                color:
                  score >= 75
                    ? COLORS.success
                    : score >= 50
                      ? "#F59E0B"
                      : COLORS.error,
              },
            ]}
          >
            {score}%
          </Text>
          <Text style={styles.scoreHint}>
            Score was below the 75% threshold — your review is needed
          </Text>
        </View>

        {/* Audio Player */}
        <TouchableOpacity style={styles.audioCard} onPress={playAudio}>
          {audioState === "loading" ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View
              style={[
                styles.playIcon,
                audioState === "playing" && styles.playIconActive,
              ]}
            >
              <Text style={styles.playIconText}>
                {audioState === "playing" ? "◼" : "▶"}
              </Text>
            </View>
          )}
          <View style={styles.audioInfo}>
            <Text style={styles.audioTitle}>
              {audioState === "playing" ? "Playing..." : "Listen to recitation"}
            </Text>
            <Text style={styles.audioSub}>
              Tap to {audioState === "playing" ? "stop" : "play"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Arabic reminder */}
        <Text style={styles.arabic}>
          اتَّقِ ٱللَّهَ وَكُن مَّعَ ٱلصَّادِقِينَ
        </Text>
        <Text style={styles.arabicSub}>
          Fear Allah and be with the truthful — 9:119
        </Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => submitReview("rejected")}
            disabled={!!actionLoading}
          >
            {actionLoading === "rejected" ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Text style={styles.rejectBtnText}>Reject</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.approveBtn}
            onPress={() => submitReview("approved")}
            disabled={!!actionLoading}
          >
            {actionLoading === "approved" ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.approveBtnText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    gap: 16,
  },
  loadingText: { fontSize: 15, color: COLORS.textLight },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
  },
  back: { color: COLORS.white, fontSize: 15, fontWeight: "600" },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: "700" },
  content: { flex: 1, padding: 20 },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: { fontSize: 14, color: COLORS.textLight, fontWeight: "600" },
  infoValue: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  scoreCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    alignItems: "center",
  },
  scoreLabel: { fontSize: 13, color: COLORS.textLight, marginBottom: 6 },
  scoreValue: { fontSize: 40, fontWeight: "800", marginBottom: 6 },
  scoreHint: { fontSize: 12, color: COLORS.textLight, textAlign: "center" },
  audioCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
    elevation: 2,
  },
  playIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  playIconActive: { backgroundColor: COLORS.primary },
  playIconText: { fontSize: 12, color: COLORS.primary },
  audioInfo: {},
  audioTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  audioSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  arabic: {
    fontFamily: "Amiri_400Regular",
    fontSize: 20,
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 4,
  },
  arabicSub: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 28,
    fontStyle: "italic",
  },
  actions: { flexDirection: "row", gap: 12 },
  rejectBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  rejectBtnText: { color: COLORS.error, fontWeight: "700", fontSize: 15 },
  approveBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: COLORS.primary,
    elevation: 3,
  },
  approveBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});
