import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const configPath = path.join(process.cwd(), 'mcp-servers.json');
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to read mcp-servers.json', error);
    // Return empty config if file doesn't exist
    return NextResponse.json({ mcpServers: {} });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const configPath = path.join(process.cwd(), 'mcp-servers.json');
    
    // Basic validation
    if (!body.mcpServers || typeof body.mcpServers !== 'object') {
      return NextResponse.json({ error: 'Invalid config format' }, { status: 400 });
    }

    await fs.writeFile(configPath, JSON.stringify(body, null, 2));

    // Force restart running servers to apply new config/env vars
    const { McpManager } = await import('@/lib/mcp/McpManager');
    const manager = McpManager.getInstance();
    
    for (const id of Object.keys(body.mcpServers)) {
        manager.stopServer(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save mcp-servers.json', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
