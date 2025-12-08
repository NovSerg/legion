import { AgentConfig } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234/v1';

export const ZAI_MODELS = [
  { id: 'glm-4.6', name: 'GLM-4.6' },
  { id: 'glm-4.5', name: 'GLM-4.5' },
  { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
  { id: 'glm-4.5-x', name: 'GLM-4.5 X' },
  { id: 'glm-4.5-airx', name: 'GLM-4.5 AirX' },
  { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
];

export const DEFAULT_ENABLED_MODELS = [
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
];

export const createDefaultAgent = (): AgentConfig => ({
  id: 'default',
  name: 'General Assistant',
  systemPrompt: 'You are a helpful AI assistant.',
  model: 'glm-4.6',
  temperature: 0.7,
  ragMode: 'off',
});

export const createNewAgent = (): AgentConfig => ({
  id: uuidv4(),
  name: 'Новый агент',
  systemPrompt: 'Ты полезный ИИ-ассистент.',
  model: 'glm-4.6',
  temperature: 0.7,
  ragMode: 'off',
});
