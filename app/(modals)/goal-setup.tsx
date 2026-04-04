import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";

type GoalType = "ayah_count" | "juz" | "quran" | "random" | "fixed";

interface GoalOption {
  type: GoalType;
  title: string;
  description: string;
  requiresCount: boolean;
  countLabel?: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    type: "quran",
    title: "Complete the Quran",
    description: "Finish the entire Quran this month — 208 ayahs per day",
    requiresCount: false,
  },
  {
    type: "juz",
    title: "Complete N Juz",
    description: "We calculate the daily ayahs needed to finish your target",
    requiresCount: true,
    countLabel: "How many Juz this month?",
  },
  {
    type: "ayah_count",
    title: "Fixed Ayah Count",
    description:
      "Recite a fixed number of ayahs daily, continuing from last position",
    requiresCount: true,
    countLabel: "Ayahs per day",
  },
  {
    type: "random",
    title: "Random Verses",
    description: "Recite random verses daily — great for revision",
    requiresCount: true,
    countLabel: "How many ayahs per day?",
  },
];

const TIMES = ["05:00", "06:00", "07:00", "18:00", "20:00", "21:00", "22:00"];

export default function GoalSetupScreen() {
  const [selectedType, setSelectedType] = useState<GoalType | null>(null);
  const [count, setCount] = useState("");
  const [scheduledTime, setScheduledTime] = useState("06:00");
  const [loading, setLoading] = useState(false);

  const selectedOption = GOAL_OPTIONS.find((o) => o.type === selectedType);

  async function handleSave() {
    if (!selectedType) {
      Alert.alert("Error", "Please select a goal type");
      return;
    }
    if (selectedOption?.requiresCount && !count) {
      Alert.alert("Error", `Please enter ${selectedOption.countLabel}`);
      return;
    }

    try {
      setLoading(true);

      const body: Record<string, unknown> = {
        goalType: selectedType,
        scheduledTime,
      };

      if (selectedType === "juz") body.dailyJuzCount = parseInt(count);
      if (selectedType === "ayah_count" || selectedType === "random") {
        body.dailyAyahCount = parseInt(count);
      }

      await api.post("/api/recitation/goals", body);
      Alert.alert("Done", "Your goal has been set!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Monthly Goal</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.arabicVerse}>
          وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًۭا
        </Text>
        <Text style={styles.verseTranslation}>
          "And recite the Quran with measured recitation." — 73:4
        </Text>

        {/* Goal Type Selection */}
        <Text style={styles.sectionLabel}>Choose your goal</Text>
        {GOAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.optionCard,
              selectedType === option.type && styles.optionSelected,
            ]}
            onPress={() => setSelectedType(option.type)}
          >
            <View style={styles.optionRow}>
              <View style={styles.optionRadio}>
                {selectedType === option.type && (
                  <View style={styles.optionRadioInner} />
                )}
              </View>
              <View style={styles.optionText}>
                <Text
                  style={[
                    styles.optionTitle,
                    selectedType === option.type && styles.optionTitleSelected,
                  ]}
                >
                  {option.title}
                </Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Count input — shown only when required */}
        {selectedOption?.requiresCount && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>{selectedOption.countLabel}</Text>
            <TextInput
              style={styles.input}
              value={count}
              onChangeText={setCount}
              keyboardType="number-pad"
              placeholder="Enter a number"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        )}

        {/* Time Selection */}
        <Text style={styles.sectionLabel}>Daily reminder time</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeRow}
        >
          {TIMES.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeChip,
                scheduledTime === time && styles.timeChipSelected,
              ]}
              onPress={() => setScheduledTime(time)}
            >
              <Text
                style={[
                  styles.timeChipText,
                  scheduledTime === time && styles.timeChipTextSelected,
                ]}
              >
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Goal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  arabicVerse: {
    fontFamily: "Amiri_400Regular",
    fontSize: 22,
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 40,
  },
  verseTranslation: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  optionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#F0F0F0",
    elevation: 1,
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FAF4",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  optionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 3,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  optionDesc: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  inputSection: {
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 8,
  },
  timeRow: {
    gap: 8,
    paddingBottom: 4,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  timeChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  timeChipTextSelected: {
    color: COLORS.white,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
