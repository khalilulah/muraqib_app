import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS } from "../../src/constants";

export default function ResultScreen() {
  const { score, status, needsReview } = useLocalSearchParams<{
    sessionId: string;
    score: string;
    status: string;
    needsReview: string;
  }>();

  const scoreNum = parseInt(score ?? "0");
  const isApproved = status === "ai_verified" || status === "partner_verified";
  const isPending = status === "pending" && needsReview === "true";
  const isRejected = status === "rejected";

  function getScoreColor() {
    if (scoreNum >= 75) return COLORS.success;
    if (scoreNum >= 50) return "#F59E0B";
    return COLORS.error;
  }

  function getScoreLabel() {
    if (scoreNum >= 75) return "Excellent";
    if (scoreNum >= 50) return "Good effort";
    return "Keep practicing";
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recitation Result</Text>
      </View>

      <View style={styles.content}>
        {/* Score Circle */}
        <View style={[styles.scoreCircle, { borderColor: getScoreColor() }]}>
          <Text style={[styles.scoreNumber, { color: getScoreColor() }]}>
            {scoreNum}%
          </Text>
          <Text style={styles.scoreLabel}>{getScoreLabel()}</Text>
        </View>

        {/* Status Card */}
        {isApproved && (
          <View style={[styles.statusCard, styles.statusApproved]}>
            <Text style={styles.statusTitle}>Recitation Approved</Text>
            <Text style={styles.statusSub}>
              {status === "ai_verified"
                ? "Verified automatically — your streak has been updated"
                : "Approved by your partner — your streak has been updated"}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={[styles.statusCard, styles.statusPending]}>
            <Text style={styles.statusTitle}>Sent for Partner Review</Text>
            <Text style={styles.statusSub}>
              Your partner has been notified and will review your recitation
              shortly
            </Text>
          </View>
        )}

        {isRejected && (
          <View style={[styles.statusCard, styles.statusRejected]}>
            <Text style={styles.statusTitle}>Not Approved</Text>
            <Text style={styles.statusSub}>
              Your similarity score was too low and you have no active partner.
              Try again tomorrow.
            </Text>
          </View>
        )}

        {/* Arabic encouragement */}
        <Text style={styles.arabic}>
          {isApproved
            ? "جَزَاكَ ٱللَّهُ خَيْرًا"
            : "لَا تَيْأَسْ مِن رَّحْمَةِ ٱللَّهِ"}
        </Text>
        <Text style={styles.arabicTranslation}>
          {isApproved
            ? "May Allah reward you with good"
            : "Do not despair of the mercy of Allah"}
        </Text>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingBottom: 20,
    alignItems: "center",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    backgroundColor: COLORS.white,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  scoreNumber: {
    fontSize: 42,
    fontWeight: "800",
  },
  scoreLabel: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: "600",
  },
  statusCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statusApproved: {
    backgroundColor: "#D1FAE5",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  statusRejected: {
    backgroundColor: "#FEE2E2",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  statusSub: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  arabic: {
    fontFamily: "Amiri_400Regular",
    fontSize: 22,
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 6,
  },
  arabicTranslation: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 40,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
