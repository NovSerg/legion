import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_OLLAMA_URL = 'https://api.novsergdev.org';

export async function GET(request: NextRequest) {
  const ollamaUrl = request.headers.get('x-ollama-url') || DEFAULT_OLLAMA_URL;
  
  try {
    // Ollama использует /api/tags для получения списка моделей
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Ollama proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Ollama' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ollamaUrl = request.headers.get('x-ollama-url') || DEFAULT_OLLAMA_URL;
  
  try {
    const body = await request.json();
    
    // Ollama использует /api/chat для chat completions
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        stream: body.stream ?? true,
        options: {
          temperature: body.temperature,
          top_p: body.top_p,
          top_k: body.top_k,
          num_predict: body.max_tokens,
          frequency_penalty: body.frequency_penalty,
          presence_penalty: body.presence_penalty,
          seed: body.seed,
        },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: `Ollama error: ${errorData}` },
        { status: response.status }
      );
    }
    
    // Stream response
    if (body.stream) {
      const stream = response.body;
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Ollama proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Ollama' },
      { status: 502 }
    );
  }
}
