'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/store';
import { sendMessage } from '@/services/api';

import { Message, AgentConfig } from '@/types';
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

  const handleCompare = async () => {
    if (!input.trim() || !currentAgent) return;

    if (!currentSessionId) {
      createSession(currentAgent.id);
    }
    
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

    // 1. Strict RAG Response
    const strictMsgId = crypto.randomUUID();
    const strictMsg: Message = {
      id: strictMsgId,
      role: 'assistant',
      content: '🔒 **Strict RAG**:\n',
      timestamp: Date.now(),
    };
    addMessage(activeSessionId, strictMsg);

    // 2. Hybrid RAG Response
    const hybridMsgId = crypto.randomUUID();
    const hybridMsg: Message = {
      id: hybridMsgId,
      role: 'assistant',
      content: '🌐 **Hybrid RAG**:\n',
      timestamp: Date.now(),
    };
    addMessage(activeSessionId, hybridMsg);

    // 3. No RAG Response
    const noRagMsgId = crypto.randomUUID();
    const noRagMsg: Message = {
      id: noRagMsgId,
      role: 'assistant',
      content: '🧠 **No RAG**:\n',
      timestamp: Date.now(),
    };
    addMessage(activeSessionId, noRagMsg);

    const freshState = useStore.getState();
    const currentMessages = freshState.sessions.find(s => s.id === activeSessionId)?.messages || [];
    // Filter out the new assistant messages for the context
    const contextMessages = currentMessages.filter(m => m.id !== strictMsgId && m.id !== hybridMsgId && m.id !== noRagMsgId);

    try {
      // Run all in parallel
      const strictConfig = { ...currentAgent, ragMode: 'strict' as const };
      const hybridConfig = { ...currentAgent, ragMode: 'hybrid' as const };
      const noRagConfig = { ...currentAgent, ragMode: 'off' as const };

      const createPromise = (config: AgentConfig, msgId: string) => 
        sendMessage(
          apiKeys,
          contextMessages,
          config,
          (chunk) => {
            useStore.setState((state) => {
              const session = state.sessions.find(s => s.id === activeSessionId);
              if (!session) return state;
              
              const msg = session.messages.find(m => m.id === msgId);
              if (!msg) return state;

              return {
                sessions: state.sessions.map((s) =>
                  s.id === activeSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === msgId ? { ...m, content: m.content + chunk } : m
                        ),
                      }
                    : s
                ),
              };
            });
          }
        );

      const [strictRes, hybridRes, noRagRes] = await Promise.all([
        createPromise(strictConfig, strictMsgId),
        createPromise(hybridConfig, hybridMsgId),
        createPromise(noRagConfig, noRagMsgId)
      ]);

      updateMessage(activeSessionId, strictMsgId, { metrics: strictRes.metrics });
      updateMessage(activeSessionId, hybridMsgId, { metrics: hybridRes.metrics });
      updateMessage(activeSessionId, noRagMsgId, { metrics: noRagRes.metrics });

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error during comparison: ${(error as Error).message}`,
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
        onCompare={handleCompare}
        isLoading={isLoading}
        agentName={currentAgent.name}
      />
    </Box>
  );
};
