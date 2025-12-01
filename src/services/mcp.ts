import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { useStore } from '@/store/store';
import { McpServer } from '@/types';

class McpService {
  private clients: Map<string, Client> = new Map();

  async connect(server: McpServer) {
    if (this.clients.has(server.id)) {
      // If we are trying to connect but already have a client, it might be a stale connection or a retry.
      // Let's close the existing one to be safe.
      console.warn(`Client for ${server.id} already exists. Closing and reconnecting.`);
      await this.disconnect(server.id);
    }

    try {
      useStore.getState().updateMcpServerStatus(server.id, 'connecting');

      // Use our backend proxy URL
      const proxyUrl = new URL(`/api/mcp/${server.id}`, window.location.origin);
      
      const transport = new SSEClientTransport(proxyUrl);
      const client = new Client(
        {
          name: 'legion-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
          // @ts-ignore - Timeout is supported in implementation but missing in types
          timeout: 60000 
        }
      );

      await client.connect(transport);
      this.clients.set(server.id, client);

      useStore.getState().updateMcpServerStatus(server.id, 'connected');
      console.log(`Connected to MCP server: ${server.name}`);

      // Fetch tools
      try {
        const tools = await client.listTools();
        useStore.getState().updateMcpServerTools(server.id, tools.tools);
      } catch (e) {
        console.error(`Failed to list tools for ${server.name}`, e);
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${server.name}:`, error);
      useStore.getState().updateMcpServerStatus(server.id, 'error', (error as Error).message);
      throw error;
    }
  }

  async disconnect(serverId: string) {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error('Error closing client', e);
      }
      this.clients.delete(serverId);
    }
    // Always update status to disconnected, even if client was not found (e.g. state desync)
    useStore.getState().updateMcpServerStatus(serverId, 'disconnected');
  }

  async getTools() {
    const allTools: any[] = [];

    for (const [serverId, client] of this.clients.entries()) {
      try {
        const result = await client.listTools();
        const server = useStore.getState().mcpServers.find(s => s.id === serverId);
        
        const toolsWithServer = result.tools.map(tool => ({
          ...tool,
          serverName: server?.name || 'Unknown',
          serverId: serverId
        }));
        
        allTools.push(...toolsWithServer);
      } catch (error) {
        console.error(`Failed to list tools for server ${serverId}:`, error);
      }
    }

    return allTools;
  }

  async executeTool(serverId: string, toolName: string, args: any) {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Client not found for server ${serverId}`);
    }

    return await client.callTool({
      name: toolName,
      arguments: args,
    });
  }
  
  // Load config from backend and connect
  async syncConfig() {
    try {
      const response = await fetch('/api/mcp/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      
      const config = await response.json();
      const servers: McpServer[] = [];
      
      for (const [id, serverConfig] of Object.entries(config.mcpServers || {})) {
        servers.push({
          id,
          name: id,
          url: 'stdio', // Placeholder, handled by backend
          status: 'disconnected'
        });
      }
      
      // Update store
      // We should probably merge with existing status if possible, or just reset
      // For simplicity, let's just add them if not exists
      const currentServers = useStore.getState().mcpServers;
      
      for (const server of servers) {
         if (!currentServers.find(s => s.id === server.id)) {
            useStore.getState().addMcpServer(server);
         }
      }
      
      // Connect to all
      this.reconnectAll();
      
    } catch (e) {
      console.error('Failed to sync MCP config', e);
    }
  }

  async reconnectAll() {
    const servers = useStore.getState().mcpServers;
    for (const server of servers) {
        this.connect(server).catch(() => {});
    }
  }
}

export const mcpService = new McpService();
