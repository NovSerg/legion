# Стиль кода Legion

## Общие правила

### TypeScript

- Строгая типизация, избегать `any`
- Интерфейсы в `src/types/index.ts`
- Использовать `type` для union types, `interface` для объектов

```typescript
// Хорошо
interface AgentConfig {
  id: string;
  name: string;
  model: string;
}

// Для union types
type RagMode = 'off' | 'hybrid' | 'strict';
```

### React компоненты

- Функциональные компоненты с хуками
- `'use client'` директива для клиентских компонентов
- Props через interface

```typescript
'use client';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  isLoading,
}) => {
  // ...
};
```

### Zustand Store

- Одно хранилище `useStore`
- Actions внутри store
- Persist middleware для localStorage

```typescript
// Получение состояния
const { apiKeys, getCurrentAgent } = useStore();

// Прямой доступ (для async)
const state = useStore.getState();
```

### Material UI

- Использовать `sx` prop для стилей
- Тема через ThemeRegistry
- Иконки из `@mui/icons-material` и `lucide-react`

```typescript
<Box sx={{
  display: 'flex',
  flexDirection: 'column',
  p: 2,
  borderRadius: 2
}}>
```

### API вызовы

- Streaming через fetch + ReadableStream
- Error handling с try/catch
- Metrics (tokens, latency) в ответе

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ stream: true, ... }),
});

const reader = response.body.getReader();
```

## Структура файлов

- Один компонент = один файл
- Именование: PascalCase для компонентов, camelCase для сервисов
- Index файлы только для типов

## Git

- Коммиты на русском или английском
- Ветки: `feature/название`, `fix/название`
