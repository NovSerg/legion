import { AgentConfig, Message } from '@/types';
import { loadIndex, search } from './rag/store';

export const getProviderForModel = (model: string): { provider: 'zai' | 'openRouter' | 'lmStudio' | 'ollama', baseUrl: string } => {
  if (model.startsWith('local/')) {
    return { provider: 'lmStudio', baseUrl: '' }; // URL передаётся отдельно из настроек
  }
  if (model.startsWith('ollama/')) {
    return { provider: 'ollama', baseUrl: '' }; // URL передаётся отдельно из настроек
  }
  if (model.startsWith('glm')) {
    return { provider: 'zai', baseUrl: 'https://api.z.ai/api/coding/paas/v4' };
  }
  return { provider: 'openRouter', baseUrl: 'https://openrouter.ai/api/v1' };
};

import { mcpService } from './mcp';

export const sendMessage = async (
  apiKeys: { zai?: string; openRouter?: string; lmStudioUrl?: string; ollamaUrl?: string },
  messages: Message[],
  agentConfig: AgentConfig,
  onChunk: (chunk: string) => void
): Promise<{ content: string; metrics?: Message['metrics']; sources?: Message['sources'] }> => {
  const startTime = Date.now();
  const { provider, baseUrl: defaultBaseUrl } = getProviderForModel(agentConfig.model);
  
  // Для LM Studio используем URL из настроек, для остальных — дефолтный baseUrl
  let finalBaseUrl = defaultBaseUrl;
  let apiKey = '';
  let modelName = agentConfig.model;
  
  if (provider === 'lmStudio') {
    // Используем proxy для обхода CORS
    finalBaseUrl = '/api/lm-studio';
    apiKey = 'no-key'; // LM Studio не требует ключа
    modelName = agentConfig.model.replace('local/', ''); // Убираем префикс
  } else if (provider === 'ollama') {
    // Используем proxy для Ollama
    finalBaseUrl = '/api/ollama';
    apiKey = 'no-key'; // Ollama не требует ключа
    modelName = agentConfig.model.replace('ollama/', ''); // Убираем префикс
  } else {
    apiKey = (provider === 'zai' ? apiKeys.zai : apiKeys.openRouter) || '';
    if (!apiKey) {
      throw new Error(`${provider === 'zai' ? 'ZAI' : 'OpenRouter'} API Key not found. Please configure it in settings.`);
    }
  }

  let currentMessages = [...messages];
  let finalContent = '';
  let finalMetrics: Message['metrics'] = {
    latency: 0,
    model: agentConfig.model,
  };
  let finalSources: Message['sources'] = undefined;
  
  const MAX_TURNS = 5;
  let turnCount = 0;

  // Get available tools
  const tools = await mcpService.getTools();
  const toolsPayload = tools.length > 0 ? tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  })) : undefined;

  while (turnCount < MAX_TURNS) {
    turnCount++;
    
    let systemContent = agentConfig.systemPrompt;
    let sources: Message['sources'] = undefined;

    // RAG Integration (only for the first turn or if we want to persist context)
    // For simplicity, we keep RAG context in system prompt as before
    if (turnCount === 1 && agentConfig.ragMode && agentConfig.ragMode !== 'off') {
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
              finalSources = sources;

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
    
    // Construct messages for API
    // We need to be careful not to duplicate system message if we loop
    // But here we reconstruct it every time.
    // The currentMessages array contains the conversation history (user, assistant, tool).
    // We prepend the system message.
    const apiMessages = [
      systemMessage,
      ...currentMessages.map((m: any) => ({ 
        role: m.role, 
        content: m.content,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
        name: m.name
      })),
    ];

    try {
      // Для LM Studio и Ollama proxy уже содержит endpoint в route, для остальных добавляем
      const fetchUrl = (provider === 'lmStudio' || provider === 'ollama') ? finalBaseUrl : `${finalBaseUrl}/chat/completions`;
      
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'openRouter' ? {
            'HTTP-Referer': 'https://github.com/legion-ai',
            'X-Title': 'Legion AI',
          } : {}),
          ...(provider === 'lmStudio' ? {
            'x-lm-studio-url': apiKeys.lmStudioUrl || 'http://localhost:1234/v1',
          } : {}),
          ...(provider === 'ollama' ? {
            'x-ollama-url': apiKeys.ollamaUrl || 'https://api.novsergdev.org',
          } : {})
        },
        body: JSON.stringify({
          model: modelName,
          messages: apiMessages,
          stream: true,
          temperature: agentConfig.temperature,
          max_tokens: agentConfig.maxTokens,
          top_p: agentConfig.topP,
          frequency_penalty: agentConfig.frequencyPenalty,
          presence_penalty: agentConfig.presencePenalty,
          tools: toolsPayload,
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
      let buffer = '';
      let usage: any = null;
      
      let currentTurnContent = '';
      let toolCalls: any[] = [];

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
          
          // Ollama использует NDJSON (каждая строка - JSON объект)
          if (provider === 'ollama') {
            try {
              const parsed = JSON.parse(trimmedLine);
              const content = parsed.message?.content || '';
              if (content) {
                currentTurnContent += content;
                finalContent += content;
                onChunk(content);
              }
              // Ollama возвращает done: true когда завершен
              if (parsed.done && parsed.eval_count) {
                usage = {
                  prompt_tokens: parsed.prompt_eval_count || 0,
                  completion_tokens: parsed.eval_count || 0,
                  total_tokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0),
                };
              }
            } catch (e) {
              console.error('Error parsing Ollama chunk', e);
            }
          } else if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.usage) {
                usage = parsed.usage;
              }

              const delta = parsed.choices[0]?.delta;
              
              // Handle content
              const content = delta?.content || delta?.reasoning_content || '';
              if (content) {
                currentTurnContent += content;
                finalContent += content; // Accumulate for final return
                onChunk(content);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index;
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: toolCall.id,
                      type: toolCall.type,
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || ''
                      }
                    };
                  } else {
                    if (toolCall.function?.arguments) {
                      toolCalls[index].function.arguments += toolCall.function.arguments;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing chunk', e);
            }
          }
        }
      }

      // Calculate metrics for this turn
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      finalMetrics = {
        latency,
        model: agentConfig.model,
      };

      if (usage) {
        finalMetrics.promptTokens = usage.prompt_tokens;
        finalMetrics.completionTokens = usage.completion_tokens;
        finalMetrics.totalTokens = usage.total_tokens;
        
        if (usage.completion_tokens && latency > 0) {
          finalMetrics.speed = parseFloat((usage.completion_tokens / (latency / 1000)).toFixed(2));
        }
      }

      // If no tool calls, we are done
      if (toolCalls.length === 0) {
        break;
      }

      // Execute tools
      console.log('Executing tools:', toolCalls);
      
      // Add assistant message with tool calls to history
      currentMessages.push({
        role: 'assistant',
        content: currentTurnContent,
        tool_calls: toolCalls
      } as any);

      for (const toolCall of toolCalls) {
        try {
          const argsStr = toolCall.function.arguments || '{}';
          const args = argsStr.trim() ? JSON.parse(argsStr) : {};
          const toolName = toolCall.function.name;
          
          // Find which server has this tool
          // We need to look up the server ID for the tool.
          // Since getTools returned flattened list, we need to find it again or store the mapping.
          // Efficient way: iterate over tools array we got earlier
          const toolDef = tools.find(t => t.name === toolName);
          
          let result = '';
          if (toolDef) {
             const executionResult = await mcpService.executeTool(toolDef.serverId, toolName, args);
             // MCP result structure: { content: [{ type: 'text', text: '...' }] }
             // We need to serialize it to string
             result = JSON.stringify(executionResult);
          } else {
             result = `Error: Tool ${toolName} not found`;
          }

          // Add tool result to history
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: result
          } as any);

        } catch (e) {
          console.error(`Error executing tool ${toolCall.function.name}`, e);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: `Error: ${(e as Error).message}`
          } as any);
        }
      }
      
      // Loop continues to next turn to send tool results to LLM
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  return { content: finalContent, metrics: finalMetrics, sources: finalSources };
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
