import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Alert,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { Github, ChevronDown, Settings } from 'lucide-react'
import type { GitHubImportOptions } from '@/services/rag/githubImporter'

interface GitHubImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (options: GitHubImportOptions) => Promise<void>
}

export const GitHubImportDialog: React.FC<GitHubImportDialogProps> = ({ isOpen, onClose, onImport }) => {
  const [repoInput, setRepoInput] = useState('')
  const [ref, setRef] = useState('main')
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  // Advanced options
  const [useDefaultFilters, setUseDefaultFilters] = useState(true)
  const [customPatterns, setCustomPatterns] = useState('*.ts, *.tsx, *.md')
  const [excludeDirs, setExcludeDirs] = useState('node_modules, dist, .git, build')

  /**
   * Парсинг ввода пользователя
   * Поддерживает форматы:
   * - owner/repo
   * - https://github.com/owner/repo
   * - https://github.com/owner/repo/tree/branch
   */
  const parseRepoInput = (input: string): { owner: string; repo: string; ref?: string } | null => {
    const trimmed = input.trim()

    // Формат: owner/repo
    if (trimmed.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/)) {
      const [owner, repo] = trimmed.split('/')
      return { owner, repo }
    }

    // Формат: https://github.com/owner/repo
    const urlMatch = trimmed.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/)
    if (urlMatch) {
      const owner = urlMatch[1]
      const repo = urlMatch[2]

      // Проверяем, есть ли /tree/branch в URL
      const branchMatch = trimmed.match(/\/tree\/([a-zA-Z0-9_\/-]+)/)
      const ref = branchMatch ? branchMatch[1] : undefined

      return { owner, repo, ref }
    }

    return null
  }

  const handleImport = async () => {
    setError('')

    const parsed = parseRepoInput(repoInput)
    if (!parsed) {
      setError('Invalid repository format. Use "owner/repo" or GitHub URL.')
      return
    }

    const options: GitHubImportOptions = {
      owner: parsed.owner,
      repo: parsed.repo,
      ref: parsed.ref || ref || 'main',
    }

    // Применяем расширенные настройки, если не используются дефолтные
    if (!useDefaultFilters) {
      options.includePatterns = customPatterns
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)

      options.excludeDirs = excludeDirs
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
    }

    setIsImporting(true)
    setProgress('Starting import...')

    try {
      await onImport(options)
      setProgress('Import complete!')
      setTimeout(() => {
        onClose()
        setRepoInput('')
        setRef('main')
        setProgress('')
        setError('')
      }, 1500)
    } catch (err) {
      setError((err as Error).message)
      setProgress('')
    } finally {
      setIsImporting(false)
    }
  }

  const exampleRepos = [
    { label: 'octocat/Hello-World', value: 'octocat/Hello-World' },
    { label: 'facebook/react', value: 'facebook/react' },
    { label: 'microsoft/vscode', value: 'microsoft/vscode' },
  ]

  return (
    <Dialog open={isOpen} onClose={isImporting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Github size={24} />
        Import GitHub Repository
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Repository Input */}
          <Box>
            <TextField
              fullWidth
              label="Repository"
              placeholder="owner/repo or GitHub URL"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              disabled={isImporting}
              helperText="Example: facebook/react or https://github.com/facebook/react"
            />

            {/* Quick examples */}
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                Examples:
              </Typography>
              {exampleRepos.map(example => (
                <Chip
                  key={example.value}
                  label={example.label}
                  size="small"
                  onClick={() => setRepoInput(example.value)}
                  disabled={isImporting}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* Branch/Ref */}
          <TextField
            fullWidth
            label="Branch/Tag/Commit (optional)"
            placeholder="main"
            value={ref}
            onChange={e => setRef(e.target.value)}
            disabled={isImporting}
            helperText="Leave empty for 'main' branch"
          />

          {/* Advanced options */}
          <Accordion>
            <AccordionSummary expandIcon={<ChevronDown size={20} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings size={18} />
                <Typography variant="body2">Advanced Options</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useDefaultFilters}
                      onChange={e => setUseDefaultFilters(e.target.checked)}
                      disabled={isImporting}
                    />
                  }
                  label="Use default filters (recommended)"
                />

                {!useDefaultFilters && (
                  <>
                    <TextField
                      fullWidth
                      label="Include file patterns"
                      placeholder="*.ts, *.tsx, *.md"
                      value={customPatterns}
                      onChange={e => setCustomPatterns(e.target.value)}
                      disabled={isImporting}
                      helperText="Comma-separated patterns. Use * as wildcard."
                      size="small"
                    />

                    <TextField
                      fullWidth
                      label="Exclude directories"
                      placeholder="node_modules, dist, .git"
                      value={excludeDirs}
                      onChange={e => setExcludeDirs(e.target.value)}
                      disabled={isImporting}
                      helperText="Comma-separated directory names"
                      size="small"
                    />
                  </>
                )}

                <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                  Default filters include common code files (.ts, .js, .py, etc.) and exclude build directories
                  (node_modules, dist, etc.)
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Progress */}
          {isImporting && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {progress}
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Info */}
          {!isImporting && !error && (
            <Alert severity="warning" sx={{ fontSize: '0.85rem' }}>
              <Typography variant="caption" component="div" gutterBottom>
                <strong>GitHub API Limits:</strong>
              </Typography>
              <Typography variant="caption" component="div">
                • Without token: 60 requests/hour
              </Typography>
              <Typography variant="caption" component="div">
                • With GITHUB_TOKEN: 5000 requests/hour
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                Large repositories may hit rate limits. Consider using more specific file patterns.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={isImporting || !repoInput.trim()}
          startIcon={<Github />}>
          {isImporting ? 'Importing...' : 'Import Repository'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
