import { initWhisper, WhisperContext } from "whisper.rn";
import * as FileSystem from "expo-file-system/legacy";

let whisperContext: WhisperContext | null = null;

const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MODEL_PATH = `${FileSystem.documentDirectory}ggml-base.bin`;

export async function initializeWhisper(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (whisperContext) return; // already initialized

  // Check if model already downloaded
  const modelInfo = await FileSystem.getInfoAsync(MODEL_PATH);

  if (!modelInfo.exists) {
    // Download the model with progress
    await FileSystem.downloadAsync(MODEL_URL, MODEL_PATH, {
      // @ts-ignore
      downloadProgressCallback: (progress) => {
        const percent = Math.round(
          (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) *
            100,
        );
        onProgress?.(percent);
      },
    });
  }

  // Initialize whisper with the model
  whisperContext = await initWhisper({
    filePath: MODEL_PATH,
  });
}

export async function transcribeAudio(audioUri: string): Promise<string> {
  if (!whisperContext) {
    throw new Error("Whisper not initialized");
  }

  const { promise } = whisperContext.transcribe(audioUri, {
    language: "ar", // Arabic
    maxLen: 0,
    tokenTimestamps: false,
    translate: false, // don't translate to English
    noTimestamps: true,
  });

  const result = await promise;
  return result.result.trim();
}

export function isWhisperReady(): boolean {
  return whisperContext !== null;
}
