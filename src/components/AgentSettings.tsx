'use client';

import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/store';
import { AgentConfig } from '@/types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Typography,
  Box,
  IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface AgentSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

export const AgentSettings = ({ isOpen, onClose, agentId }: AgentSettingsProps) => {
  const { agents, updateAgent, enabledModels } = useStore();
  const agent = agents.find((a) => a.id === agentId);
  
  const [formData, setFormData] = useState<Partial<AgentConfig>>({});

  useEffect(() => {
    if (agent) {
      setFormData(agent);
    }
  }, [agent, isOpen]);

  if (!agent) return null;

  const handleSave = () => {
    updateAgent(agentId, formData);
    onClose();
  };

  const handleChange = (field: keyof AgentConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Настройки агента
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Имя"
              fullWidth
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
            />
            <FormControl fullWidth>
              <InputLabel>Модель</InputLabel>
              <Select
                value={formData.model || ''}
                label="Модель"
                onChange={(e) => handleChange('model', e.target.value)}
              >
                {enabledModels.map((modelId) => (
                  <MenuItem key={modelId} value={modelId}>
                    {modelId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Системный промпт"
            multiline
            rows={6}
            fullWidth
            value={formData.systemPrompt || ''}
            onChange={(e) => handleChange('systemPrompt', e.target.value)}
            sx={{ fontFamily: 'monospace' }}
          />

          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Typography gutterBottom>Температура: {formData.temperature}</Typography>
              <Slider
                value={formData.temperature || 0.7}
                min={0}
                max={2}
                step={0.1}
                onChange={(_, value) => handleChange('temperature', value as number)}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Контролирует случайность. Низкие значения = более детерминированные ответы.
              </Typography>
            </Box>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Формат ответа</InputLabel>
              <Select
                value={formData.responseFormat || 'text'}
                label="Формат ответа"
                onChange={(e) => handleChange('responseFormat', e.target.value as 'text' | 'json_object')}
              >
                <MenuItem value="text">Текст</MenuItem>
                <MenuItem value="json_object">JSON Объект</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>Top P: {formData.topP || 1}</Typography>
            <Slider
              value={formData.topP || 1}
              onChange={(_, val) => handleChange('topP', val as number)}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              Nucleus sampling. Альтернативный способ контроля случайности.
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Макс. токенов"
              type="number"
              value={formData.maxTokens || ''}
              onChange={(e) => handleChange('maxTokens', parseInt(e.target.value) || undefined)}
              helperText="Максимальное количество токенов в ответе"
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Top K"
              type="number"
              value={formData.topK || ''}
              onChange={(e) => handleChange('topK', parseInt(e.target.value) || undefined)}
              helperText="Ограничивает выбор топ-K токенов (опционально)"
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>Frequency Penalty: {formData.frequencyPenalty || 0}</Typography>
            <Slider
              value={formData.frequencyPenalty || 0}
              onChange={(_, val) => handleChange('frequencyPenalty', val as number)}
              min={-2}
              max={2}
              step={0.1}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              Штраф за частые токены. Уменьшает повторения.
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>Presence Penalty: {formData.presencePenalty || 0}</Typography>
            <Slider
              value={formData.presencePenalty || 0}
              onChange={(_, val) => handleChange('presencePenalty', val as number)}
              min={-2}
              max={2}
              step={0.1}
              valueLabelDisplay="auto"
            />
            <Typography variant="caption" color="text.secondary">
              Штраф за уже присутствующие токены. Поощряет новые темы.
            </Typography>
          </Box>

          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Seed (Зерно)"
              type="number"
              value={formData.seed || ''}
              onChange={(e) => handleChange('seed', parseInt(e.target.value) || undefined)}
              helperText="Для воспроизводимых результатов (опционально)"
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
};
