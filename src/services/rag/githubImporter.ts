export interface GitHubImportOptions {
  owner: string
  repo: string
  ref?: string // ветка, по умолчанию 'main'
  includePatterns?: string[] // ['*.ts', '*.tsx', '*.md']
  excludeDirs?: string[] // ['node_modules', 'dist', '.git']
  maxFileSize?: number // в байтах, по умолчанию 100KB
}

export interface GitHubFile {
  path: string
  content: string
  url: string
}

interface McpServiceType {
  executeTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>
}

const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  'coverage',
  '__pycache__',
  'vendor',
  'target',
  '.gradle',
  'out',
]

const DEFAULT_INCLUDE_PATTERNS = [
  '*.ts',
  '*.tsx',
  '*.js',
  '*.jsx',
  '*.py',
  '*.java',
  '*.go',
  '*.rs',
  '*.md',
  '*.txt',
  '*.json',
  '*.yaml',
  '*.yml',
]

const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.exe',
  '.dll',
  '.so',
  '.mp4',
  '.mp3',
  '.wav',
  '.avi',
  '.mov',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]

/**
 * Проверка, подходит ли файл под паттерн
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true

  return patterns.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
    const fileName = filePath.split('/').pop() || ''
    return regex.test(fileName)
  })
}

/**
 * Проверка, является ли файл бинарным
 */
function isBinaryFile(filePath: string): boolean {
  const ext = '.' + (filePath.split('.').pop() || '')
  return BINARY_EXTENSIONS.includes(ext.toLowerCase())
}

/**
 * Проверка, находится ли путь в исключенных директориях
 */
function isExcludedPath(path: string, excludeDirs: string[]): boolean {
  const parts = path.split('/')
  return parts.some(part => excludeDirs.includes(part))
}

/**
 * Рекурсивный обход репозитория
 */
async function fetchAllFiles(
  mcpService: McpServiceType,
  serverId: string,
  owner: string,
  repo: string,
  path: string = '',
  ref: string,
  options: GitHubImportOptions,
  onProgress?: (status: string) => void,
): Promise<GitHubFile[]> {
  const files: GitHubFile[] = []

  try {
    onProgress?.(`Scanning ${path || 'root'}...`)

    // Получаем содержимое директории
    const result = await mcpService.executeTool(serverId, 'github_list_repo_contents', {
      owner,
      repo,
      path,
      ref,
    })

    if (!result || typeof result !== 'object' || !('content' in result)) {
      console.warn(`No content for ${path}`)
      return files
    }

    const textContent = (result as { content: Array<{ text?: string }> }).content[0]?.text
    if (!textContent) return files

    // Парсим ответ - GitHub API возвращает список файлов/папок
    // Формат: "📁 dirname (dir) - 0 bytes" или "📄 filename (file) - 1234 bytes"
    const lines = textContent.split('\n')
    const items: Array<{ name: string; type: 'file' | 'dir' }> = []

    for (const line of lines) {
      if (line.includes('📁')) {
        const match = line.match(/📁\s+(.+?)\s+\(dir\)/)
        if (match) items.push({ name: match[1], type: 'dir' })
      } else if (line.includes('📄')) {
        const match = line.match(/📄\s+(.+?)\s+\(file\)/)
        if (match) items.push({ name: match[1], type: 'file' })
      }
    }

    // Обрабатываем каждый элемент
    for (const item of items) {
      const itemPath = path ? `${path}/${item.name}` : item.name

      if (item.type === 'dir') {
        // Проверяем, не исключена ли директория
        const excludeDirs = options.excludeDirs || DEFAULT_EXCLUDE_DIRS
        if (excludeDirs.includes(item.name)) {
          onProgress?.(`Skipping excluded directory: ${itemPath}`)
          continue
        }

        // Рекурсивно обходим директорию
        const subFiles = await fetchAllFiles(mcpService, serverId, owner, repo, itemPath, ref, options, onProgress)
        files.push(...subFiles)
      } else if (item.type === 'file') {
        // Применяем фильтры
        const includePatterns = options.includePatterns || DEFAULT_INCLUDE_PATTERNS
        const excludeDirs = options.excludeDirs || DEFAULT_EXCLUDE_DIRS

        if (isBinaryFile(itemPath)) {
          continue
        }

        if (isExcludedPath(itemPath, excludeDirs)) {
          continue
        }

        if (!matchesPattern(itemPath, includePatterns)) {
          continue
        }

        // Добавляем файл в список
        const githubUrl = `https://github.com/${owner}/${repo}/blob/${ref}/${itemPath}`
        files.push({
          path: itemPath,
          content: '', // Будет заполнено позже
          url: githubUrl,
        })
      }
    }
  } catch (error) {
    console.error(`Error fetching ${path}:`, error)
  }

  return files
}

/**
 * Основная функция импорта GitHub репозитория
 */
export async function importGitHubRepository(
  mcpService: McpServiceType,
  serverId: string,
  options: GitHubImportOptions,
  onProgress?: (status: string, current: number, total: number) => void,
): Promise<{ texts: string[]; metadatas: Record<string, string | number>[] }> {
  const ref = options.ref || 'main'
  const maxFileSize = options.maxFileSize || 100000 // 100KB

  onProgress?.('Starting repository scan...', 0, 0)

  // 1. Получаем список всех файлов
  const files = await fetchAllFiles(
    mcpService,
    serverId,
    options.owner,
    options.repo,
    '',
    ref,
    options,
    (status: string) => onProgress?.(status, 0, 0),
  )

  onProgress?.(`Found ${files.length} files`, 0, files.length)

  if (files.length === 0) {
    throw new Error('No files found or repository is empty')
  }

  if (files.length > 500) {
    throw new Error(
      `Too many files (${files.length}). Please use more specific include patterns or exclude more directories.`,
    )
  }

  // 2. Читаем содержимое файлов
  const texts: string[] = []
  const metadatas: Record<string, string | number>[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    onProgress?.(`Reading ${file.path}...`, i + 1, files.length)

    try {
      const result = await mcpService.executeTool(serverId, 'github_read_file', {
        owner: options.owner,
        repo: options.repo,
        path: file.path,
        ref,
      })

      if (!result || typeof result !== 'object' || !('content' in result)) {
        console.warn(`Failed to read ${file.path}`)
        continue
      }

      const content = (result as { content: Array<{ text?: string }> }).content[0]?.text
      if (!content) continue

      // Извлекаем чистое содержимое (убираем заголовок "--- File: ...")
      const contentLines = content.split('\n')
      const actualContent = contentLines.slice(1).join('\n')

      // Проверяем размер
      if (actualContent.length > maxFileSize) {
        console.warn(`File ${file.path} is too large (${actualContent.length} bytes), skipping`)
        continue
      }

      texts.push(actualContent)
      metadatas.push({
        source: `${options.owner}/${options.repo}/${file.path}`,
        type: 'github',
        githubUrl: file.url,
        repoOwner: options.owner,
        repoName: options.repo,
        filePath: file.path,
        ref,
      })
    } catch (error) {
      console.error(`Failed to read ${file.path}:`, error)
    }
  }

  onProgress?.('Import complete!', texts.length, files.length)

  return { texts, metadatas }
}
