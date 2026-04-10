import { initWhisper, WhisperContext } from "whisper.rn";
import * as FileSystem from "expo-file-system/legacy";

let whisperContext: WhisperContext | null = null;

const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_PATH = `${FileSystem.documentDirectory}ggml-base.bin`;

export async function initializeWhisper(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (whisperContext) return;

  const modelInfo = await FileSystem.getInfoAsync(MODEL_PATH);
  console.log("Model exists:", modelInfo.exists);
  if (modelInfo.exists) {
    // @ts-ignore
    console.log("Model size:", modelInfo.size, "bytes");

    // If model is too small it's corrupted — delete and redownload
    // @ts-ignore
    if (modelInfo.size < 100_000_000) {
      console.log("Model too small — deleting and redownloading");
      await FileSystem.deleteAsync(MODEL_PATH);
    }
  }

  const freshInfo = await FileSystem.getInfoAsync(MODEL_PATH);
  if (!freshInfo.exists) {
    console.log("Downloading model...");
    const downloadResult = await FileSystem.downloadAsync(
      MODEL_URL,
      MODEL_PATH,
    );
    console.log("Download status:", downloadResult.status);

    if (downloadResult.status !== 200) {
      throw new Error(
        `Model download failed with status ${downloadResult.status}`,
      );
    }
  }

  console.log("Initializing whisper context...");
  whisperContext = await initWhisper({ filePath: MODEL_PATH });
  console.log("Whisper context initialized successfully");
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  if (!whisperContext) throw new Error("Whisper not initialized");

  console.log("Transcribing audio:", audioUri);
  const { promise } = whisperContext.transcribe(audioUri, {
    language: "ar",
    maxLen: 0,
    tokenTimestamps: false,
    translate: false,
    noTimestamps: true,
  });

  const result = await promise;
  console.log("Raw transcription result:", result.result);
  return result.result.trim();
}

export function isWhisperReady(): boolean {
  return whisperContext !== null;
}
