#!/usr/bin/env node
/**
 * MCP Server for Git operations and file reading
 * Implements JSON-RPC 2.0 over stdio
 */

const { execSync } = require('child_process')
const readline = require('readline')
const fs = require('fs')
const path = require('path')
const https = require('https')

const SERVER_INFO = {
  name: 'git-server',
  version: '1.2.0',
}

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
    description:
      'Read content of a file from the repository. Use this to get file contents for adding to RAG knowledge base.',
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
  // ============ GitHub API Tools ============
  {
    name: 'github_list_repo_contents',
    description: 'Get list of files and folders in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner (username or organization)',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        path: {
          type: 'string',
          description: 'Path in repository (default: root)',
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit SHA (optional)',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_read_file',
    description: 'Read content of a file from GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        path: {
          type: 'string',
          description: 'File path in repository',
        },
        ref: {
          type: 'string',
          description: 'Branch, tag, or commit SHA (optional)',
        },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
  {
    name: 'github_get_pr_list',
    description: 'Get list of Pull Requests in a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        state: {
          type: 'string',
          description: 'PR state: open, closed, or all (default: open)',
        },
        per_page: {
          type: 'number',
          description: 'Number of results per page (default: 30, max: 100)',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_pr_info',
    description: 'Get detailed information about a specific Pull Request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        prNumber: {
          type: 'number',
          description: 'Pull Request number',
        },
      },
      required: ['owner', 'repo', 'prNumber'],
    },
  },
  {
    name: 'github_get_pr_files',
    description: 'Get list of files changed in a Pull Request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        prNumber: {
          type: 'number',
          description: 'Pull Request number',
        },
      },
      required: ['owner', 'repo', 'prNumber'],
    },
  },
  {
    name: 'github_get_pr_diff',
    description: 'Get full diff of a Pull Request',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Repository owner',
        },
        repo: {
          type: 'string',
          description: 'Repository name',
        },
        prNumber: {
          type: 'number',
          description: 'Pull Request number',
        },
      },
      required: ['owner', 'repo', 'prNumber'],
    },
  },
]

function executeGitCommand(command, cwd) {
  try {
    const result = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 10000,
    })
    return result.trim()
  } catch (error) {
    return `Error: ${error.message}`
  }
}

function readFileContent(filePath, repoPath) {
  try {
    const basePath = repoPath || process.cwd()
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath)

    if (!fs.existsSync(fullPath)) {
      return `Error: File not found: ${fullPath}`
    }

    const stats = fs.statSync(fullPath)
    if (stats.size > 100000) {
      return `Error: File too large (${stats.size} bytes). Max 100KB.`
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    return content
  } catch (error) {
    return `Error reading file: ${error.message}`
  }
}

// ============ GitHub API Helper Functions ============

/**
 * Получение GitHub токена из переменной окружения
 */
function getGitHubToken() {
  return process.env.GITHUB_TOKEN || ''
}

/**
 * Декодирование содержимого из base64
 */
function decodeBase64Content(content) {
  return Buffer.from(content, 'base64').toString('utf-8')
}

/**
 * Выполнение запроса к GitHub API
 * @param {string} endpoint - API endpoint (например, '/repos/owner/repo/contents/path')
 * @param {object} options - Дополнительные опции
 * @returns {Promise<object>} - Результат запроса
 */
function makeGitHubApiRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const token = getGitHubToken()
    const acceptHeader = options.accept || 'application/vnd.github.v3+json'

    const requestOptions = {
      hostname: 'api.github.com',
      path: endpoint,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'git-mcp-server/1.2.0',
        Accept: acceptHeader,
        ...(token && { Authorization: `token ${token}` }),
      },
    }

    const req = https.request(requestOptions, res => {
      let data = ''

      res.on('data', chunk => {
        data += chunk
      })

      res.on('end', () => {
        // Для diff формата возвращаем текст как есть
        if (acceptHeader.includes('diff') || acceptHeader.includes('patch')) {
          resolve({ statusCode: res.statusCode, data })
          return
        }

        // Для JSON парсим
        try {
          const parsed = JSON.parse(data)
          resolve({ statusCode: res.statusCode, data: parsed })
        } catch (e) {
          resolve({ statusCode: res.statusCode, data })
        }
      })
    })

    req.on('error', error => {
      reject(error)
    })

    req.end()
  })
}

async function handleToolCall(name, args) {
  const repoPath = args?.repoPath || process.cwd()

  switch (name) {
    case 'git_current_branch':
      return executeGitCommand('git branch --show-current', repoPath)

    case 'git_status':
      return executeGitCommand('git status -s', repoPath)

    case 'git_log': {
      const count = args?.count || 5
      return executeGitCommand(`git log --oneline -n ${count}`, repoPath)
    }

    case 'list_files': {
      const pattern = args?.pattern
      if (pattern) {
        // Use git ls-files with pattern
        return executeGitCommand(`git ls-files "${pattern}"`, repoPath)
      }
      return executeGitCommand('git ls-files', repoPath)
    }

    case 'read_file': {
      const filePath = args?.filePath
      if (!filePath) {
        return 'Error: filePath is required'
      }
      const content = readFileContent(filePath, repoPath)
      return `--- File: ${filePath} ---\n${content}`
    }

    case 'read_multiple_files': {
      const filePaths = args?.filePaths
      if (!filePaths || !Array.isArray(filePaths)) {
        return 'Error: filePaths array is required'
      }

      const results = filePaths.map(fp => {
        const content = readFileContent(fp, repoPath)
        return `\n=== ${fp} ===\n${content}`
      })

      return results.join('\n')
    }

    // ============ GitHub API Handlers ============
    case 'github_list_repo_contents': {
      const { owner, repo, path = '', ref } = args
      if (!owner || !repo) {
        return 'Error: owner and repo are required'
      }

      const endpoint = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`

      return makeGitHubApiRequest(endpoint)
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${JSON.stringify(response.data)}`
          }

          const items = Array.isArray(response.data) ? response.data : [response.data]
          const formatted = items
            .map(item => `${item.type === 'dir' ? '📁' : '📄'} ${item.name} (${item.type}) - ${item.size || 0} bytes`)
            .join('\n')

          return `Contents of ${owner}/${repo}/${path}:\n${formatted}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    case 'github_read_file': {
      const { owner, repo, path, ref } = args
      if (!owner || !repo || !path) {
        return 'Error: owner, repo, and path are required'
      }

      const endpoint = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`

      return makeGitHubApiRequest(endpoint)
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${JSON.stringify(response.data)}`
          }

          if (response.data.type !== 'file') {
            return `Error: ${path} is not a file`
          }

          const content = decodeBase64Content(response.data.content)
          return `--- File: ${owner}/${repo}/${path} ---\n${content}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    case 'github_get_pr_list': {
      const { owner, repo, state = 'open', per_page = 30 } = args
      if (!owner || !repo) {
        return 'Error: owner and repo are required'
      }

      const endpoint = `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${per_page}`

      return makeGitHubApiRequest(endpoint)
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${JSON.stringify(response.data)}`
          }

          if (response.data.length === 0) {
            return `No ${state} pull requests found in ${owner}/${repo}`
          }

          const formatted = response.data
            .map(
              pr =>
                `#${pr.number}: ${pr.title}\n  Author: ${pr.user.login}\n  State: ${pr.state}\n  Head: ${pr.head.ref} → Base: ${pr.base.ref}\n  Created: ${pr.created_at}`,
            )
            .join('\n\n')

          return `Pull Requests in ${owner}/${repo} (${state}):\n\n${formatted}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    case 'github_get_pr_info': {
      const { owner, repo, prNumber } = args
      if (!owner || !repo || !prNumber) {
        return 'Error: owner, repo, and prNumber are required'
      }

      const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`

      return makeGitHubApiRequest(endpoint)
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${JSON.stringify(response.data)}`
          }

          const pr = response.data
          return `Pull Request #${pr.number}: ${pr.title}
Author: ${pr.user.login}
State: ${pr.state}${pr.merged ? ' (merged)' : ''}
Head: ${pr.head.ref} → Base: ${pr.base.ref}
Created: ${pr.created_at}
Updated: ${pr.updated_at}
Commits: ${pr.commits}
Changed files: ${pr.changed_files}
Additions: +${pr.additions} | Deletions: -${pr.deletions}
Comments: ${pr.comments}

Description:
${pr.body || 'No description provided'}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    case 'github_get_pr_files': {
      const { owner, repo, prNumber } = args
      if (!owner || !repo || !prNumber) {
        return 'Error: owner, repo, and prNumber are required'
      }

      const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}/files`

      return makeGitHubApiRequest(endpoint)
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${JSON.stringify(response.data)}`
          }

          const formatted = response.data
            .map(
              file =>
                `${file.status.toUpperCase()}: ${file.filename}\n  Changes: +${file.additions} -${file.deletions} (${
                  file.changes
                } total)`,
            )
            .join('\n\n')

          return `Files changed in PR #${prNumber}:\n\n${formatted}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    case 'github_get_pr_diff': {
      const { owner, repo, prNumber } = args
      if (!owner || !repo || !prNumber) {
        return 'Error: owner, repo, and prNumber are required'
      }

      const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`

      return makeGitHubApiRequest(endpoint, { accept: 'application/vnd.github.v3.diff' })
        .then(response => {
          if (response.statusCode !== 200) {
            return `Error: ${response.statusCode} - ${response.data}`
          }

          return `Diff for PR #${prNumber}:\n\n${response.data}`
        })
        .catch(error => `Error: ${error.message}`)
    }

    default:
      return `Unknown tool: ${name}`
  }
}

function createResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result,
  }
}

function createErrorResponse(id, code, message) {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  }
}

async function handleRequest(request) {
  const { id, method, params } = request

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
      })

    case 'initialized':
      // Notification, no response needed
      return null

    case 'tools/list':
      return createResponse(id, { tools: TOOLS })

    case 'tools/call': {
      const { name, arguments: args } = params
      const result = await handleToolCall(name, args || {})
      return createResponse(id, {
        content: [{ type: 'text', text: result }],
      })
    }

    case 'resources/list':
      return createResponse(id, { resources: [] })

    case 'resources/read':
      return createErrorResponse(id, -32603, 'Resource not found')

    case 'prompts/list':
      return createResponse(id, { prompts: [] })

    case 'ping':
      return createResponse(id, {})

    default:
      return createErrorResponse(id, -32601, `Method not found: ${method}`)
  }
}

// Main: Read from stdin, write to stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

rl.on('line', async line => {
  try {
    const request = JSON.parse(line)
    const response = await handleRequest(request)
    if (response) {
      console.log(JSON.stringify(response))
    }
  } catch (error) {
    console.error(`Parse error: ${error.message}`)
  }
})

process.stderr.write(`[git-server] Started v1.2.0\n`)
