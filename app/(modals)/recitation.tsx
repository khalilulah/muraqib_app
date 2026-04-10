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
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../src/services/api";
import { COLORS } from "../../src/constants";
import {
  initializeWhisper,
  transcribeAudio,
  isWhisperReady,
} from "../../src/utils/whisper";

interface Verse {
  uniqueKey: string; // 👈 add this
  surahNumber: number; // 👈 add this
  ayahNumber: number;
  text: string;
  audioUrl: string;
  surahName: string;
}

interface Session {
  id: string;
  goal_id: string;
}

interface CachedVerses {
  verses: Verse[];
  session: Session;
  goalId: string;
  cachedAt: number;
}

type ScreenState =
  | "loading"
  | "ready"
  | "recording"
  | "paused"
  | "submitting"
  | "error";
type AudioState =
  | "idle"
  | "loading"
  | "playing"
  | "loading_all"
  | "playing_all";

const CACHE_KEY = "cached_daily_verses";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default function RecitationScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const [state, setState] = useState<ScreenState>("loading");
  const [verses, setVerses] = useState<Verse[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [prefetchProgress, setPrefetchProgress] = useState(0); // 0-100
  const [isPrefetching, setIsPrefetching] = useState(false);
  const cachedAudioUrisRef = useRef<Record<string, string>>({});
  const [whisperReady, setWhisperReady] = useState(false);
  const [modelDownloading, setModelDownloading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  // Single audio lock — prevents multiple sounds playing simultaneously
  const audioLockRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pausedPositionRef = useRef<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelPlayAllRef = useRef(false);

  useEffect(() => {
    loadVerses();
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  useEffect(() => {
    loadVerses();
    initWhisperModel();
    return () => {
      cleanup().catch(console.error);
    };
  }, []);

  async function initWhisperModel() {
    if (isWhisperReady()) {
      setWhisperReady(true);
      return;
    }
    try {
      setModelDownloading(true);
      await initializeWhisper((progress) => {
        setModelProgress(progress);
      });
      setWhisperReady(true);
    } catch (error) {
      console.error("Whisper init failed:", error);
    } finally {
      setModelDownloading(false);
    }
  }

  function stripBismillah(text: string, surahNumber: number): string {
    if (surahNumber === 1) return text;

    // Find the last occurrence of ي(64a) م(645) ِ(650) which ends "الرحيم"
    // Then take everything after the following space
    const chars = [...text];

    for (let i = chars.length - 1; i >= 2; i--) {
      if (
        chars[i]?.codePointAt(0) === 0x650 && // kasra ِ
        chars[i - 1]?.codePointAt(0) === 0x645 && // م
        chars[i - 2]?.codePointAt(0) === 0x64a // ي
      ) {
        // Found "يمِ" — take everything after the next space
        const rest = chars
          .slice(i + 1)
          .join("")
          .trim();
        return rest;
      }
    }

    return text;
  }

  // useEffect(() => {
  //   if (verses.length > 0) {
  //     verses.forEach((v) => console.log(`${v.uniqueKey}: ${v.audioUrl}`));
  //   }
  // }, [verses]);

  async function cleanup() {
    cancelPlayAllRef.current = true;
    audioLockRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
    }
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
    }
  }

  // ── Cache helpers ─────────────────────────────────────────
  async function loadVerses() {
    try {
      setState("loading");

      // Check cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedVerses = JSON.parse(cached);
        const age = Date.now() - data.cachedAt;
        if (age < CACHE_TTL && data.goalId === goalId) {
          setVerses(data.verses);
          setSession(data.session);
          setState("ready");
          prefetchAudios(data.verses);
          return;
        }
      }

      // Fetch fresh from backend
      const res = await api.post("/api/recitation/sessions/start", { goalId });
      const freshVerses: Verse[] = res.data.data.verses;
      const freshSession: Session = res.data.data.session;

      // Save to cache
      const cacheData: CachedVerses = {
        verses: freshVerses,
        session: freshSession,
        goalId: goalId as string,
        cachedAt: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      setVerses(freshVerses);
      setSession(freshSession);
      setState("ready");
      prefetchAudios(freshVerses);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Failed to load verses",
        [{ text: "Go Back", onPress: () => router.back() }],
      );
      setState("error");
    }
  }

  // ── Prefetch all audio files into local cache ─────────────
  async function prefetchAudios(verseList: Verse[]) {
    setIsPrefetching(true);
    const uris: Record<string, string> = {};

    for (let i = 0; i < verseList.length; i++) {
      const verse = verseList[i]!;
      const cacheUri = `${FileSystem.cacheDirectory}ayah_${verse.surahNumber}_${verse.ayahNumber}.mp3`;

      try {
        const info = await FileSystem.getInfoAsync(cacheUri);
        if (info.exists) {
          uris[verse.uniqueKey] = cacheUri;
        } else {
          await FileSystem.downloadAsync(verse.audioUrl, cacheUri);
          uris[verse.uniqueKey] = cacheUri;
        }
      } catch {
        // Fall back to remote URL if download fails
        uris[verse.uniqueKey] = verse.audioUrl;
      }

      setPrefetchProgress(Math.round(((i + 1) / verseList.length) * 100));
    }

    cachedAudioUrisRef.current = uris;
    setIsPrefetching(false);
  }

  // ── Audio playback with lock ──────────────────────────────
  async function stopAllAudio() {
    cancelPlayAllRef.current = true;
    audioLockRef.current = false;
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

    // If this verse is already playing, stop it
    if (
      activeIndex === index &&
      (audioState === "playing" || audioState === "loading")
    ) {
      await stopAllAudio();
      return;
    }

    // Acquire lock
    if (audioLockRef.current) {
      await stopAllAudio();
      await new Promise((r) => setTimeout(r, 100)); // small delay for cleanup
    }

    audioLockRef.current = true;
    cancelPlayAllRef.current = false;

    try {
      setActiveIndex(index);
      setAudioState("loading");
      const uri = cachedAudioUrisRef.current[verse.uniqueKey] ?? verse.audioUrl;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
      );

      // Check if cancelled during load
      if (cancelPlayAllRef.current) {
        await sound.unloadAsync();
        audioLockRef.current = false;
        return;
      }

      soundRef.current = sound;
      setAudioState("playing");

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          soundRef.current = null;
          audioLockRef.current = false;
          setAudioState("idle");
          setActiveIndex(null);
        }
      });
    } catch {
      audioLockRef.current = false;
      setAudioState("idle");
      setActiveIndex(null);
    }
  }

  async function playAll() {
    if (audioState === "playing_all" || audioState === "loading_all") {
      await stopAllAudio();
      return;
    }

    if (audioLockRef.current) await stopAllAudio();
    audioLockRef.current = true;
    cancelPlayAllRef.current = false;

    for (let i = 0; i < verses.length; i++) {
      if (cancelPlayAllRef.current) break;
      const verse = verses[i]!;
      setActiveIndex(i);
      setAudioState("loading_all");

      try {
        const uri =
          cachedAudioUrisRef.current[verse.uniqueKey] ?? verse.audioUrl;
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
        );

        if (cancelPlayAllRef.current) {
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
        if (!cancelPlayAllRef.current && i < verses.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      } catch {
        break;
      }
    }

    audioLockRef.current = false;
    setAudioState("idle");
    setActiveIndex(null);
  }

  // ── Recording ─────────────────────────────────────────────
  async function startRecording() {
    try {
      await stopAllAudio();
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Please allow microphone access");
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
      pausedPositionRef.current = 0;
      timerRef.current = setInterval(
        () => setRecordingDuration((p) => p + 1),
        1000,
      );
    } catch {
      Alert.alert("Error", "Failed to start recording");
    }
  }

  async function pauseRecording() {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.pauseAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      pausedPositionRef.current = recordingDuration;
      setState("paused");
    } catch {
      Alert.alert("Error", "Failed to pause recording");
    }
  }

  async function resumeRecording() {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.startAsync();
      setState("recording");
      timerRef.current = setInterval(
        () => setRecordingDuration((p) => p + 1),
        1000,
      );
    } catch {
      Alert.alert("Error", "Failed to resume recording");
    }
  }

  async function cancelRecording() {
    Alert.alert(
      "Cancel Recording",
      "Are you sure you want to cancel? Your recording will be lost.",
      [
        { text: "Keep Recording", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: async () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recordingRef.current) {
              await recordingRef.current.stopAndUnloadAsync().catch(() => {});
              recordingRef.current = null;
            }
            setRecordingDuration(0);
            setState("ready");
          },
        },
      ],
    );
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

      // Read as base64 and send to backend
      // Backend uploads to Cloudinary and stores the URL
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      let transcription = "";
      if (whisperReady) {
        try {
          transcription = await transcribeAudio(uri);
          console.log("Whisper transcription:", transcription);
        } catch (error) {
          console.error("Transcription failed:", error);
          // Fallback — if transcription fails, send empty string
          transcription = "";
        }
      } else {
        // Whisper not ready — notify user
        Alert.alert(
          "Model not ready",
          "The transcription model is still loading. Please wait a moment and try again.",
        );
        setState("ready");
        return;
      }

      const result = await api.post("/api/recitation/sessions/submit", {
        sessionId: session.id,
        transcription,
        audioFileUrl: `data:audio/m4a;base64,${base64Audio}`,
        recordingDurationSeconds: recordingDuration,
      });

      await AsyncStorage.removeItem(CACHE_KEY);

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

  // ── Loading ───────────────────────────────────────────────
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            cleanup().catch(console.error);
            router.back();
          }}
          disabled={state === "recording" || state === "paused"}
        >
          <Text
            style={[
              styles.headerBack,
              (state === "recording" || state === "paused") &&
                styles.headerBackDisabled,
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
              {verses[0]?.surahName}
              {verses[verses.length - 1]?.surahName !== verses[0]?.surahName
                ? ` — ${verses[verses.length - 1]?.surahName}`
                : ""}{" "}
              · Ayah {verses[0]?.ayahNumber}
              {verses.length > 1
                ? ` – ${verses[verses.length - 1]?.ayahNumber}`
                : ""}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={playAll}
          disabled={
            state === "recording" ||
            state === "paused" ||
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

      {/* Prefetch indicator */}
      {isPrefetching && (
        <View style={styles.prefetchBar}>
          <View
            style={[styles.prefetchFill, { width: `${prefetchProgress}%` }]}
          />
          <Text style={styles.prefetchText}>
            Preparing audio... {prefetchProgress}%
          </Text>
        </View>
      )}
      {modelDownloading && (
        <View style={styles.whisperBar}>
          <View style={[styles.whisperFill, { width: `${modelProgress}%` }]} />
          <Text style={styles.whisperText}>
            Preparing transcription model... {modelProgress}%
          </Text>
        </View>
      )}
      {/* Verses */}
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
            state === "recording" ||
            state === "paused" ||
            (isAudioBusy && !isThisActive);
          const prevVerse = verses[index - 1];
          const isNewSurah =
            index > 0 &&
            prevVerse &&
            verse.surahNumber !== prevVerse.surahNumber;

          return (
            <View key={verse.uniqueKey}>
              {isNewSurah && (
                <View style={styles.surahSeparator}>
                  <View style={styles.surahSeparatorLine} />
                  <View style={styles.surahSeparatorCenter}>
                    <Text style={styles.surahSeparatorName}>
                      {verse.surahName}
                    </Text>
                    <Text style={styles.surahSeparatorBismillah}>
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </Text>
                  </View>
                  <View style={styles.surahSeparatorLine} />
                </View>
              )}
              <View
                style={[
                  styles.verseRow,
                  isThisPlaying && styles.verseRowHighlighted,
                ]}
              >
                <View style={styles.verseContent}>
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
                    {stripBismillah(verse.text, verse.surahNumber)}
                    {"  "}
                    <Text style={styles.medallion}>
                      {"❨"}
                      {toArabicNumerals(verse.ayahNumber)}
                      {"❩"}
                    </Text>
                  </Text>
                </View>
              </View>
              {index < verses.length - 1 && !isNewSurah && (
                <View style={styles.divider} />
              )}
            </View>
          );
        })}

        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {state === "ready" && (
          <>
            {isAudioBusy && (
              <Text style={styles.audioBusyHint}>
                Stop listening before you record
              </Text>
            )}
            <TouchableOpacity
              style={[styles.recordBtn, isAudioBusy && styles.btnDisabled]}
              onPress={startRecording}
              disabled={isAudioBusy}
            >
              <View style={styles.recordDot} />
              <Text style={styles.recordBtnText}>Start Recording</Text>
            </TouchableOpacity>
          </>
        )}

        {(state === "recording" || state === "paused") && (
          <View>
            {/* Timer row */}
            <View style={styles.recordingTimer}>
              <View
                style={[
                  styles.recordingPulse,
                  state === "paused" && styles.recordingPulsePaused,
                ]}
              />
              <Text style={styles.recordingTime}>
                {formatDuration(recordingDuration)}
              </Text>
              <Text style={styles.recordingStatus}>
                {state === "paused" ? "Paused" : "Recording"}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.recordingActions}>
              {/* Cancel */}
              <TouchableOpacity
                style={styles.cancelRecordBtn}
                onPress={cancelRecording}
              >
                <Text style={styles.cancelRecordText}>Cancel</Text>
              </TouchableOpacity>

              {/* Pause / Resume */}
              <TouchableOpacity
                style={styles.pauseBtn}
                onPress={
                  state === "recording" ? pauseRecording : resumeRecording
                }
              >
                <Text style={styles.pauseBtnText}>
                  {state === "recording" ? "Pause" : "Resume"}
                </Text>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={stopAndSubmit}
              >
                <Text style={styles.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function toArabicNumerals(n: number): string {
  return n
    .toString()
    .split("")
    .map((d) => String.fromCharCode(0x0660 + parseInt(d)))
    .join("");
}

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
  headerPlayAllText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "600",
    minWidth: 56,
    textAlign: "right",
  },
  prefetchBar: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 20,
    paddingVertical: 6,
    position: "relative",
    overflow: "hidden",
  },
  prefetchFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#A5D6A7",
    opacity: 0.5,
  },
  prefetchText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
    textAlign: "center",
  },
  whisperBar: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 20,
    paddingVertical: 6,
    position: "relative",
    overflow: "hidden",
  },
  whisperFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#A5D6A7",
    opacity: 0.5,
  },
  whisperText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
    textAlign: "center",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 28 },
  bismillah: {
    fontFamily: "Amiri_400Regular",
    fontSize: 24,
    color: "#444",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 24,
    lineHeight: 48,
  },
  verseRow: { paddingVertical: 20, paddingHorizontal: 16 },
  verseRowHighlighted: { backgroundColor: "#EEF2FF" },
  verseContent: { width: "100%" },
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
  arabicText: {
    fontFamily: "Amiri_400Regular",
    fontSize: 22,
    color: "#1C1C1E",
    textAlign: "right",
    lineHeight: 40,
    writingDirection: "rtl",
    width: "100%",
    paddingTop: 36,
  },
  medallion: {
    fontFamily: "Amiri_400Regular",
    fontSize: 16,
    color: COLORS.primary,
    lineHeight: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#DEDED8",
    marginHorizontal: 16,
  },
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
  btnDisabled: { opacity: 0.45 },
  recordDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  surahSeparator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  surahSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.primary,
    opacity: 0.3,
  },
  surahSeparatorName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    paddingHorizontal: 8,
  },
  surahSeparatorCenter: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  surahSeparatorBismillah: {
    fontFamily: "Amiri_400Regular",
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 4,
  },
  recordBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  recordingTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  recordingPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recordingPulsePaused: { backgroundColor: "#F59E0B" },
  recordingTime: {
    fontSize: 20,
    fontWeight: "700",
    color: "#EF4444",
    fontVariant: ["tabular-nums"],
    flex: 1,
  },
  recordingStatus: { fontSize: 13, color: "#888", fontWeight: "600" },
  recordingActions: { flexDirection: "row", gap: 10 },
  cancelRecordBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    alignItems: "center",
  },
  cancelRecordText: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
  pauseBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: "#F59E0B",
    alignItems: "center",
  },
  pauseBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  submitBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
