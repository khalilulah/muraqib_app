declare module "whisper.rn" {
  export interface WhisperContext {
    transcribe(
      audioUri: string,
      options?: {
        language?: string;
        maxLen?: number;
        tokenTimestamps?: boolean;
      },
    ): {
      promise: Promise<{ result: string }>;
      stop: () => void;
    };
    release(): Promise<void>;
  }

  export function initWhisper(options: {
    filePath: string;
  }): Promise<WhisperContext>;
}
