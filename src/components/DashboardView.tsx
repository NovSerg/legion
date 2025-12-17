'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store/store';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  LinearProgress,
  Chip,
  Alert,
  Skeleton,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  SupportAgent as SupportIcon,
  Code as CodeIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingIcon,
  Group as TeamIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Block as BlockedIcon,
  LocalFireDepartment as FireIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';

interface DashboardData {
  tasks: {
    total: number;
    byStatus: {
      todo: number;
      'in-progress': number;
      review: number;
      done: number;
      blocked: number;
    };
    byPriority: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    overdue: number;
    urgent: Array<{
      id: string;
      title: string;
      priority: string;
      status: string;
      dueDate: string | null;
    }>;
  };
  tickets: {
    total: number;
    open: number;
    critical: number;
    recentOpen: Array<{
      id: string;
      subject: string;
      priority: string;
      createdAt: string;
    }>;
  };
  team: {
    workload: Array<{
      name: string;
      role: string;
      tasksCount: number;
      inProgress: number;
      utilization: number;
    }>;
  };
  recommendations: Array<{
    id: string;
    title: string;
    priority: string;
  }>;
}

const StatCard = ({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) => (
  <Card
    sx={{
      background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
      border: `1px solid ${color}30`,
      height: '100%',
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: `${color}20`,
            color: color,
            display: 'flex',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight="bold" color={color}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.disabled">
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const QuickActionButton = ({
  icon,
  label,
  onClick,
  color = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}) => (
  <Button
    variant="outlined"
    color={color}
    startIcon={icon}
    endIcon={<ArrowIcon />}
    onClick={onClick}
    fullWidth
    sx={{
      py: 2,
      justifyContent: 'flex-start',
      textTransform: 'none',
      fontSize: '1rem',
      '&:hover': {
        transform: 'translateX(4px)',
        transition: 'transform 0.2s',
      },
    }}
  >
    {label}
  </Button>
);

export const DashboardView = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { agents, setCurrentAgent, setCurrentView, createSession, currentAgentId } = useStore();

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 5 seconds to catch MCP updates
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentSwitch = (agentNamePart: string) => {
    const agent = agents.find((a) =>
      a.name.toLowerCase().includes(agentNamePart.toLowerCase())
    );
    if (agent) {
      setCurrentAgent(agent.id);
      createSession(agent.id);
    }
    setCurrentView('chat');
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization > 100) return '#f44336';
    if (utilization > 80) return '#ff9800';
    return '#4caf50';
  };

  const handleTaskClick = (task: { id: string; title: string; priority: string; status: string }) => {
    // Find task agent or use current
    const taskAgent = agents.find(a => a.name.toLowerCase().includes('task'));
    const agentId = taskAgent?.id || currentAgentId || agents[0]?.id;
    
    // Build team workload context
    const teamContext = data?.team.workload
      .map(m => `- ${m.name} (${m.role}): ${m.utilization}% загрузки, ${m.tasksCount} задач`)
      .join('\n') || 'Нет данных о команде';
    
    if (agentId) {
      setCurrentAgent(agentId);
      createSession(agentId);
      
      setTimeout(() => {
        const { addMessage, currentSessionId } = useStore.getState();
        if (currentSessionId) {
          addMessage(currentSessionId, {
            id: `ctx-${Date.now()}`,
            role: 'user',
            content: `Работаем с задачей:\n\n**${task.title}**\n- ID: ${task.id}\n- Приоритет: ${task.priority}\n- Статус: ${task.status}\n\n**Текущая загрузка команды:**\n${teamContext}\n\nЧто нужно сделать с этой задачей?`,
            timestamp: Date.now(),
          });
        }
      }, 100);
    }
    setCurrentView('chat');
  };

  const handleTicketClick = (ticket: { id: string; subject: string; priority: string }) => {
    // Find support agent or use current
    const supportAgent = agents.find(a => a.name.toLowerCase().includes('support'));
    const agentId = supportAgent?.id || currentAgentId || agents[0]?.id;
    
    if (agentId) {
      setCurrentAgent(agentId);
      createSession(agentId);
      
      setTimeout(() => {
        const { addMessage, currentSessionId } = useStore.getState();
        if (currentSessionId) {
          addMessage(currentSessionId, {
            id: `ctx-${Date.now()}`,
            role: 'user',
            content: `Работаем с тикетом:\n\n**${ticket.subject}**\n- ID: ${ticket.id}\n- Приоритет: ${ticket.priority}\n\nКак лучше ответить клиенту?`,
            timestamp: Date.now(),
          });
        }
      }, 100);
    }
    setCurrentView('chat');
  };

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={300} height={60} />
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>
            Повторить
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data) return null;

  return (
    <Box sx={{ p: 4, height: '100%', overflow: 'auto', flex: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            🎯 Командный центр
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Обзор всех систем и быстрый доступ к агентам
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Сбросить демо-данные">
          <IconButton 
            onClick={async () => {
              await fetch('/api/dashboard/reset', { method: 'POST' });
              fetchDashboardData();
            }} 
            color="warning"
          >
            <ReplayIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Обновить данные">
          <IconButton onClick={fetchDashboardData} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Всего задач"
            value={data.tasks.total}
            icon={<TaskIcon />}
            color="#2196f3"
            subtitle={`${data.tasks.byStatus.done} выполнено`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="В работе"
            value={data.tasks.byStatus['in-progress']}
            icon={<ScheduleIcon />}
            color="#ff9800"
            subtitle={`${data.tasks.byStatus.review} на ревью`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Критичные"
            value={data.tasks.byPriority.critical}
            icon={<FireIcon />}
            color="#f44336"
            subtitle={data.tasks.overdue > 0 ? `${data.tasks.overdue} просрочено` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Открытые тикеты"
            value={data.tickets.open}
            icon={<SupportIcon />}
            color="#9c27b0"
            subtitle={data.tickets.critical > 0 ? `${data.tickets.critical} критичных` : undefined}
          />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        {/* Left Column - Urgent Items */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Urgent Attention */}
          {(data.tasks.urgent.length > 0 || data.tickets.critical > 0) && (
            <Card sx={{ mb: 3, borderLeft: '4px solid #f44336' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <WarningIcon color="error" />
                  <Typography variant="h6" fontWeight="bold">
                    Требует внимания
                  </Typography>
                </Box>
                
                {data.tasks.urgent.map((task) => (
                  <Box
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    sx={{
                      p: 2,
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'action.selected',
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <Chip
                      label={task.priority}
                      size="small"
                      color={task.priority === 'critical' ? 'error' : 'warning'}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {task.title}
                    </Typography>
                    <Chip
                      label={task.status}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Team Workload */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <TeamIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">
                  Загрузка команды
                </Typography>
              </Box>

              {data.team.workload.map((member) => (
                <Box key={member.name} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {member.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {member.role} • {member.tasksCount} задач ({member.inProgress} в работе)
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color={getUtilizationColor(member.utilization)}
                    >
                      {member.utilization}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(member.utilization, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: getUtilizationColor(member.utilization),
                      },
                    }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Quick Actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                ⚡ Быстрые действия
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Переключиться на специализированного агента
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <QuickActionButton
                  icon={<TaskIcon />}
                  label="Управление задачами"
                  onClick={() => handleAgentSwitch('task')}
                  color="primary"
                />
                <QuickActionButton
                  icon={<SupportIcon />}
                  label="Поддержка клиентов"
                  onClick={() => handleAgentSwitch('support')}
                  color="secondary"
                />
                <QuickActionButton
                  icon={<CodeIcon />}
                  label="Помощь с кодом"
                  onClick={() => handleAgentSwitch('code')}
                  color="success"
                />
              </Box>
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          {data.tickets.recentOpen.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  📩 Последние тикеты
                </Typography>
                {data.tickets.recentOpen.map((ticket) => (
                  <Box
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket)}
                    sx={{
                      py: 1.5,
                      px: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium" noWrap>
                      {ticket.subject}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={ticket.priority}
                        size="small"
                        color={ticket.priority === 'critical' ? 'error' : 'default'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(ticket.createdAt).toLocaleDateString('ru-RU')}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};
