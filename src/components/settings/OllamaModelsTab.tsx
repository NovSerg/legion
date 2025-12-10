import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Checkbox,
  ListItemText,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Refresh as RefreshIcon, Cloud as CloudIcon } from '@mui/icons-material';

interface OllamaModelsTabProps {
  selectedModels: string[];
  handleToggleModel: (modelId: string) => void;
  ollamaUrl: string;
}

interface OllamaModel {
  id: string;
  name: string;
  size: string;
}

export const OllamaModelsTab: React.FC<OllamaModelsTabProps> = ({
  selectedModels,
  handleToggleModel,
  ollamaUrl,
}) => {
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const fetchOllamaModels = async () => {
    setLoading(true);
    setError(null);
    
    const url = ollamaUrl || 'https://api.novsergdev.org';
    
    try {
      const response = await fetch('/api/ollama', {
        headers: {
          'x-ollama-url': url,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Не удалось подключиться к Ollama (${response.status})`);
      }
      
      const data = await response.json();
      const models: OllamaModel[] = (data.models || []).map((m: any) => ({
        id: `ollama/${m.name}`,
        name: m.name,
        size: formatSize(m.size || 0),
      }));
      
      setOllamaModels(models);
      
      if (models.length === 0) {
        setError('Ollama сервер работает, но нет загруженных моделей.');
      }
    } catch (err: any) {
      console.error('Error fetching Ollama models:', err);
      setError(
        err.message.includes('Failed to fetch') 
          ? 'Не удалось подключиться к серверу. Проверьте, что dev-сервер запущен.'
          : err.message
      );
      setOllamaModels([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CloudIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Модели с Ollama сервера. Выберите модели для использования в чатах.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            URL: {ollamaUrl || 'https://api.novsergdev.org'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchOllamaModels}
          disabled={loading}
          size="small"
        >
          {loading ? 'Загрузка...' : 'Загрузить модели'}
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {ollamaModels.length === 0 && !error && !loading && (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>
            Нажмите "Загрузить модели" чтобы получить список доступных моделей с Ollama сервера.
          </Typography>
        </Box>
      )}

      {ollamaModels.length > 0 && (
        <List
          sx={{
            flex: 1,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          {ollamaModels.map((model) => (
            <ListItem key={model.id} disablePadding>
              <ListItemButton onClick={() => handleToggleModel(model.id)} dense>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selectedModels.includes(model.id)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText
                  primary={model.name}
                  secondary={model.id}
                  primaryTypographyProps={{ fontWeight: 'medium' }}
                />
                <Typography variant="caption" color="text.secondary">
                  {model.size}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
};
