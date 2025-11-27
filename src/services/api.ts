import { AgentConfig, Message } from '@/types';
import { loadIndex, search } from './rag/store';

export const getProviderForModel = (model: string): { provider: 'zai' | 'openRouter', baseUrl: string } => {
  if (model.startsWith('glm')) {
    return { provider: 'zai', baseUrl: 'https://api.z.ai/api/coding/paas/v4' };
  }
  return { provider: 'openRouter', baseUrl: 'https://openrouter.ai/api/v1' };
};

export const sendMessage = async (
  apiKeys: { zai?: string; openRouter?: string },
  messages: Message[],
  agentConfig: AgentConfig,
  onChunk: (chunk: string) => void
): Promise<{ content: string; metrics?: Message['metrics']; sources?: Message['sources'] }> => {
  const startTime = Date.now();
  const { provider, baseUrl } = getProviderForModel(agentConfig.model);
  const apiKey = apiKeys[provider];

  if (!apiKey) {
    throw new Error(`${provider === 'zai' ? 'ZAI' : 'OpenRouter'} API Key not found. Please configure it in settings.`);
  }

  let systemContent = agentConfig.systemPrompt;
  let sources: Message['sources'] = undefined;

  // RAG Integration
  if (agentConfig.ragMode && agentConfig.ragMode !== 'off') {
    console.log('[RAG] Starting RAG integration...', agentConfig.ragMode);
    let contextString = '';
    
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    if (lastUserMessage) {
      const index = loadIndex();
      
      if (index) {
        try {
          const results = await search(
            lastUserMessage.content, 
            index,
            agentConfig.topK || 3,
            agentConfig.ragThreshold ?? 0.1,
            agentConfig.ragRerank ?? false
          );
          
          if (results.length > 0) {
            // Capture sources
            sources = results.map((r, i) => ({
              id: (i + 1).toString(),
              name: r.chunk.metadata?.source || 'Unknown Source',
              content: r.chunk.content,
              metadata: {
                ...r.chunk.metadata,
                score: r.score // Pass the score to the UI
              }
            }));

            // Format context with citation IDs
            const context = results.map((r, i) => {
              const sourceName = r.chunk.metadata?.source || 'Unknown Source';
              return `[${i + 1}] Source: ${sourceName}\nContent: ${r.chunk.content}`;
            }).join('\n\n');
            
            if (agentConfig.ragMode === 'strict') {
              contextString = `\n\nCONTEXT FROM KNOWLEDGE BASE:\n${context}\n\nINSTRUCTIONS: You are a Strict RAG assistant. You must answer the user's question ONLY based on the provided context above. \nIMPORTANT: You must cite your sources using the format [1], [2], etc. corresponding to the context chunks used. If the answer is not in the context, state that you do not know.`;
            } else {
              // Hybrid
              contextString = `\n\nRelevant Context from Knowledge Base:\n${context}\n\nINSTRUCTIONS: Answer the user's question using the above context. You may use your internal knowledge to explain or supplement the answer, but prioritize the context. \nIMPORTANT: When using information from the context, you MUST cite the source using the format [1], [2], etc.`;
            }
          } else {
            console.log('[RAG] No results matched threshold');
            if (agentConfig.ragMode === 'strict') {
               contextString = `\n\nINSTRUCTIONS: You are a Strict RAG assistant. No relevant context was found in the knowledge base. Please inform the user that you cannot answer the question because no relevant information was found in the documents.`;
            }
          }
        } catch (e) {
          console.error('RAG Search failed:', e);
        }
      }
    }
    systemContent += contextString;
  }

  if (agentConfig.responseSchema) {
    const format = agentConfig.responseFormat === 'xml' ? 'xml' : 'json';
    systemContent += `\n\nIMPORTANT: You must respond in ${format === 'xml' ? 'XML' : 'JSON'} format following this structure:\n${agentConfig.responseSchema}\n\nWrap your entire response in a markdown code block (\`\`\`${format} ... \`\`\`).`;
  }

  const systemMessage = { role: 'system', content: systemContent };
  const apiMessages = [
    systemMessage,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'openRouter' ? {
          'HTTP-Referer': 'https://github.com/legion-ai',
          'X-Title': 'Legion AI',
        } : {})
      },
      body: JSON.stringify({
        model: agentConfig.model,
        messages: apiMessages,
        stream: true,
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
        top_p: agentConfig.topP,
        frequency_penalty: agentConfig.frequencyPenalty,
        presence_penalty: agentConfig.presencePenalty,
        ...(agentConfig.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
        ...(agentConfig.seed ? { seed: agentConfig.seed } : {}),
        ...(agentConfig.topK ? { top_k: agentConfig.topK } : {}),
      }),
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
    }

    return { content: fullContent, metrics, sources };
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
