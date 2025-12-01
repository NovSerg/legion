import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  IconButton
} from '@mui/material';
import {
  Dns as ServerIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useStore } from '@/store/store';
import { mcpService } from '@/services/mcp';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';

export const McpSettings = () => {
  const { mcpServers, removeMcpServer } = useStore();
  const [configContent, setConfigContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetch('/api/mcp/config')
      .then(res => res.json())
      .then(data => setConfigContent(JSON.stringify(data, null, 2)))
      .catch(console.error);
  }, []);

  const handleConnect = (serverId: string) => {
    const server = mcpServers.find(s => s.id === serverId);
    if (server) {
      mcpService.connect(server).catch(console.error);
    }
  };

  const handleDisconnect = (serverId: string) => {
    mcpService.disconnect(serverId);
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      // Validate JSON
      const config = JSON.parse(configContent);
      
      const res = await fetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      setSaveStatus('success');
      mcpService.syncConfig();
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        MCP Servers (Backend Managed)
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Servers are configured via <code>mcp-servers.json</code> in the project root.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Configuration (Editable)</Typography>
        <Paper variant="outlined" sx={{ 
          p: 1, 
          bgcolor: 'background.paper',
          maxHeight: 300,
          overflow: 'auto',
          border: saveStatus === 'error' ? '1px solid red' : undefined
        }}>
          <Editor
            value={configContent}
            onValueChange={setConfigContent}
            highlight={code => highlight(code, languages.json, 'json')}
            padding={10}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 12,
            }}
          />
        </Paper>
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
                variant="contained" 
                size="small" 
                onClick={handleSave} 
                disabled={isSaving}
            >
                {isSaving ? 'Saving...' : 'Save & Sync'}
            </Button>
            {saveStatus === 'success' && (
                <Typography variant="caption" color="success.main">Saved successfully!</Typography>
            )}
            {saveStatus === 'error' && (
                <Typography variant="caption" color="error">Invalid JSON or save failed</Typography>
            )}
        </Box>
      </Box>

      <List>
        {mcpServers.map((server) => (
          <Paper key={server.id} variant="outlined" sx={{ mb: 1 }}>
            <ListItem>
              <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                <ServerIcon color="action" />
              </Box>
              <ListItemText
                primary={server.name}
                secondary={
                  <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" component="span">ID: {server.id}</Typography>
                    {server.error && (
                      <Typography variant="caption" color="error" component="span">
                        Error: {server.error}
                      </Typography>
                    )}
                    {server.status === 'connected' && server.tools && (
                        <Typography variant="caption" color="text.secondary" component="span">
                            {server.tools.length} tools available
                        </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={server.status} 
                  color={getStatusColor(server.status) as any}
                  size="small" 
                  variant="outlined"
                />
                {server.status === 'connected' ? (
                   <Button size="small" onClick={() => handleDisconnect(server.id)}>
                     Disconnect
                   </Button>
                ) : (
                   <Button size="small" onClick={() => handleConnect(server.id)} startIcon={<RefreshIcon />}>
                     Connect
                   </Button>
                )}
                <IconButton edge="end" onClick={() => removeMcpServer(server.id)} color="error" title="Remove from list">
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {server.tools && server.tools.length > 0 && (
                <Box sx={{ px: 2, pb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>Available Tools:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {server.tools.map((tool: any) => (
                            <Chip 
                                key={tool.name} 
                                label={tool.name} 
                                size="small" 
                                sx={{ fontSize: '0.7rem', height: 20 }} 
                                title={tool.description}
                            />
                        ))}
                    </Box>
                </Box>
            )}
          </Paper>
        ))}
        {mcpServers.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            No servers found in config.
          </Typography>
        )}
      </List>
    </Box>
  );
};
