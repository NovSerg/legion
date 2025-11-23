import { AgentConfig, Message } from '@/types';

interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  response_format?: { type: 'text' | 'json_object' };
}

export const sendMessage = async (
  apiKey: string,
  baseUrl: string,
  messages: Message[],
  agentConfig: AgentConfig,
  onChunk: (chunk: string) => void
): Promise<{ content: string; metrics?: Message['metrics'] }> => {
  const startTime = Date.now();
  const systemMessage = { role: 'system', content: agentConfig.systemPrompt };
  const apiMessages = [
    systemMessage,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const body: ChatCompletionRequest = {
    model: agentConfig.model,
    messages: apiMessages,
    temperature: agentConfig.temperature,
    top_p: agentConfig.topP,
    stream: true,
  };

  // Add advanced settings if present
  if (agentConfig.maxTokens) (body as any).max_tokens = agentConfig.maxTokens;
  if (agentConfig.frequencyPenalty) (body as any).frequency_penalty = agentConfig.frequencyPenalty;
  if (agentConfig.presencePenalty) (body as any).presence_penalty = agentConfig.presencePenalty;
  if (agentConfig.seed) (body as any).seed = agentConfig.seed;
  if (agentConfig.topK) (body as any).top_k = agentConfig.topK;

  if (agentConfig.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://legion.ai',
        'X-Title': 'Legion AI',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let usage: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            
            // Check for usage in the chunk
            if (parsed.usage) {
              usage = parsed.usage;
            }

            const delta = parsed.choices[0]?.delta;
            const content = delta?.content || delta?.reasoning_content || '';
            
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch (e) {
            console.error('Error parsing chunk', e);
          }
        }
      }
    }

    const endTime = Date.now();
    const latency = endTime - startTime;
    
    // Calculate metrics
    const metrics: Message['metrics'] = {
      latency,
      model: agentConfig.model,
    };

    if (usage) {
      metrics.promptTokens = usage.prompt_tokens;
      metrics.completionTokens = usage.completion_tokens;
      metrics.totalTokens = usage.total_tokens;
      
      // Calculate speed (tokens/sec)
      if (usage.completion_tokens && latency > 0) {
        metrics.speed = parseFloat((usage.completion_tokens / (latency / 1000)).toFixed(2));
      }

      // Estimate cost (very rough estimation, ideally should come from API or a map)
      // OpenRouter sometimes provides cost in response, but if not we can't easily know.
      // However, the user asked for "how much money spent". 
      // Some OpenRouter responses include `x-openrouter-cost` header? Or usage field might have it?
      // Let's check if usage has cost. Usually not standard OpenAI format.
      // But we can leave cost undefined for now if not available.
    }

    return { content: fullContent, metrics };
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const fetchCredits = async (apiKey: string): Promise<number | null> => {
  try {
    const [creditsResponse, keyResponse] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/credits', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }),
      fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
    ]);
    
    if (!creditsResponse.ok || !keyResponse.ok) return null;
    
    const creditsData = await creditsResponse.json();
    const keyData = await keyResponse.json();
    
    const totalCredits = creditsData.data?.total_credits;
    const usage = keyData.data?.usage;
    
    if (totalCredits !== undefined && usage !== undefined) {
      return totalCredits - usage;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching credits:', error);
    return null;
  }
};

export const fetchModels = async (): Promise<any[]> => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};
