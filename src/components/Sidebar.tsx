'use client';

import React from 'react';
import { useStore } from '@/store/store';
import { AgentConfig } from '@/types';
import { fetchCredits } from '@/services/api';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Chat as ChatIcon,
  SmartToy as BotIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

interface SidebarProps {
  onOpenSettings: () => void;
}

const drawerWidth = 280;

export const Sidebar = ({ onOpenSettings }: SidebarProps) => {
  const { agents, currentAgentId, setCurrentAgent, addAgent, deleteAgent, sessions, currentSessionId, setCurrentSession, deleteSession, apiKeys } = useStore();
  const [balance, setBalance] = React.useState<number | null>(null);

  React.useEffect(() => {
    const checkBalance = async () => {
      if (apiKeys.openRouter) {
        const credits = await fetchCredits(apiKeys.openRouter);
        setBalance(credits);
      }
    };

    checkBalance();
    const interval = setInterval(checkBalance, 300000); // 5 minutes

    return () => clearInterval(interval);
  }, [apiKeys.openRouter]);

  const handleCreateAgent = () => {
    const newAgent: AgentConfig = {
      id: uuidv4(),
      name: 'Новый агент',
      systemPrompt: 'Ты полезный ИИ-ассистент.',
      model: 'glm-4.6',
      temperature: 0.7,
    };
    addAgent(newAgent);
    setCurrentAgent(newAgent.id);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold' }}>
          Legion
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleCreateAgent}>
          Новый
        </Button>
      </Box>
      <Divider />
      
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <List subheader={<Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>АГЕНТЫ</Typography>}>
          {agents.map((agent) => (
            <ListItem
              key={agent.id}
              disablePadding
              secondaryAction={
                agents.length > 1 && (
                  <IconButton edge="end" aria-label="delete" size="small" onClick={(e) => { e.stopPropagation(); deleteAgent(agent.id); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )
              }
            >
              <ListItemButton
                selected={currentAgentId === agent.id}
                onClick={() => setCurrentAgent(agent.id)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BotIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={agent.name} primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem' }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        
        <Divider sx={{ my: 1 }} />
        
        <List subheader={<Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>ИСТОРИЯ</Typography>}>
          {sessions.map((session) => (
            <ListItem
              key={session.id}
              disablePadding
              secondaryAction={
                <IconButton edge="end" aria-label="delete" size="small" onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={currentSessionId === session.id}
                onClick={() => setCurrentSession(session.id)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ChatIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={session.messages[0]?.content.slice(0, 20) || 'Новый чат'} 
                  primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />
      
      {balance !== null && (
        <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Баланс OpenRouter
          </Typography>
          <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
            ${balance.toFixed(2)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            Обновляется каждые 5 мин
          </Typography>
        </Box>
      )}
      
      <Divider />
      <Box sx={{ p: 1 }}>
        <Button
          fullWidth
          startIcon={<SettingsIcon />}
          onClick={onOpenSettings}
          color="inherit"
          sx={{ justifyContent: 'flex-start' }}
        >
          Настройки
        </Button>
      </Box>
    </Drawer>
  );
};
