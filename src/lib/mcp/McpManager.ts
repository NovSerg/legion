import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ServerProcess {
  process: ChildProcess;
  config: McpServerConfig;
  status: 'running' | 'stopped' | 'error';
  error?: string;
}

export class McpManager extends EventEmitter {
  private static instance: McpManager;
  private servers: Map<string, ServerProcess> = new Map();
  private outputListeners: Map<string, ((data: string) => void)[]> = new Map();

  private constructor() {
    super();
    // Prevent garbage collection of the instance if we store it globally
    if ((global as any).__mcp_manager) {
      return (global as any).__mcp_manager;
    }
    (global as any).__mcp_manager = this;
  }

  public static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  public startServer(id: string, config: McpServerConfig) {
    if (this.servers.has(id)) {
      const existing = this.servers.get(id);
      if (existing?.status === 'running') {
        return;
      }
    }

    console.log(`[McpManager] Starting server ${id}: ${config.command} ${config.args.join(' ')}`);

    try {
      const child = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true // Helpful for npx on Windows
      });

      const serverProcess: ServerProcess = {
        process: child,
        config,
        status: 'running'
      };

      this.servers.set(id, serverProcess);

      child.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            this.broadcastToClients(id, line);
          }
        }
      });

      child.stderr?.on('data', (data) => {
        console.error(`[McpServer ${id} Error]: ${data}`);
      });

      child.on('error', (err) => {
        console.error(`[McpServer ${id} Failed]:`, err);
        serverProcess.status = 'error';
        serverProcess.error = err.message;
        this.emit('status', { id, status: 'error', error: err.message });
      });

      child.on('close', (code) => {
        console.log(`[McpServer ${id}] exited with code ${code}`);
        serverProcess.status = 'stopped';
        this.emit('status', { id, status: 'stopped' });
      });

    } catch (error) {
      console.error(`Failed to start server ${id}:`, error);
      throw error;
    }
  }

  public stopServer(id: string) {
    const server = this.servers.get(id);
    if (server && server.process) {
      server.process.kill();
      this.servers.delete(id);
    }
  }

  public sendMessage(id: string, message: any) {
    const server = this.servers.get(id);
    if (!server || server.status !== 'running') {
      throw new Error(`Server ${id} is not running`);
    }

    const input = JSON.stringify(message) + '\n';
    server.process.stdin?.write(input);
  }

  public addClient(id: string, send: (data: string) => void) {
    if (!this.outputListeners.has(id)) {
      this.outputListeners.set(id, []);
    }
    this.outputListeners.get(id)?.push(send);
  }

  public removeClient(id: string, send: (data: string) => void) {
    const listeners = this.outputListeners.get(id);
    if (listeners) {
      const index = listeners.indexOf(send);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private broadcastToClients(id: string, data: string) {
    const listeners = this.outputListeners.get(id);
    if (listeners) {
      listeners.forEach(send => send(data));
    }
  }

  public getServerStatus(id: string) {
    return this.servers.get(id)?.status || 'stopped';
  }
}
