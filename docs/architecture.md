# Архитектура проекта Legion

## Обзор

Legion — это веб-интерфейс для AI-агентов, построенный на Next.js 16 с App Router.

## Технологический стек

- **Frontend/Backend**: Next.js 16 (App Router), React 19
- **UI**: Material UI v7 + Emotion (CSS-in-JS)
- **State Management**: Zustand с персистенцией в localStorage
- **AI**: OpenAI-compatible API (OpenRouter, ZAI), MCP SDK

## Структура директорий

```
src/
├── app/                    # Next.js App Router
│   ├── api/mcp/           # API routes для MCP прокси
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Главная страница
├── components/            # React компоненты
│   ├── chat/              # ChatInput, MessageList
│   ├── rag/               # KnowledgeManager
│   ├── settings/          # Настройки (API, MCP, модели)
│   ├── ChatArea.tsx       # Основная область чата
│   ├── Sidebar.tsx        # Боковая панель
│   └── AgentSettings.tsx  # Настройки агента
├── lib/mcp/               # MCP Manager (серверная часть)
├── services/              # Бизнес-логика
│   ├── api.ts             # LLM API клиент
│   ├── mcp.ts             # MCP клиент (браузер)
│   └── rag/               # RAG pipeline и vector store
├── store/                 # Zustand store
│   └── store.ts           # Глобальное состояние
└── types/                 # TypeScript типы
    └── index.ts           # Все интерфейсы
```

## Ключевые компоненты

### LLM Провайдеры

Два провайдера через OpenAI-совместимый API:
- **ZAI** (api.z.ai): Модели `glm-*`
- **OpenRouter**: Все остальные (Claude, GPT, Qwen)

Роутинг автоматический по префиксу модели в `services/api.ts`.

### MCP (Model Context Protocol)

Позволяет агенту использовать внешние инструменты:

1. **Backend proxy** (`app/api/mcp/[id]/route.ts`) — SSE стриминг
2. **McpManager** (`lib/mcp/McpManager.ts`) — управляет subprocess'ами
3. **mcpService** (`services/mcp.ts`) — клиент в браузере

Конфигурация: `mcp-servers.json` в корне проекта.

### RAG (Retrieval-Augmented Generation)

Находится в `services/rag/`:
- `pipeline.ts` — чанкинг и эмбеддинги (@xenova/transformers)
- `store.ts` — векторный индекс в localStorage

Гибридный поиск: 30% семантика + 70% keyword matching.

Режимы: `off`, `hybrid`, `strict`.

### Zustand Store

Единый store в `store/store.ts`:
- `apiKeys` — ключи API
- `agents` — конфигурации агентов
- `sessions` — чат-сессии с историей
- `mcpServers` — MCP серверы и их инструменты
