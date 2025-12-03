#!/usr/bin/env node
/**
 * MCP Server for Support CRM
 * Provides access to user data and support tickets
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const SERVER_INFO = {
  name: 'support-crm',
  version: '1.0.0',
}

// Path to data file
const DATA_FILE = path.join(__dirname, 'support-data.json')

// Load data
function loadData() {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to load support data:', error.message)
    return { users: [], tickets: [] }
  }
}

// Save data
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save support data:', error.message)
    return false
  }
}

const TOOLS = [
  {
    name: 'list_users',
    description: 'Get list of all users',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'string',
          description: 'Filter by plan (Free, Pro, Enterprise)',
        },
      },
    },
  },
  {
    name: 'get_user',
    description: 'Get detailed information about a specific user by ID',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'search_user',
    description: 'Search for users by email or name',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (email or name)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_user_tickets',
    description: 'Get all tickets for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
        status: {
          type: 'string',
          description: 'Filter by status (open, in-progress, closed)',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_ticket',
    description: 'Get detailed information about a specific ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID',
        },
      },
      required: ['ticketId'],
    },
  },
  {
    name: 'list_all_tickets',
    description: 'Get all tickets with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status (open, in-progress, closed)',
        },
        priority: {
          type: 'string',
          description: 'Filter by priority (low, medium, high, critical)',
        },
      },
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new support ticket',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID',
        },
        subject: {
          type: 'string',
          description: 'Ticket subject',
        },
        description: {
          type: 'string',
          description: 'Ticket description',
        },
        priority: {
          type: 'string',
          description: 'Priority: low, medium, high, critical',
        },
        category: {
          type: 'string',
          description: 'Category: authentication, billing, feature-question, performance, email, other',
        },
      },
      required: ['userId', 'subject', 'description'],
    },
  },
  {
    name: 'update_ticket',
    description: 'Update ticket status or add resolution',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ticket ID',
        },
        status: {
          type: 'string',
          description: 'New status: open, in-progress, closed',
        },
        resolution: {
          type: 'string',
          description: 'Resolution text (when closing)',
        },
      },
      required: ['ticketId'],
    },
  },
]

async function handleToolCall(name, args) {
  const data = loadData()

  switch (name) {
    case 'list_users': {
      let users = data.users
      if (args?.plan) {
        users = users.filter(u => u.plan === args.plan)
      }

      const formatted = users
        .map(
          u =>
            `ID: ${u.id}\nName: ${u.name}\nEmail: ${u.email}\nPlan: ${u.plan}\nCompany: ${
              u.company || 'N/A'
            }\nRegistered: ${u.registeredAt}\nLast Active: ${u.lastActive}`,
        )
        .join('\n\n---\n\n')

      return `Found ${users.length} user(s):\n\n${formatted}`
    }

    case 'get_user': {
      const userId = args?.userId
      if (!userId) return 'Error: userId is required'

      const user = data.users.find(u => u.id === userId)
      if (!user) return `Error: User ${userId} not found`

      return `User Information:
ID: ${user.id}
Name: ${user.name}
Email: ${user.email}
Phone: ${user.phone}
Plan: ${user.plan}
Company: ${user.company || 'N/A'}
Role: ${user.role}
Registered: ${user.registeredAt}
Last Active: ${user.lastActive}`
    }

    case 'search_user': {
      const query = args?.query?.toLowerCase()
      if (!query) return 'Error: query is required'

      const users = data.users.filter(
        u => u.email.toLowerCase().includes(query) || u.name.toLowerCase().includes(query),
      )

      if (users.length === 0) {
        return `No users found matching "${args.query}"`
      }

      const formatted = users
        .map(u => `ID: ${u.id}\nName: ${u.name}\nEmail: ${u.email}\nPlan: ${u.plan}`)
        .join('\n\n---\n\n')

      return `Found ${users.length} user(s):\n\n${formatted}`
    }

    case 'get_user_tickets': {
      const userId = args?.userId
      if (!userId) return 'Error: userId is required'

      let tickets = data.tickets.filter(t => t.userId === userId)

      if (args?.status) {
        tickets = tickets.filter(t => t.status === args.status)
      }

      if (tickets.length === 0) {
        return `No tickets found for user ${userId}`
      }

      const formatted = tickets
        .map(
          t =>
            `Ticket ID: ${t.id}\nSubject: ${t.subject}\nStatus: ${t.status}\nPriority: ${t.priority}\nCategory: ${
              t.category
            }\nCreated: ${t.createdAt}\n${t.resolution ? `Resolution: ${t.resolution}` : ''}`,
        )
        .join('\n\n---\n\n')

      return `Found ${tickets.length} ticket(s) for user ${userId}:\n\n${formatted}`
    }

    case 'get_ticket': {
      const ticketId = args?.ticketId
      if (!ticketId) return 'Error: ticketId is required'

      const ticket = data.tickets.find(t => t.id === ticketId)
      if (!ticket) return `Error: Ticket ${ticketId} not found`

      const user = data.users.find(u => u.id === ticket.userId)

      return `Ticket Details:
ID: ${ticket.id}
User: ${user ? `${user.name} (${user.email})` : ticket.userId}
Subject: ${ticket.subject}
Description: ${ticket.description}
Status: ${ticket.status}
Priority: ${ticket.priority}
Category: ${ticket.category}
Created: ${ticket.createdAt}
Updated: ${ticket.updatedAt}
Assigned To: ${ticket.assignedTo || 'Unassigned'}
Tags: ${ticket.tags.join(', ')}
${ticket.resolution ? `\nResolution: ${ticket.resolution}` : ''}`
    }

    case 'list_all_tickets': {
      let tickets = data.tickets

      if (args?.status) {
        tickets = tickets.filter(t => t.status === args.status)
      }

      if (args?.priority) {
        tickets = tickets.filter(t => t.priority === args.priority)
      }

      const formatted = tickets
        .map(t => {
          const user = data.users.find(u => u.id === t.userId)
          return `Ticket ID: ${t.id}\nUser: ${user ? user.name : t.userId}\nSubject: ${t.subject}\nStatus: ${
            t.status
          }\nPriority: ${t.priority}\nCategory: ${t.category}\nCreated: ${t.createdAt}`
        })
        .join('\n\n---\n\n')

      return `Found ${tickets.length} ticket(s):\n\n${formatted}`
    }

    case 'create_ticket': {
      const { userId, subject, description, priority = 'medium', category = 'other' } = args

      if (!userId || !subject || !description) {
        return 'Error: userId, subject, and description are required'
      }

      const user = data.users.find(u => u.id === userId)
      if (!user) {
        return `Error: User ${userId} not found`
      }

      const newTicket = {
        id: `ticket-${data.tickets.length + 1}`,
        userId,
        subject,
        description,
        status: 'open',
        priority,
        category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedTo: null,
        tags: [],
      }

      data.tickets.push(newTicket)
      saveData(data)

      return `Ticket created successfully:
ID: ${newTicket.id}
User: ${user.name} (${user.email})
Subject: ${subject}
Priority: ${priority}
Category: ${category}
Status: open`
    }

    case 'update_ticket': {
      const { ticketId, status, resolution } = args

      if (!ticketId) return 'Error: ticketId is required'

      const ticket = data.tickets.find(t => t.id === ticketId)
      if (!ticket) return `Error: Ticket ${ticketId} not found`

      if (status) {
        ticket.status = status
      }

      if (resolution) {
        ticket.resolution = resolution
      }

      ticket.updatedAt = new Date().toISOString()

      saveData(data)

      return `Ticket ${ticketId} updated successfully:
Subject: ${ticket.subject}
Status: ${ticket.status}
${resolution ? `Resolution: ${resolution}` : ''}
Updated: ${ticket.updatedAt}`
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

process.stderr.write(`[support-crm] Started v1.0.0\n`)
