import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentConfig, ApiKeys, Message, ChatSession } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  apiKeys: ApiKeys;
  agents: AgentConfig[];
  currentAgentId: string | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  enabledModels: string[];
  
  // Actions
  setApiKey: (provider: keyof ApiKeys, key: string) => void;
  addAgent: (agent: AgentConfig) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  deleteAgent: (id: string) => void;
  setCurrentAgent: (id: string) => void;
  
  createSession: (agentId: string) => void;
  setCurrentSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => void;
  clearSessionMessages: (sessionId: string) => void;

  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setEnabledModels: (models: string[]) => void;
  
  // Computed
  getCurrentAgent: () => AgentConfig | undefined;
  getCurrentSession: () => ChatSession | undefined;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      apiKeys: {},
      agents: [
        {
          id: 'default',
          name: 'General Assistant',
          systemPrompt: 'You are a helpful AI assistant.',
          model: 'glm-4.6',
          temperature: 0.7,
        }
      ],
      currentAgentId: 'default',
      sessions: [],
      currentSessionId: null,
      enabledModels: [
        // ZAI Models
        'glm-4.6',
        'glm-4.5',
        'glm-4.5-air',
        'glm-4.5-x',
        'glm-4.5-airx',
        'glm-4.5-flash',
        
        // OpenRouter Models
        'anthropic/claude-haiku-4.5',
        'openai/gpt-4o-mini',
        
        // Qwen Models
        'qwen/qwen3-vl-8b-thinking',
        'qwen/qwen3-vl-8b-instruct',
        'qwen/qwen3-vl-30b-a3b-thinking',
        'qwen/qwen3-vl-30b-a3b-instruct',
        'qwen/qwen3-vl-235b-a22b-thinking',
        'qwen/qwen3-vl-235b-a22b-instruct',
        'qwen/qwen3-max',
        'qwen/qwen3-coder-plus',
        'qwen/qwen3-coder-flash',
        'qwen/qwen3-next-80b-a3b-thinking',
        'qwen/qwen3-next-80b-a3b-instruct',
        'qwen/qwen-plus-2025-07-28',
        'qwen/qwen-plus-2025-07-28:thinking',
        'qwen/qwen3-30b-a3b-thinking-2507',
      ],

      setApiKey: (provider, key) => 
        set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),

      addAgent: (agent) => 
        set((state) => ({ agents: [...state.agents, agent] })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      deleteAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          currentAgentId: state.currentAgentId === id ? null : state.currentAgentId,
        })),

      setCurrentAgent: (id) => set({ currentAgentId: id }),

      createSession: (agentId) => {
        const newSession: ChatSession = {
          id: uuidv4(),
          agentId,
          messages: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
        }));
      },

      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

      deleteSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        })),

      clearSessionMessages: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, messages: [] } : s
          ),
        })),

      addMessage: (sessionId, message) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message] }
              : s
          ),
        })),

      updateMessage: (sessionId, messageId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                }
              : s
          ),
        })),

      setEnabledModels: (models) => set({ enabledModels: models }),

      getCurrentAgent: () => {
        const state = get();
        return state.agents.find((a) => a.id === state.currentAgentId);
      },
      
      getCurrentSession: () => {
        const state = get();
        return state.sessions.find((s) => s.id === state.currentSessionId);
      },
    }),
    {
      name: 'legion-storage',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        agents: state.agents,
        sessions: state.sessions,
        currentAgentId: state.currentAgentId,
        currentSessionId: state.currentSessionId,
        enabledModels: state.enabledModels,
      }),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Migration to version 2: Update ZAI models to 4.5 series
          return {
            ...persistedState,
            enabledModels: [
              // ZAI Models
              'glm-4.6',
              'glm-4.5',
              'glm-4.5-air',
              'glm-4.5-x',
              'glm-4.5-airx',
              'glm-4.5-flash',
              
              // OpenRouter Models
              'anthropic/claude-haiku-4.5',
              'openai/gpt-4o-mini',
              
              // Qwen Models
              'qwen/qwen3-vl-8b-thinking',
              'qwen/qwen3-vl-8b-instruct',
              'qwen/qwen3-vl-30b-a3b-thinking',
              'qwen/qwen3-vl-30b-a3b-instruct',
              'qwen/qwen3-vl-235b-a22b-thinking',
              'qwen/qwen3-vl-235b-a22b-instruct',
              'qwen/qwen3-max',
              'qwen/qwen3-coder-plus',
              'qwen/qwen3-coder-flash',
              'qwen/qwen3-next-80b-a3b-thinking',
              'qwen/qwen3-next-80b-a3b-instruct',
              'qwen/qwen-plus-2025-07-28',
              'qwen/qwen-plus-2025-07-28:thinking',
              'qwen/qwen3-30b-a3b-thinking-2507',
            ],
          };
        }
        return persistedState as AppState;
      },
    }
  )
);
