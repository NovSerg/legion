import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234/v1';

export async function GET(request: NextRequest) {
  const lmStudioUrl = request.headers.get('x-lm-studio-url') || DEFAULT_LM_STUDIO_URL;
  
  try {
    const response = await fetch(`${lmStudioUrl}/models`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `LM Studio returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('LM Studio proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to LM Studio' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const lmStudioUrl = request.headers.get('x-lm-studio-url') || DEFAULT_LM_STUDIO_URL;
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${lmStudioUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer no-key',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: `LM Studio error: ${errorData}` },
        { status: response.status }
      );
    }
    
    // Stream the response
    if (body.stream) {
      const stream = response.body;
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('LM Studio proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to LM Studio' },
      { status: 502 }
    );
  }
}
