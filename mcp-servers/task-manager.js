#!/usr/bin/env node
/**
 * MCP Server for Task Management
 * Provides tools for managing team tasks, priorities, and workload
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const SERVER_INFO = {
  name: 'task-manager',
  version: '1.0.0',
}

// Path to data file
const DATA_FILE = path.join(__dirname, 'task-data.json')

// Load data
function loadData() {
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to load task data:', error.message)
    return { tasks: [], team: [] }
  }
}

// Save data
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save task data:', error.message)
    return false
  }
}

const TOOLS = [
  {
    name: 'list_tasks',
    description: 'Получить список задач с фильтрацией по статусу, приоритету или исполнителю',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Фильтр по статусу: todo, in-progress, review, done, blocked',
        },
        priority: {
          type: 'string',
          description: 'Фильтр по приоритету: low, medium, high, critical',
        },
        assignee: {
          type: 'string',
          description: 'Фильтр по исполнителю (имя)',
        },
        tags: {
          type: 'string',
          description: 'Фильтр по тегам (через запятую)',
        },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Получить детальную информацию о конкретной задаче по ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'create_task',
    description: 'Создать новую задачу',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Название задачи',
        },
        description: {
          type: 'string',
          description: 'Описание задачи',
        },
        priority: {
          type: 'string',
          description: 'Приоритет: low, medium, high, critical',
        },
        assignee: {
          type: 'string',
          description: 'Исполнитель (имя)',
        },
        tags: {
          type: 'string',
          description: 'Теги через запятую',
        },
        estimate: {
          type: 'number',
          description: 'Оценка времени в часах',
        },
        dueDate: {
          type: 'string',
          description: 'Срок выполнения (ISO 8601 формат)',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'update_task',
    description: 'Обновить статус, приоритет, исполнителя или другие поля задачи',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи',
        },
        status: {
          type: 'string',
          description: 'Новый статус: todo, in-progress, review, done, blocked',
        },
        priority: {
          type: 'string',
          description: 'Новый приоритет: low, medium, high, critical',
        },
        assignee: {
          type: 'string',
          description: 'Новый исполнитель (имя)',
        },
        timeSpent: {
          type: 'number',
          description: 'Добавить затраченное время в часах',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'search_tasks',
    description: 'Поиск задач по тексту в названии или описании',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_stats',
    description: 'Получить статистику по задачам (общее количество, по статусам, приоритетам)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_priorities_recommendation',
    description: 'Получить рекомендации по приоритетам - какие задачи стоит взять в работу первыми',
    inputSchema: {
      type: 'object',
      properties: {
        assignee: {
          type: 'string',
          description: 'Имя исполнителя для персональных рекомендаций',
        },
      },
    },
  },
  {
    name: 'get_team_workload',
    description: 'Получить информацию о текущей загруженности команды',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// Helper: Format task for display
function formatTask(task, detailed = false) {
  const basic = `ID: ${task.id}
Название: ${task.title}
Статус: ${task.status}
Приоритет: ${task.priority}
Исполнитель: ${task.assignee || 'Не назначен'}
Создана: ${new Date(task.createdAt).toLocaleDateString('ru-RU')}
${task.dueDate ? `Срок: ${new Date(task.dueDate).toLocaleDateString('ru-RU')}` : ''}`

  if (!detailed) return basic

  return `${basic}
Описание: ${task.description}
Репортер: ${task.reporter}
Теги: ${task.tags.join(', ')}
Оценка: ${task.estimate || 'Не указана'} ч
Затрачено: ${task.timeSpent || 0} ч
${task.dependencies.length > 0 ? `Зависимости: ${task.dependencies.join(', ')}` : ''}
Обновлена: ${new Date(task.updatedAt).toLocaleString('ru-RU')}`
}

// Tool handlers
async function handleToolCall(name, args) {
  const data = loadData()

  switch (name) {
    case 'list_tasks': {
      let tasks = data.tasks

      // Apply filters
      if (args?.status) {
        tasks = tasks.filter(t => t.status === args.status)
      }
      if (args?.priority) {
        tasks = tasks.filter(t => t.priority === args.priority)
      }
      if (args?.assignee) {
        tasks = tasks.filter(t => t.assignee?.toLowerCase().includes(args.assignee.toLowerCase()))
      }
      if (args?.tags) {
        const filterTags = args.tags.split(',').map(t => t.trim().toLowerCase())
        tasks = tasks.filter(t => t.tags.some(tag => filterTags.includes(tag.toLowerCase())))
      }

      if (tasks.length === 0) {
        return 'Задачи не найдены по заданным фильтрам.'
      }

      const formatted = tasks.map(t => formatTask(t)).join('\n\n---\n\n')
      return `Найдено задач: ${tasks.length}\n\n${formatted}`
    }

    case 'get_task': {
      const taskId = args?.taskId
      if (!taskId) return 'Ошибка: taskId обязателен'

      const task = data.tasks.find(t => t.id === taskId)
      if (!task) return `Ошибка: Задача ${taskId} не найдена`

      return `Детали задачи:\n\n${formatTask(task, true)}`
    }

    case 'create_task': {
      const { title, description, priority = 'medium', assignee, tags, estimate, dueDate } = args

      if (!title || !description) {
        return 'Ошибка: title и description обязательны'
      }

      const newTask = {
        id: `task-${data.tasks.length + 1}`,
        title,
        description,
        status: 'todo',
        priority,
        assignee: assignee || null,
        reporter: 'AI Assistant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: dueDate || null,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        dependencies: [],
        estimate: estimate || null,
        timeSpent: 0,
      }

      data.tasks.push(newTask)
      saveData(data)

      return `Задача успешно создана!\n\n${formatTask(newTask, true)}`
    }

    case 'update_task': {
      const { taskId, status, priority, assignee, timeSpent } = args

      if (!taskId) return 'Ошибка: taskId обязателен'

      const task = data.tasks.find(t => t.id === taskId)
      if (!task) return `Ошибка: Задача ${taskId} не найдена`

      // Update fields
      if (status) task.status = status
      if (priority) task.priority = priority
      if (assignee !== undefined) task.assignee = assignee || null
      if (timeSpent !== undefined) task.timeSpent = (task.timeSpent || 0) + timeSpent

      task.updatedAt = new Date().toISOString()

      saveData(data)

      return `Задача ${taskId} успешно обновлена!\n\n${formatTask(task, true)}`
    }

    case 'search_tasks': {
      const query = args?.query?.toLowerCase()
      if (!query) return 'Ошибка: query обязателен'

      const tasks = data.tasks.filter(
        t => t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query),
      )

      if (tasks.length === 0) {
        return `Задачи по запросу "${args.query}" не найдены.`
      }

      const formatted = tasks.map(t => formatTask(t)).join('\n\n---\n\n')
      return `Найдено задач: ${tasks.length}\n\n${formatted}`
    }

    case 'get_stats': {
      const total = data.tasks.length
      const byStatus = {}
      const byPriority = {}

      data.tasks.forEach(t => {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
      })

      const blocked = data.tasks.filter(t => t.status === 'blocked').length
      const overdue = data.tasks.filter(
        t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done',
      ).length

      return `📊 СТАТИСТИКА ПО ЗАДАЧАМ

Всего задач: ${total}

По статусам:
- К выполнению (todo): ${byStatus.todo || 0}
- В работе (in-progress): ${byStatus['in-progress'] || 0}
- На ревью (review): ${byStatus.review || 0}
- Заблокированы (blocked): ${byStatus.blocked || 0}
- Завершены (done): ${byStatus.done || 0}

По приоритетам:
- Критичные (critical): ${byPriority.critical || 0}
- Высокие (high): ${byPriority.high || 0}
- Средние (medium): ${byPriority.medium || 0}
- Низкие (low): ${byPriority.low || 0}

⚠️ Просрочено: ${overdue}
🚫 Заблокировано: ${blocked}`
    }

    case 'get_priorities_recommendation': {
      const assigneeFilter = args?.assignee

      // Get tasks to consider
      let tasks = data.tasks.filter(t => t.status === 'todo' || t.status === 'in-progress')

      if (assigneeFilter) {
        tasks = tasks.filter(t => !t.assignee || t.assignee.toLowerCase().includes(assigneeFilter.toLowerCase()))
      }

      // Scoring algorithm
      const scored = tasks.map(t => {
        let score = 0

        // Priority weight
        const priorityScore = { critical: 100, high: 50, medium: 20, low: 5 }
        score += priorityScore[t.priority] || 0

        // Overdue tasks get higher priority
        if (t.dueDate && new Date(t.dueDate) < new Date()) {
          score += 75
        }

        // Tasks close to deadline
        if (t.dueDate) {
          const daysUntilDue = (new Date(t.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
          if (daysUntilDue < 3) score += 50
          else if (daysUntilDue < 7) score += 25
        }

        // Tasks with no dependencies are easier to start
        if (t.dependencies.length === 0) {
          score += 10
        }

        // In-progress tasks should be finished
        if (t.status === 'in-progress') {
          score += 30
        }

        return { task: t, score }
      })

      // Sort by score
      scored.sort((a, b) => b.score - a.score)

      const top5 = scored.slice(0, 5)

      if (top5.length === 0) {
        return 'Нет задач для рекомендаций. Все задачи либо выполнены, либо заблокированы.'
      }

      const recommendations = top5
        .map(
          (item, index) =>
            `${index + 1}. ${item.task.title}
   ID: ${item.task.id}
   Приоритет: ${item.task.priority}
   Статус: ${item.task.status}
   Исполнитель: ${item.task.assignee || 'Не назначен'}
   ${item.task.dueDate ? `Срок: ${new Date(item.task.dueDate).toLocaleDateString('ru-RU')}` : ''}
   Причина: ${getReason(item.task, item.score)}`,
        )
        .join('\n\n')

      return `🎯 РЕКОМЕНДАЦИИ ПО ПРИОРИТЕТАМ
${assigneeFilter ? `\nДля: ${assigneeFilter}` : ''}

${recommendations}`
    }

    case 'get_team_workload': {
      const workload = {}

      // Initialize team members
      data.team.forEach(member => {
        workload[member.name] = {
          capacity: member.capacity,
          assigned: 0,
          inProgress: 0,
          tasks: [],
        }
      })

      // Calculate workload
      data.tasks.forEach(t => {
        if (t.assignee && workload[t.assignee]) {
          if (t.status !== 'done') {
            const remaining = (t.estimate || 0) - (t.timeSpent || 0)
            workload[t.assignee].assigned += remaining

            if (t.status === 'in-progress') {
              workload[t.assignee].inProgress++
            }

            workload[t.assignee].tasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              remaining,
            })
          }
        }
      })

      const report = Object.entries(workload)
        .map(([name, data]) => {
          const utilization = ((data.assigned / data.capacity) * 100).toFixed(0)
          const status = utilization > 100 ? '🔴 Перегружен' : utilization > 80 ? '🟡 Высокая' : '🟢 Нормальная'

          return `${name}:
  Загрузка: ${status} (${utilization}%)
  Часов назначено: ${data.assigned.toFixed(1)} / ${data.capacity}
  Задач в работе: ${data.inProgress}
  Всего активных задач: ${data.tasks.length}
  ${
    data.tasks.length > 0
      ? `Задачи:\n    - ${data.tasks.map(t => `${t.id}: ${t.title} (${t.remaining.toFixed(1)}ч)`).join('\n    - ')}`
      : ''
  }`
        })
        .join('\n\n')

      return `👥 ЗАГРУЖЕННОСТЬ КОМАНДЫ\n\n${report}`
    }

    default:
      return `Неизвестный инструмент: ${name}`
  }
}

// Helper: Get reason for recommendation
function getReason(task, score) {
  const reasons = []

  if (task.priority === 'critical') reasons.push('критичный приоритет')
  if (task.priority === 'high') reasons.push('высокий приоритет')

  if (task.dueDate) {
    const daysUntilDue = (new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
    if (daysUntilDue < 0) reasons.push('просрочена')
    else if (daysUntilDue < 3) reasons.push('срок через ' + Math.ceil(daysUntilDue) + ' дн.')
  }

  if (task.status === 'in-progress') reasons.push('уже в работе')
  if (task.dependencies.length === 0) reasons.push('нет зависимостей')

  return reasons.join(', ') || 'готова к работе'
}

// MCP Protocol handlers
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

process.stderr.write(`[task-manager] Started v1.0.0\n`)
