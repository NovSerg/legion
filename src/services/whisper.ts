/**
 * Whisper Speech Recognition Service
 * Uses @xenova/transformers for in-browser speech recognition
 */

import { pipeline, Pipeline } from '@xenova/transformers';

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface WhisperProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

class WhisperService {
  private transcriber: Pipeline | null = null;
  private status: WhisperStatus = 'idle';
  private loadingProgress = 0;
  private onProgressCallback: ((progress: WhisperProgress) => void) | null = null;
  private onStatusChangeCallback: ((status: WhisperStatus) => void) | null = null;

  getStatus(): WhisperStatus {
    return this.status;
  }

  getLoadingProgress(): number {
    return this.loadingProgress;
  }

  setOnProgress(callback: (progress: WhisperProgress) => void) {
    this.onProgressCallback = callback;
  }

  setOnStatusChange(callback: (status: WhisperStatus) => void) {
    this.onStatusChangeCallback = callback;
  }

  private setStatus(status: WhisperStatus) {
    this.status = status;
    this.onStatusChangeCallback?.(status);
  }

  async loadModel(): Promise<void> {
    if (this.status === 'ready' || this.status === 'loading') {
      return;
    }

    this.setStatus('loading');
    this.loadingProgress = 0;

    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-base',
        {
          progress_callback: (progress: WhisperProgress) => {
            if (progress.progress !== undefined) {
              this.loadingProgress = Math.round(progress.progress);
            }
            this.onProgressCallback?.(progress);
          },
        }
      );
      this.setStatus('ready');
    } catch (error) {
      console.error('Failed to load Whisper model:', error);
      this.setStatus('error');
      throw error;
    }
  }

  async transcribe(audioBlob: Blob): Promise<string> {
    if (!this.transcriber) {
      await this.loadModel();
    }

    if (!this.transcriber) {
      throw new Error('Whisper model not loaded');
    }

    this.setStatus('transcribing');

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get audio data as Float32Array
      const audioData = audioBuffer.getChannelData(0);
      
      // Transcribe with explicit Russian language
      const result = await this.transcriber(audioData, {
        language: 'russian',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      this.setStatus('ready');
      
      // Extract text from result
      if (typeof result === 'object' && result !== null) {
        if ('text' in result) {
          return (result as { text: string }).text.trim();
        }
        if (Array.isArray(result) && result.length > 0 && 'text' in result[0]) {
          return result[0].text.trim();
        }
      }
      
      return String(result).trim();
    } catch (error) {
      console.error('Transcription error:', error);
      this.setStatus('error');
      throw error;
    }
  }
}

export const whisperService = new WhisperService();
