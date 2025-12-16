'use client';

import { useEffect, useRef } from 'react';
import { Box, TextField, InputAdornment, IconButton, CircularProgress, Tooltip, LinearProgress, Typography, keyframes } from '@mui/material';
import { Send as SendIcon, CompareArrows as CompareIcon, Mic as MicIcon, Stop as StopIcon } from '@mui/icons-material';
import { useWhisper } from '@/hooks/useWhisper';

// Pulse animation for recording indicator
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
`;

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  onCompare: () => void;
  isLoading: boolean;
  agentName: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  onCompare,
  isLoading,
  agentName,
}) => {
  // Ref to store handleSend for auto-send callback
  const handleSendRef = useRef(handleSend);
  const inputRef = useRef(input);

  useEffect(() => {
    handleSendRef.current = handleSend;
    inputRef.current = input;
  }, [handleSend, input]);

  const {
    isRecording,
    isTranscribing,
    isModelLoading,
    isModelReady,
    modelProgress,
    transcript,
    error,
    startRecording,
    stopRecording,
  } = useWhisper({
    autoSendOnSilence: true,
    silenceTimeout: 3000, // 3 seconds
    onTranscript: (text) => {
      setInput(text);
    },
    onAutoSend: (text) => {
      console.log('[ChatInput] Auto-send triggered with:', text);
      setInput(text);
      // Use longer delay and call handleSend via ref
      setTimeout(() => {
        console.log('[ChatInput] Calling handleSend, input:', inputRef.current);
        handleSendRef.current();
      }, 300);
    },
  });

  // Update input when transcript changes (for manual stop)
  useEffect(() => {
    if (transcript && !isRecording && !isTranscribing) {
      setInput(transcript);
    }
  }, [transcript, isRecording, isTranscribing, setInput]);

  const handleMicClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const isVoiceProcessing = isRecording || isTranscribing || isModelLoading;

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
      {/* Model loading progress */}
      {isModelLoading && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🧠 Загрузка Whisper модели... {modelProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={modelProgress} sx={{ mt: 0.5, borderRadius: 1 }} />
        </Box>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            🎤 Запись... (пауза 3 сек = авто-отправка)
          </Typography>
        </Box>
      )}

      {/* Transcribing indicator */}
      {isTranscribing && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            ✨ Распознавание речи...
          </Typography>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="error">
            ❌ {error}
          </Typography>
        </Box>
      )}

      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder={isRecording ? 'Говорите...' : `Сообщение... (введите /help для справки о проекте)`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          multiline
          maxRows={4}
          disabled={isVoiceProcessing}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {/* Microphone button */}
                <Tooltip title={
                  isModelLoading ? 'Загрузка модели...' :
                  isTranscribing ? 'Распознавание...' :
                  isRecording ? 'Остановить запись' : 
                  'Голосовой ввод (Whisper)'
                }>
                  <span>
                    <IconButton 
                      onClick={handleMicClick} 
                      disabled={isLoading || isTranscribing || isModelLoading}
                      sx={{
                        color: isRecording ? 'error.main' : 'inherit',
                        animation: isRecording ? `${pulse} 1.5s infinite` : 'none',
                      }}
                    >
                      {isModelLoading ? (
                        <CircularProgress size={24} />
                      ) : isTranscribing ? (
                        <CircularProgress size={24} color="primary" />
                      ) : isRecording ? (
                        <StopIcon />
                      ) : (
                        <MicIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>

                {/* Send button */}
                <IconButton onClick={handleSend} disabled={isLoading || isVoiceProcessing || !input.trim()} color="primary">
                  {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>

                {/* Compare button */}
                <Tooltip title="Сравнить (RAG vs Без RAG)">
                  <span>
                    <IconButton onClick={onCompare} disabled={isLoading || isVoiceProcessing || !input.trim()} color="secondary">
                      <CompareIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
            }
          }}
        />
      </Box>
    </Box>
  );
};
