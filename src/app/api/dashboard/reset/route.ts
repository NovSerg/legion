import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Original demo data
const DEMO_TASK_DATA = {
  tasks: [
    {
      id: "task-1",
      title: "🔴 СРОЧНО: Упал продакшн сервер API",
      description: "Клиенты сообщают об ошибке 502. Нужно срочно проверить логи и перезапустить сервисы.",
      status: "todo",
      priority: "critical",
      assignee: null,
      reporter: "Мониторинг",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      tags: ["incident", "production", "urgent"],
      dependencies: [],
      estimate: 2,
      timeSpent: 0
    },
    {
      id: "task-2",
      title: "Исправить баг с зависанием при загрузке больших файлов",
      description: "При загрузке файлов более 5MB браузер зависает. Нужен chunked upload.",
      status: "in-progress",
      priority: "high",
      assignee: "Мария Иванова",
      reporter: "Дмитрий Соколов",
      createdAt: "2025-12-17T14:30:00Z",
      updatedAt: "2025-12-18T00:20:00Z",
      dueDate: "2025-12-18T18:00:00Z",
      tags: ["bug", "performance"],
      dependencies: [],
      estimate: 5,
      timeSpent: 3
    },
    {
      id: "task-3",
      title: "Добавить экспорт отчётов в PDF",
      description: "Пользователи просят возможность экспортировать аналитику в PDF.",
      status: "todo",
      priority: "high",
      assignee: null,
      reporter: "Алексей Петров",
      createdAt: "2025-12-16T10:00:00Z",
      updatedAt: "2025-12-16T10:00:00Z",
      dueDate: "2025-12-17T23:59:00Z",
      tags: ["feature", "export"],
      dependencies: [],
      estimate: 8,
      timeSpent: 0
    },
    {
      id: "task-4",
      title: "Ревью PR #142: Новый дашборд аналитики",
      description: "Нужно проверить код и дать фидбэк по архитектуре.",
      status: "review",
      priority: "medium",
      assignee: "Иван Смирнов",
      reporter: "Мария Иванова",
      createdAt: "2025-12-17T09:00:00Z",
      updatedAt: "2025-12-17T18:00:00Z",
      dueDate: "2025-12-18T12:00:00Z",
      tags: ["review", "frontend"],
      dependencies: [],
      estimate: 3,
      timeSpent: 1
    },
    {
      id: "task-5",
      title: "Интеграция с GitHub Issues через MCP",
      description: "Добавить возможность импортировать Issues из GitHub.",
      status: "blocked",
      priority: "medium",
      assignee: "Дмитрий Соколов",
      reporter: "Алексей Петров",
      createdAt: "2025-12-15T08:00:00Z",
      updatedAt: "2025-12-17T10:30:00Z",
      dueDate: "2025-12-20T23:59:00Z",
      tags: ["integration", "github"],
      dependencies: ["task-6"],
      estimate: 10,
      timeSpent: 2
    },
    {
      id: "task-6",
      title: "Обновить MCP SDK до v2.0",
      description: "Новая версия SDK требуется для интеграции с GitHub.",
      status: "in-progress",
      priority: "medium",
      assignee: "Иван Смирнов",
      reporter: "Дмитрий Соколов",
      createdAt: "2025-12-16T13:00:00Z",
      updatedAt: "2025-12-17T15:00:00Z",
      dueDate: "2025-12-18T23:59:00Z",
      tags: ["dependencies", "mcp"],
      dependencies: [],
      estimate: 4,
      timeSpent: 2
    },
    {
      id: "task-7",
      title: "Написать документацию для API",
      description: "Создать OpenAPI спецификацию и README для разработчиков.",
      status: "todo",
      priority: "low",
      assignee: null,
      reporter: "Product Owner",
      createdAt: "2025-12-10T10:00:00Z",
      updatedAt: "2025-12-10T10:00:00Z",
      dueDate: "2025-12-25T23:59:00Z",
      tags: ["documentation"],
      dependencies: [],
      estimate: 6,
      timeSpent: 0
    },
    {
      id: "task-8",
      title: "Настроить CI/CD pipeline",
      description: "Автоматизировать тестирование и деплой через GitHub Actions.",
      status: "done",
      priority: "high",
      assignee: "Иван Смирнов",
      reporter: "DevOps",
      createdAt: "2025-12-12T10:00:00Z",
      updatedAt: "2025-12-17T18:00:00Z",
      tags: ["devops", "automation"],
      dependencies: [],
      estimate: 10,
      timeSpent: 12
    }
  ],
  team: [
    { id: "user-1", name: "Алексей Петров", role: "Team Lead", capacity: 40 },
    { id: "user-2", name: "Мария Иванова", role: "Full Stack Developer", capacity: 40 },
    { id: "user-3", name: "Иван Смирнов", role: "Backend Developer", capacity: 40 },
    { id: "user-4", name: "Дмитрий Соколов", role: "Frontend Developer", capacity: 40 }
  ]
};

const DEMO_SUPPORT_DATA = {
  users: [
    { id: "user-1", name: "Алексей Петров", email: "alexey@example.com", phone: "+7 (999) 123-45-67", plan: "Enterprise", registeredAt: "2024-01-15T10:00:00Z", lastActive: new Date().toISOString(), company: "ООО МегаТех", role: "CTO" },
    { id: "user-2", name: "Елена Смирнова", email: "elena@startup.io", phone: "+7 (999) 234-56-78", plan: "Pro", registeredAt: "2024-06-20T14:20:00Z", lastActive: new Date().toISOString(), company: "Startup.io", role: "Product Manager" },
    { id: "user-3", name: "Дмитрий Козлов", email: "dmitry@freelance.dev", phone: "+7 (999) 345-67-89", plan: "Free", registeredAt: "2025-11-10T08:00:00Z", lastActive: "2025-12-17T20:45:00Z", company: null, role: "Freelancer" }
  ],
  tickets: [
    { id: "ticket-1", userId: "user-1", subject: "🔴 API не отвечает уже 30 минут!", description: "Наш продакшн полностью лежит. Все клиенты жалуются. Это критично!", status: "open", priority: "critical", category: "performance", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assignedTo: null, tags: ["urgent", "api", "outage"] },
    { id: "ticket-2", userId: "user-2", subject: "Не работает экспорт в Excel", description: "При попытке экспортировать отчёт в Excel получаю пустой файл.", status: "open", priority: "high", category: "feature-question", createdAt: "2025-12-17T18:30:00Z", updatedAt: "2025-12-17T18:30:00Z", assignedTo: null, tags: ["export", "bug"] },
    { id: "ticket-3", userId: "user-3", subject: "Как подключить MCP сервер?", description: "Не понимаю как настроить свой MCP сервер.", status: "open", priority: "medium", category: "feature-question", createdAt: "2025-12-17T15:00:00Z", updatedAt: "2025-12-17T15:00:00Z", assignedTo: null, tags: ["mcp", "help"] },
    { id: "ticket-4", userId: "user-2", subject: "Вопрос по биллингу Pro плана", description: "Есть ли скидка при оплате за год?", status: "in-progress", priority: "low", category: "billing", createdAt: "2025-12-16T10:00:00Z", updatedAt: "2025-12-17T09:00:00Z", assignedTo: "support-agent-1", tags: ["billing"] },
    { id: "ticket-5", userId: "user-1", subject: "Запрос на интеграцию с Jira", description: "Было бы здорово иметь интеграцию с Jira.", status: "closed", priority: "medium", category: "feature-question", createdAt: "2025-12-10T14:00:00Z", updatedAt: "2025-12-12T11:00:00Z", assignedTo: "support-agent-1", resolution: "Добавили в roadmap на Q1 2025.", tags: ["feature-request"] }
  ]
};

export async function POST() {
  try {
    const taskPath = path.join(process.cwd(), 'mcp-servers', 'task-data.json');
    const supportPath = path.join(process.cwd(), 'mcp-servers', 'support-data.json');

    fs.writeFileSync(taskPath, JSON.stringify(DEMO_TASK_DATA, null, 2), 'utf-8');
    fs.writeFileSync(supportPath, JSON.stringify(DEMO_SUPPORT_DATA, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Demo data reset successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
