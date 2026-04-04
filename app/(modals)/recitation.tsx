import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";

interface Verse {
  ayahNumber: number;
  text: string;
  audioUrl: string;
  surahName: string;
}

interface Session {
  id: string;
  goal_id: string;
}

type ScreenState = "loading" | "ready" | "recording" | "submitting" | "error";
type AudioState =
  | "idle"
  | "loading"
  | "playing"
  | "loading_all"
  | "playing_all";

export default function RecitationScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const [state, setState] = useState<ScreenState>("loading");
  const [verses, setVerses] = useState<Verse[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [audioState, setAudioState] = useState<AudioState>("idle");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playAllCancelledRef = useRef(false);

  useEffect(() => {
    startSession();
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  async function cleanup() {
    playAllCancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current)
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
    if (soundRef.current) await soundRef.current.unloadAsync().catch(() => {});
  }

  async function startSession() {
    try {
      setState("loading");
      const res = await api.post("/api/recitation/sessions/start", { goalId });
      setVerses(res.data.data.verses);
      setSession(res.data.data.session);
      setState("ready");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Failed to load verses",
        [{ text: "Go Back", onPress: () => router.back() }],
      );
      setState("error");
    }
  }

  async function stopCurrentAudio() {
    playAllCancelledRef.current = true;
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setAudioState("idle");
    setActiveIndex(null);
  }

  async function playVerse(index: number) {
    const verse = verses[index];
    if (!verse) return;
    if (
      activeIndex === index &&
      (audioState === "playing" || audioState === "loading")
    ) {
      await stopCurrentAudio();
      return;
    }
    await stopCurrentAudio();
    playAllCancelledRef.current = false;
    try {
      setActiveIndex(index);
      setAudioState("loading");
      const { sound } = await Audio.Sound.createAsync(
        { uri: verse.audioUrl },
        { shouldPlay: true },
      );
      if (playAllCancelledRef.current) {
        await sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
      setAudioState("playing");
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setAudioState("idle");
          setActiveIndex(null);
          soundRef.current = null;
        }
      });
    } catch {
      setAudioState("idle");
      setActiveIndex(null);
    }
  }

  async function playAll() {
    if (audioState === "playing_all" || audioState === "loading_all") {
      await stopCurrentAudio();
      return;
    }
    await stopCurrentAudio();
    playAllCancelledRef.current = false;
    for (let i = 0; i < verses.length; i++) {
      if (playAllCancelledRef.current) break;
      const verse = verses[i];
      if (!verse) continue;
      setActiveIndex(i);
      setAudioState("loading_all");
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: verse.audioUrl },
          { shouldPlay: true },
        );
        if (playAllCancelledRef.current) {
          await sound.unloadAsync();
          break;
        }
        soundRef.current = sound;
        setAudioState("playing_all");
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) resolve();
          });
        });
        await sound.unloadAsync().catch(() => {});
        soundRef.current = null;
        if (!playAllCancelledRef.current && i < verses.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch {
        break;
      }
    }
    setAudioState("idle");
    setActiveIndex(null);
  }

  async function startRecording() {
    try {
      await stopCurrentAudio();
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission needed",
          "Please allow microphone access to recite",
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState("recording");
      setRecordingDuration(0);
      timerRef.current = setInterval(
        () => setRecordingDuration((p) => p + 1),
        1000,
      );
    } catch {
      Alert.alert("Error", "Failed to start recording");
    }
  }

  async function stopAndSubmit() {
    if (!recordingRef.current || !session) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setState("submitting");
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error("No recording found");
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const result = await api.post("/api/recitation/sessions/submit", {
        sessionId: session.id,
        transcription: verses.map((v) => v.text).join(" "),
        audioFileUrl: `data:audio/m4a;base64,${base64Audio}`,
      });
      router.replace({
        pathname: "/(modals)/result",
        params: {
          sessionId: session.id,
          score: result.data.data.score,
          status: result.data.data.verificationStatus,
          needsReview: result.data.data.needsPartnerReview ? "true" : "false",
        },
      });
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Submission failed",
      );
      setState("ready");
    }
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const isAudioBusy = audioState !== "idle";
  const isPlayingAll =
    audioState === "playing_all" || audioState === "loading_all";

  if (state === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your verses...</Text>
      </View>
    );
  }

  if (state === "submitting") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking your recitation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            cleanup().catch(console.error);
            router.back();
          }}
          disabled={state === "recording"}
        >
          <Text
            style={[
              styles.headerBack,
              state === "recording" && styles.headerBackDisabled,
            ]}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerSurah}>
            {verses[0]?.surahName ?? "Recitation"}
          </Text>
          {verses.length > 0 && (
            <Text style={styles.headerRange}>
              {"Ayah "}
              {verses[0]!.ayahNumber}
              {verses.length > 1
                ? ` – ${verses[verses.length - 1]!.ayahNumber}`
                : ""}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.headerPlayAll}
          onPress={playAll}
          disabled={
            state === "recording" ||
            audioState === "loading" ||
            audioState === "playing"
          }
        >
          {audioState === "loading_all" ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.headerPlayAllText}>
              {isPlayingAll ? "Stop" : "Play All"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Verse List ─────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.bismillah}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </Text>

        {verses.map((verse, index) => {
          const isThisActive = activeIndex === index;
          const isThisLoading =
            isThisActive &&
            (audioState === "loading" || audioState === "loading_all");
          const isThisPlaying =
            isThisActive &&
            (audioState === "playing" || audioState === "playing_all");
          const isDisabled =
            state === "recording" || (isAudioBusy && !isThisActive);

          return (
            <View key={verse.ayahNumber}>
              <View
                style={[
                  styles.verseRow,
                  isThisPlaying && styles.verseRowHighlighted,
                ]}
              >
                <View style={styles.verseContent}>
                  {/* Play button — top left, doesn't affect text width */}
                  <TouchableOpacity
                    style={[
                      styles.playBtn,
                      isThisPlaying && styles.playBtnActive,
                      isDisabled && styles.playBtnDisabled,
                    ]}
                    onPress={() => playVerse(index)}
                    disabled={isDisabled}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isThisLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isThisPlaying ? COLORS.white : COLORS.primary}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.playBtnIcon,
                          isThisPlaying && styles.playBtnIconActive,
                        ]}
                      >
                        {isThisPlaying ? "◼" : "▶"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.arabicText}>
                    {verse.text}
                    {"  "}
                    {/* Inline medallion — renders as part of the text flow */}
                    <Text style={styles.medallionWrapper}>
                      {"❨"}
                      {toArabicNumerals(verse.ayahNumber)}
                      {"❩"}
                    </Text>
                  </Text>
                </View>
              </View>

              {index < verses.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}

        <View style={{ height: 150 }} />
      </ScrollView>

      {/* ── Bottom Controls ─────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        {state === "ready" && (
          <>
            {isAudioBusy && (
              <Text style={styles.audioBusyHint}>
                Stop listening before you record
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.recordBtn,
                isAudioBusy && styles.recordBtnDisabled,
              ]}
              onPress={startRecording}
              disabled={isAudioBusy}
            >
              <View style={styles.recordDot} />
              <Text style={styles.recordBtnText}>Start Recording</Text>
            </TouchableOpacity>
          </>
        )}

        {state === "recording" && (
          <View style={styles.recordingRow}>
            <View style={styles.recordingTimer}>
              <View style={styles.recordingPulse} />
              <Text style={styles.recordingTime}>
                {formatDuration(recordingDuration)}
              </Text>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={stopAndSubmit}>
              <Text style={styles.submitBtnText}>Done — Submit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/** Western → Arabic-Indic numerals: 40 → ٤٠ */
function toArabicNumerals(n: number): string {
  return n
    .toString()
    .split("")
    .map((d) => String.fromCharCode(0x0660 + parseInt(d)))
    .join("");
}

const ARABIC_FONT = "ScheherazadeNew_400Regular";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAF8",
    gap: 16,
  },
  loadingText: { fontSize: 15, color: "#888", marginTop: 8 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
  },
  headerBack: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
    minWidth: 56,
  },
  headerBackDisabled: { opacity: 0.3 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSurah: { color: COLORS.white, fontSize: 17, fontWeight: "700" },
  headerRange: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
  headerPlayAll: {
    minWidth: 56,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerPlayAllText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 28 },

  bismillah: {
    fontFamily: ARABIC_FONT,
    fontSize: 26,
    color: "#444",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 24,
    lineHeight: 50,
  },

  // ── Verse Row ─────────────────────────────────────────────────────────────
  verseRow: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  verseRowHighlighted: { backgroundColor: "#EEF2FF" },

  // verseContent: relative container so play button can sit top-left
  // while Arabic text fills the full width below it
  verseContent: {
    width: "100%",
  },

  // Play button — positioned top-left, floats above the text block
  playBtn: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  playBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  playBtnDisabled: { borderColor: "#ccc", opacity: 0.35 },
  playBtnIcon: { fontSize: 8, color: COLORS.primary },
  playBtnIconActive: { color: COLORS.white },

  // Arabic text — full width, RTL, Scheherazade New
  arabicText: {
    fontFamily: ARABIC_FONT,
    fontSize: 20,
    color: "#1C1C1E",
    textAlign: "right",
    lineHeight: 38,
    writingDirection: "rtl",
    width: "100%",
    // Small top padding so text doesn't overlap play button on first line
    paddingTop: 40,
  },

  // Ayah number medallion — inline text styled to look like Quran.com's circle
  // Uses a Unicode ornamental bracket to wrap the Arabic numeral
  medallionWrapper: {
    fontFamily: ARABIC_FONT,
    fontSize: 17,
    color: COLORS.primary,
    lineHeight: 28,
  },

  // Thin separator line
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#DEDED8",
    marginHorizontal: 16,
  },

  // ── Bottom Controls ───────────────────────────────────────────────────────
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DEDED8",
  },
  audioBusyHint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginBottom: 8,
  },
  recordBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  recordBtnDisabled: { opacity: 0.45 },
  recordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recordBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  recordingTimer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recordingPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recordingTime: {
    fontSize: 20,
    fontWeight: "700",
    color: "#EF4444",
    fontVariant: ["tabular-nums"],
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  submitBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});
