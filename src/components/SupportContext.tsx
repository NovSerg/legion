import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  Chip,
  Autocomplete,
  Alert,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material'
import { User, Ticket, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store/store'
import { mcpService } from '@/services/mcp'

interface SupportUser {
  id: string
  name: string
  email: string
  plan: string
  company?: string
}

interface SupportTicket {
  id: string
  subject: string
  status: string
  priority: string
  description: string
  createdAt: string
}

export const SupportContext: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<SupportUser | null>(null)
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const getSupportServer = () => {
    const servers = useStore.getState().mcpServers
    return servers.find(s => s.name === 'support-crm' && s.status === 'connected')
  }

  const searchUser = async (query: string) => {
    if (!query.trim()) return

    const server = getSupportServer()
    if (!server) {
      alert('Support CRM server is not connected')
      return
    }

    setIsLoading(true)
    try {
      const result = await mcpService.executeTool(server.id, 'search_user', { query })

      if (result && typeof result === 'object' && 'content' in result) {
        const text = (result as any).content[0]?.text || ''

        // Парсим результат
        if (text.includes('No users found')) {
          alert('Пользователь не найден')
          return
        }

        // Простой парсинг - берём первого найденного пользователя
        const idMatch = text.match(/ID: (user-\d+)/)
        const nameMatch = text.match(/Name: (.+)/)
        const emailMatch = text.match(/Email: (.+)/)
        const planMatch = text.match(/Plan: (\w+)/)

        if (idMatch && nameMatch && emailMatch) {
          const user: SupportUser = {
            id: idMatch[1],
            name: nameMatch[1],
            email: emailMatch[1],
            plan: planMatch ? planMatch[1] : 'Unknown',
          }

          setSelectedUser(user)
          await loadUserTickets(user.id)
        }
      }
    } catch (error) {
      console.error('Failed to search user:', error)
      alert('Ошибка при поиске пользователя')
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserTickets = async (userId: string) => {
    const server = getSupportServer()
    if (!server) return

    try {
      const result = await mcpService.executeTool(server.id, 'get_user_tickets', { userId, status: 'open' })

      if (result && typeof result === 'object' && 'content' in result) {
        const text = (result as any).content[0]?.text || ''

        // Парсим тикеты
        const tickets: SupportTicket[] = []
        const ticketBlocks = text.split('---').filter(b => b.includes('Ticket ID:'))

        for (const block of ticketBlocks) {
          const idMatch = block.match(/Ticket ID: (ticket-\d+)/)
          const subjectMatch = block.match(/Subject: (.+)/)
          const statusMatch = block.match(/Status: (\w+)/)
          const priorityMatch = block.match(/Priority: (\w+)/)
          const createdMatch = block.match(/Created: (.+)/)

          if (idMatch && subjectMatch) {
            tickets.push({
              id: idMatch[1],
              subject: subjectMatch[1],
              status: statusMatch ? statusMatch[1] : 'unknown',
              priority: priorityMatch ? priorityMatch[1] : 'medium',
              description: '',
              createdAt: createdMatch ? createdMatch[1] : '',
            })
          }
        }

        setUserTickets(tickets)
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    }
  }

  const loadTicketDetails = async (ticketId: string) => {
    const server = getSupportServer()
    if (!server) return

    try {
      const result = await mcpService.executeTool(server.id, 'get_ticket', { ticketId })

      if (result && typeof result === 'object' && 'content' in result) {
        const text = (result as any).content[0]?.text || ''

        const descMatch = text.match(/Description: (.+?)(?=\nStatus:)/s)

        const ticket = userTickets.find(t => t.id === ticketId)
        if (ticket && descMatch) {
          setSelectedTicket({
            ...ticket,
            description: descMatch[1].trim(),
          })
        }
      }
    } catch (error) {
      console.error('Failed to load ticket details:', error)
    }
  }

  const clearContext = () => {
    setSelectedUser(null)
    setSelectedTicket(null)
    setUserTickets([])
    setSearchQuery('')
  }

  // Формируем контекст для добавления в промпт
  const getContextString = (): string => {
    if (!selectedUser) return ''

    let context = `\n\n=== КОНТЕКСТ ПОДДЕРЖКИ ===\n`
    context += `Пользователь: ${selectedUser.name} (${selectedUser.email})\n`
    context += `Тариф: ${selectedUser.plan}\n`

    if (selectedTicket) {
      context += `\nАктивный тикет:\n`
      context += `ID: ${selectedTicket.id}\n`
      context += `Тема: ${selectedTicket.subject}\n`
      context += `Приоритет: ${selectedTicket.priority}\n`
      context += `Описание: ${selectedTicket.description}\n`
    }

    context += `========================\n`

    return context
  }

  // Сохраняем контекст в store для использования в API
  useEffect(() => {
    const context = getContextString()
    // Здесь можно добавить в store, если нужно
    // useStore.getState().setSupportContext(context);
  }, [selectedUser, selectedTicket])

  return (
    <Box sx={{ mb: 2 }}>
      <Button
        variant="outlined"
        size="small"
        onClick={() => setIsExpanded(!isExpanded)}
        startIcon={<User size={16} />}
        endIcon={isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        fullWidth
        sx={{ justifyContent: 'space-between' }}>
        Контекст поддержки {selectedUser && `(${selectedUser.name})`}
      </Button>

      <Collapse in={isExpanded}>
        <Card sx={{ mt: 1 }} variant="outlined">
          <CardContent>
            {!selectedUser ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Поиск пользователя
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Email или имя..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyPress={e => {
                      if (e.key === 'Enter') searchUser(searchQuery)
                    }}
                  />
                  <Button variant="contained" size="small" onClick={() => searchUser(searchQuery)} disabled={isLoading}>
                    Найти
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                  Примеры: alexey.petrov@example.com, Мария, Дмитрий
                </Alert>
              </Box>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2">{selectedUser.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedUser.email}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip label={selectedUser.plan} size="small" color="primary" />
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={clearContext}>
                    <X size={16} />
                  </IconButton>
                </Box>

                {userTickets.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Открытые тикеты ({userTickets.length})
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {userTickets.map(ticket => (
                        <Card
                          key={ticket.id}
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            bgcolor: selectedTicket?.id === ticket.id ? 'action.selected' : 'background.paper',
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                          onClick={() => loadTicketDetails(ticket.id)}>
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" display="block">
                                  {ticket.subject}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                  <Chip
                                    label={ticket.priority}
                                    size="small"
                                    color={
                                      ticket.priority === 'critical' || ticket.priority === 'high'
                                        ? 'error'
                                        : ticket.priority === 'medium'
                                        ? 'warning'
                                        : 'default'
                                    }
                                    sx={{ height: 18, fontSize: '0.65rem' }}
                                  />
                                  {selectedTicket?.id === ticket.id && (
                                    <Chip
                                      label="активен"
                                      size="small"
                                      color="success"
                                      sx={{ height: 18, fontSize: '0.65rem' }}
                                    />
                                  )}
                                </Box>
                              </Box>
                              <Ticket size={14} />
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  </>
                )}

                {selectedTicket && (
                  <Alert severity="success" sx={{ mt: 2, fontSize: '0.75rem' }}>
                    Контекст активен! Ассистент видит информацию о пользователе и тикете.
                  </Alert>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Collapse>

      {/* Hidden input to pass context - можно использовать для интеграции */}
      {selectedUser && <input type="hidden" id="support-context" value={getContextString()} />}
    </Box>
  )
}
