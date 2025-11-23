'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/store';
import { sendMessage } from '@/services/api';

import { Message } from '@/types';
import {
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Tooltip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  DeleteSweep as ClearIcon,
  AddComment as NewChatIcon
} from '@mui/icons-material';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';

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
    
    // Get fresh state to include the user message we just added
    const freshState = useStore.getState();
    const currentMessages = freshState.sessions.find(s => s.id === activeSessionId)?.messages || [];
    let fullContent = '';

    try {
      const { content, metrics } = await sendMessage(
        apiKeys,
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

      <MessageList messages={currentSession?.messages || []} messagesEndRef={messagesEndRef} />

      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
        agentName={currentAgent.name}
      />
    </Box>
  );
};
