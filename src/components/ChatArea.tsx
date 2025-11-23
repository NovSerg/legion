'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/store';
import { sendMessage } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  AppBar,
  Toolbar,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Person as UserIcon,
  SmartToy as BotIcon,
  Settings as SettingsIcon,
  DeleteSweep as ClearIcon,
  AddComment as NewChatIcon
} from '@mui/icons-material';

interface ChatAreaProps {
  onOpenAgentSettings: () => void;
}

export const ChatArea = ({ onOpenAgentSettings }: ChatAreaProps) => {
  const { 
    currentAgentId, 
    getCurrentAgent, 
    sessions, 
    currentSessionId, 
    createSession, 
    addMessage, 
    apiKeys,
    clearSessionMessages,
    setCurrentSession,
    updateMessage
  } = useStore();
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentAgent = getCurrentAgent();
  const currentSession = sessions.find(s => s.id === currentSessionId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const handleSend = async () => {
    if (!input.trim() || !currentAgent) return;

    if (!currentSessionId) {
      createSession(currentAgent.id);
    }
    
    // Need to get the fresh state after createSession
    // Using a small timeout or just accessing store directly is safer in async flow if we want to be sure
    // But since createSession is sync in Zustand, we can just re-read state or rely on the fact that we need the ID.
    // Let's grab it from store state directly to be safe.
    const state = useStore.getState();
    const activeSessionId = state.currentSessionId;

    if (!activeSessionId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    addMessage(activeSessionId, userMsg);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    
    addMessage(activeSessionId, assistantMsg);

    try {
      let apiKey = '';
      let baseUrl = '';

      if (currentAgent.model.startsWith('glm')) {
        apiKey = apiKeys.zai || '';
        baseUrl = 'https://api.z.ai/api/coding/paas/v4';
      } else {
        apiKey = apiKeys.openRouter || '';
        baseUrl = 'https://openrouter.ai/api/v1';
      }

      if (!apiKey) {
        const providerName = currentAgent.model.startsWith('glm') ? 'ZAI' : 'OpenRouter';
        throw new Error(`${providerName} API Key not found. Please configure it in settings.`);
      }

      // Get fresh state to include the user message we just added
      const freshState = useStore.getState();
      const currentMessages = freshState.sessions.find(s => s.id === activeSessionId)?.messages || [];

      let fullContent = '';
      
      const { content, metrics } = await sendMessage(
        apiKey,
        baseUrl,
        currentMessages,
        currentAgent,
        (chunk) => {
          fullContent += chunk;
          useStore.setState((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === activeSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: fullContent } : m
                    ),
                  }
                : s
            ),
          }));
        }
      );

      // Update message with final metrics
      updateMessage(activeSessionId, assistantMsgId, { metrics });

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${(error as Error).message}`,
        timestamp: Date.now(),
      };
      addMessage(activeSessionId, errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) {
    return null;
  }

  if (!currentAgent) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        <Typography>Выберите или создайте агента для начала.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold' }}>
              {currentAgent.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {currentAgent.model}
            </Typography>
          </Box>
          <Tooltip title="Новый чат">
            <IconButton onClick={() => setCurrentSession(null)}>
              <NewChatIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Очистить чат">
            <IconButton onClick={() => currentSessionId && clearSessionMessages(currentSessionId)} disabled={!currentSessionId}>
              <ClearIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onOpenAgentSettings}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentSession?.messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper
              elevation={1}
              sx={{
                p: 2,
                maxWidth: '80%',
                bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.7 }}>
                {msg.role === 'user' ? <UserIcon sx={{ fontSize: 16, mr: 1 }} /> : <BotIcon sx={{ fontSize: 16, mr: 1 }} />}
                <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                  {msg.role === 'user' ? 'Вы' : 'Ассистент'}
                </Typography>
              </Box>
              <Box className="prose" sx={{ '& p': { m: 0 } }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </Box>
              
              {msg.role === 'assistant' && msg.metrics && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    ⏱️ {(msg.metrics.latency ? (msg.metrics.latency / 1000).toFixed(2) : 0)}с
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ⚡ {msg.metrics.speed || 0} т/с
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    🪙 {msg.metrics.totalTokens || 0} токенов
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    🤖 {msg.metrics.model}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <TextField
          fullWidth
          placeholder={`Сообщение для ${currentAgent.name}...`}
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSend} disabled={isLoading || !input.trim()} color="primary">
                  {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
                </IconButton>
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
