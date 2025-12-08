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
import { Refresh as RefreshIcon, Computer as ComputerIcon } from '@mui/icons-material';

interface LocalModelsTabProps {
  selectedModels: string[];
  handleToggleModel: (modelId: string) => void;
  lmStudioUrl: string;
}

interface LocalModel {
  id: string;
  name: string;
}

export const LocalModelsTab: React.FC<LocalModelsTabProps> = ({
  selectedModels,
  handleToggleModel,
  lmStudioUrl,
}) => {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocalModels = async () => {
    setLoading(true);
    setError(null);
    
    const url = lmStudioUrl || 'http://localhost:1234/v1';
    
    try {
      // Используем proxy для обхода CORS
      const response = await fetch('/api/lm-studio', {
        headers: {
          'x-lm-studio-url': url,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Не удалось подключиться к LM Studio (${response.status})`);
      }
      
      const data = await response.json();
      const models: LocalModel[] = (data.data || []).map((m: any) => ({
        id: `local/${m.id}`,
        name: m.id,
      }));
      
      setLocalModels(models);
      
      if (models.length === 0) {
        setError('LM Studio запущен, но нет загруженных моделей. Загрузите модель в LM Studio.');
      }
    } catch (err: any) {
      console.error('Error fetching local models:', err);
      setError(
        err.message.includes('Failed to fetch') 
          ? 'Не удалось подключиться к серверу. Проверьте, что dev-сервер запущен.'
          : err.message
      );
      setLocalModels([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ComputerIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Локальные модели через LM Studio. Убедитесь, что LM Studio запущен с активным сервером.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            URL: {lmStudioUrl || 'http://localhost:1234/v1'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchLocalModels}
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

      {localModels.length === 0 && !error && !loading && (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>
            Нажмите "Загрузить модели" чтобы получить список доступных моделей из LM Studio.
          </Typography>
        </Box>
      )}

      {localModels.length > 0 && (
        <List
          sx={{
            flex: 1,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          {localModels.map((model) => (
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
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
};
