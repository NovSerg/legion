import { NextRequest, NextResponse } from 'next/server';
import { McpManager } from '@/lib/mcp/McpManager';
import fs from 'fs/promises';
import path from 'path';

// Helper to ensure server is started
async function ensureServerStarted(id: string) {
  const manager = McpManager.getInstance();
  if (manager.getServerStatus(id) !== 'running') {
    // Load config to find command
    const configPath = path.join(process.cwd(), 'mcp-servers.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    const serverConfig = config.mcpServers[id];
    
    if (!serverConfig) {
      throw new Error(`Server ${id} not found in config`);
    }
    
    manager.startServer(id, serverConfig);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const manager = McpManager.getInstance();

  try {
    console.log(`[API] Connecting to server ${id}`);
    await ensureServerStarted(id);
  } catch (e) {
    console.error(`[API] Failed to start server ${id}:`, e);
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
            // MCP protocol over SSE expects "event: message" and "data: ..."
            // The data is the JSON-RPC message
            controller.enqueue(`event: message\ndata: ${data}\n\n`);
        } catch (e) {
            // Controller might be closed
        }
      };

      manager.addClient(id, send);

      // Send endpoint event to tell client where to post messages
      // Relative path to the current URL
      controller.enqueue(`event: endpoint\ndata: /api/mcp/${id}\n\n`);

      // Keep alive
      const interval = setInterval(() => {
         try {
            controller.enqueue(': keep-alive\n\n');
         } catch (e) {
            clearInterval(interval);
         }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        manager.removeClient(id, send);
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const manager = McpManager.getInstance();

  try {
    const body = await req.json();
    manager.sendMessage(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
