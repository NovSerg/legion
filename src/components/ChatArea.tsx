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

    const state = useStore.getState();
    const activeSessionId = state.currentSessionId;

    if (!activeSessionId) return;

    // Day 20: /help command - detect BEFORE creating messages
    const isHelpCommand = input.trim().toLowerCase() === '/help';
    const helpPrompt = 'Расскажи о структуре проекта Legion, его архитектуре и стиле кода. Опиши основные компоненты, технологический стек и приведи примеры кода. Используй информацию из README.md и документации в папке docs/.';

    // For /help, show the command in UI but send the expanded prompt to LLM
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: isHelpCommand ? '/help' : input,
      timestamp: Date.now(),
    };

    addMessage(activeSessionId, userMsg);

    if (isHelpCommand) {
      const helpSystemMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: '📚 **/help** — Запрос информации о проекте из базы знаний...',
        timestamp: Date.now(),
      };
      addMessage(activeSessionId, helpSystemMsg);
    }

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

    // Get fresh state
    const freshState = useStore.getState();
    let currentMessages = freshState.sessions.find(s => s.id === activeSessionId)?.messages || [];

    // For /help: replace user message content with expanded prompt for LLM
    if (isHelpCommand) {
      currentMessages = currentMessages.map(m =>
        m.id === userMsg.id ? { ...m, content: helpPrompt } : m
      );
    }

    // Filter out system messages (like /help indicator) for LLM context
    currentMessages = currentMessages.filter(m =>
      m.role !== 'system' || !m.content.startsWith('📚')
    );

    let fullContent = '';

    // For /help, force hybrid RAG mode
    const agentConfig = isHelpCommand
      ? { ...currentAgent, ragMode: 'hybrid' as const }
      : currentAgent;

    try {
      const { content, metrics, sources } = await sendMessage(
        apiKeys,
        currentMessages,
        agentConfig,
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

      // Update message with final metrics and sources
      updateMessage(activeSessionId, assistantMsgId, { metrics, sources });

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

      updateMessage(activeSessionId, strictMsgId, { metrics: strictRes.metrics, sources: strictRes.sources });
      updateMessage(activeSessionId, hybridMsgId, { metrics: hybridRes.metrics, sources: hybridRes.sources });
      updateMessage(activeSessionId, noRagMsgId, { metrics: noRagRes.metrics, sources: noRagRes.sources });

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
