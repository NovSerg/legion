'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { whisperService } from '@/services/whisper';

interface UseWhisperOptions {
  autoSendOnSilence?: boolean;
  silenceTimeout?: number; // ms
  onTranscript?: (text: string) => void;
  onAutoSend?: (text: string) => void;
}

interface UseWhisperReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isModelLoading: boolean;
  isModelReady: boolean;
  modelProgress: number;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  loadModel: () => Promise<void>;
}

export function useWhisper(options: UseWhisperOptions = {}): UseWhisperReturn {
  const {
    autoSendOnSilence = true,
    silenceTimeout = 3000, // 3 seconds
    onTranscript,
    onAutoSend,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(whisperService.getStatus() === 'ready');
  const [modelProgress, setModelProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs for mutable values that don't trigger re-renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSoundTimeRef = useRef<number>(Date.now());
  const isRecordingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);

  // Keep options in refs to avoid stale closures
  const optionsRef = useRef({ autoSendOnSilence, silenceTimeout, onTranscript, onAutoSend });
  useEffect(() => {
    optionsRef.current = { autoSendOnSilence, silenceTimeout, onTranscript, onAutoSend };
  }, [autoSendOnSilence, silenceTimeout, onTranscript, onAutoSend]);

  // Monitor status changes
  useEffect(() => {
    whisperService.setOnStatusChange((status) => {
      setIsModelLoading(status === 'loading');
      setIsModelReady(status === 'ready');
      setIsTranscribing(status === 'transcribing');
    });

    whisperService.setOnProgress((progress) => {
      if (progress.progress !== undefined) {
        setModelProgress(Math.round(progress.progress));
      }
    });
  }, []);

  const loadModel = useCallback(async () => {
    if (whisperService.getStatus() === 'ready') {
      setIsModelReady(true);
      return;
    }

    setError(null);
    setIsModelLoading(true);

    try {
      await whisperService.loadModel();
      setIsModelReady(true);
    } catch (err) {
      setError('Ошибка загрузки модели');
      console.error(err);
    } finally {
      setIsModelLoading(false);
    }
  }, []);

  const stopRecordingInternal = useCallback(async (shouldAutoSend = false) => {
    // Prevent multiple calls
    if (isStoppingRef.current || !isRecordingRef.current) {
      console.log('[Whisper] Already stopping or not recording');
      return;
    }
    isStoppingRef.current = true;
    isRecordingRef.current = false;
    
    console.log('[Whisper] Stopping recording, autoSend:', shouldAutoSend);

    // Clear silence check interval
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }

    setIsRecording(false);

    // Wait for final chunks
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];

      console.log('[Whisper] Audio blob size:', audioBlob.size);

      if (audioBlob.size > 1000) {
        setIsTranscribing(true);
        try {
          const text = await whisperService.transcribe(audioBlob);
          console.log('[Whisper] Transcribed:', text);
          if (text) {
            setTranscript(text);
            optionsRef.current.onTranscript?.(text);
            
            // Auto-send if silence triggered stop
            if (shouldAutoSend && optionsRef.current.onAutoSend) {
              console.log('[Whisper] Auto-sending:', text);
              optionsRef.current.onAutoSend(text);
            }
          }
        } catch (err) {
          setError('Ошибка распознавания');
          console.error(err);
        } finally {
          setIsTranscribing(false);
        }
      }
    }
    
    isStoppingRef.current = false;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');

    // Ensure model is loaded
    if (!isModelReady) {
      await loadModel();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        } 
      });
      streamRef.current = stream;

      // Setup audio analysis for silence detection
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Collect chunks every 250ms
      
      isRecordingRef.current = true;
      isStoppingRef.current = false;
      setIsRecording(true);
      lastSoundTimeRef.current = Date.now();

      console.log('[Whisper] Recording started, silence timeout:', optionsRef.current.silenceTimeout);

      // Start silence detection with setInterval
      silenceCheckIntervalRef.current = setInterval(() => {
        if (!isRecordingRef.current || !analyserRef.current) {
          return;
        }

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const threshold = 15;

        if (rms > threshold) {
          lastSoundTimeRef.current = Date.now();
        } else {
          const silenceDuration = Date.now() - lastSoundTimeRef.current;
          
          if (optionsRef.current.autoSendOnSilence && silenceDuration >= optionsRef.current.silenceTimeout) {
            console.log('[Whisper] Silence detected for', silenceDuration, 'ms, stopping...');
            stopRecordingInternal(true);
          }
        }
      }, 100);

    } catch (err) {
      setError('Нет доступа к микрофону');
      console.error(err);
    }
  }, [isModelReady, loadModel, stopRecordingInternal]);

  const stopRecording = useCallback(() => {
    stopRecordingInternal(false);
  }, [stopRecordingInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    isModelLoading,
    isModelReady,
    modelProgress,
    transcript,
    error,
    startRecording,
    stopRecording,
    loadModel,
  };
}
