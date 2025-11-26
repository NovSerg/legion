export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  metrics?: {
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    cost?: number;
    latency?: number; // in ms
    speed?: number; // tokens per second
    model?: string;
  };
}

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
  responseFormat?: 'text' | 'json_object' | 'xml';
  responseSchema?: string;
  ragMode?: 'off' | 'hybrid' | 'strict';
  ragThreshold?: number;
  ragRerank?: boolean;
}

export interface ApiKeys {
  openRouter?: string;
  zai?: string;
}

export interface ChatSession {
  id: string;
  agentId: string;
  messages: Message[];
  createdAt: number;
}

export interface Document {
  id: string;
  name: string;
  content: string;
  type: 'text' | 'markdown' | 'pdf';
  createdAt: number;
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface VectorIndex {
  version: number;
  documents: Document[];
  chunks: DocumentChunk[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}
