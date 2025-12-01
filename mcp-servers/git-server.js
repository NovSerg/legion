#!/usr/bin/env node
/**
 * MCP Server for Git operations and file reading
 * Implements JSON-RPC 2.0 over stdio
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const SERVER_INFO = {
  name: 'git-server',
  version: '1.1.0',
};

const TOOLS = [
  {
    name: 'git_current_branch',
    description: 'Get the current git branch name',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional, defaults to current directory)',
        },
      },
    },
  },
  {
    name: 'git_status',
    description: 'Get git status (short format)',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional)',
        },
      },
    },
  },
  {
    name: 'git_log',
    description: 'Get recent git commits',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional)',
        },
        count: {
          type: 'number',
          description: 'Number of commits to show (default: 5)',
        },
      },
    },
  },
  {
    name: 'list_files',
    description: 'List files in the repository (tracked by git)',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional)',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g., "*.md", "src/**/*.ts")',
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read content of a file from the repository. Use this to get file contents for adding to RAG knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file (relative to repo root or absolute)',
        },
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'read_multiple_files',
    description: 'Read content of multiple files at once. Returns combined content suitable for RAG indexing.',
    inputSchema: {
      type: 'object',
      properties: {
        filePaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to read',
        },
        repoPath: {
          type: 'string',
          description: 'Path to the git repository (optional)',
        },
      },
      required: ['filePaths'],
    },
  },
];

function executeGitCommand(command, cwd) {
  try {
    const result = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

function readFileContent(filePath, repoPath) {
  try {
    const basePath = repoPath || process.cwd();
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);

    if (!fs.existsSync(fullPath)) {
      return `Error: File not found: ${fullPath}`;
    }

    const stats = fs.statSync(fullPath);
    if (stats.size > 100000) {
      return `Error: File too large (${stats.size} bytes). Max 100KB.`;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return content;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

function handleToolCall(name, args) {
  const repoPath = args?.repoPath || process.cwd();

  switch (name) {
    case 'git_current_branch':
      return executeGitCommand('git branch --show-current', repoPath);

    case 'git_status':
      return executeGitCommand('git status -s', repoPath);

    case 'git_log': {
      const count = args?.count || 5;
      return executeGitCommand(`git log --oneline -n ${count}`, repoPath);
    }

    case 'list_files': {
      const pattern = args?.pattern;
      if (pattern) {
        // Use git ls-files with pattern
        return executeGitCommand(`git ls-files "${pattern}"`, repoPath);
      }
      return executeGitCommand('git ls-files', repoPath);
    }

    case 'read_file': {
      const filePath = args?.filePath;
      if (!filePath) {
        return 'Error: filePath is required';
      }
      const content = readFileContent(filePath, repoPath);
      return `--- File: ${filePath} ---\n${content}`;
    }

    case 'read_multiple_files': {
      const filePaths = args?.filePaths;
      if (!filePaths || !Array.isArray(filePaths)) {
        return 'Error: filePaths array is required';
      }

      const results = filePaths.map(fp => {
        const content = readFileContent(fp, repoPath);
        return `\n=== ${fp} ===\n${content}`;
      });

      return results.join('\n');
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

function createResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function createErrorResponse(id, code, message) {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
}

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return createResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: SERVER_INFO,
      });

    case 'initialized':
      // Notification, no response needed
      return null;

    case 'tools/list':
      return createResponse(id, { tools: TOOLS });

    case 'tools/call': {
      const { name, arguments: args } = params;
      const result = handleToolCall(name, args || {});
      return createResponse(id, {
        content: [{ type: 'text', text: result }],
      });
    }

    case 'resources/list':
      return createResponse(id, { resources: [] });

    case 'resources/read':
      return createErrorResponse(id, -32603, 'Resource not found');

    case 'prompts/list':
      return createResponse(id, { prompts: [] });

    case 'ping':
      return createResponse(id, {});

    default:
      return createErrorResponse(id, -32601, `Method not found: ${method}`);
  }
}

// Main: Read from stdin, write to stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);
    if (response) {
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    console.error(`Parse error: ${error.message}`);
  }
});

process.stderr.write(`[git-server] Started v1.1.0\n`);
