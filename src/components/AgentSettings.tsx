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
  IconButton,
  Switch,
  FormControlLabel,
  Tabs,
  Tab
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-xml-doc';
import 'prismjs/themes/prism-dark.css'; // Or another theme
import { McpSettings } from './settings/McpSettings';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}


interface AgentSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

export const AgentSettings = ({ isOpen, onClose, agentId }: AgentSettingsProps) => {
  const { agents, updateAgent, enabledModels } = useStore();
  const agent = agents.find((a) => a.id === agentId);
  
  const [formData, setFormData] = useState<Partial<AgentConfig>>({});
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };


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
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="agent settings tabs">
            <Tab label="Основные" />
            <Tab label="MCP Серверы" />
          </Tabs>
        </Box>

        <CustomTabPanel value={activeTab} index={0}>
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

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Режим RAG</InputLabel>
            <Select
              value={formData.ragMode || 'off'}
              label="Режим RAG"
              onChange={(e) => handleChange('ragMode', e.target.value)}
            >
              <MenuItem value="off">Выключен (Off)</MenuItem>
              <MenuItem value="hybrid">Гибридный (Hybrid)</MenuItem>
              <MenuItem value="strict">Строгий (Strict)</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {formData.ragMode === 'strict' 
                ? 'Отвечает только по базе знаний. Если ответа нет — молчит.' 
                : formData.ragMode === 'hybrid' 
                  ? 'Использует базу знаний, но может дополнять ответ своими знаниями.' 
                  : 'Использует только свои знания (LLM).'}
            </Typography>
          </FormControl>

          {(formData.ragMode === 'hybrid' || formData.ragMode === 'strict') && (
            <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>Настройки поиска (RAG)</Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography gutterBottom>Порог релевантности: {formData.ragThreshold ?? 0.1}</Typography>
                <Slider
                  value={formData.ragThreshold ?? 0.1}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, value) => handleChange('ragThreshold', value as number)}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Минимальный коэффициент схожести (0-1). Чем выше, тем строже отбор.
                </Typography>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.ragRerank ?? false}
                    onChange={(e) => handleChange('ragRerank', e.target.checked)}
                  />
                }
                label="Включить MMR Reranking"
                sx={{ mt: 2 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
                Улучшает разнообразие результатов, уменьшая дубликаты.
              </Typography>
            </Box>
          )}

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
                onChange={(e) => {
                  const newFormat = e.target.value as 'text' | 'json_object' | 'xml';
                  let newSchema = formData.responseSchema;
                  
                  const DEFAULT_JSON = '{\n  "key": "value"\n}';
                  const DEFAULT_XML = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <element>value</element>\n</root>';

                  if (newFormat === 'json_object') {
                    if (!newSchema || newSchema === DEFAULT_XML) {
                      newSchema = DEFAULT_JSON;
                    }
                  } else if (newFormat === 'xml') {
                    if (!newSchema || newSchema === DEFAULT_JSON) {
                      newSchema = DEFAULT_XML;
                    }
                  }
                  
                  handleChange('responseFormat', newFormat);
                  if (newSchema !== formData.responseSchema) {
                    handleChange('responseSchema', newSchema);
                  }
                }}
              >
                <MenuItem value="text">Текст</MenuItem>
                <MenuItem value="json_object">JSON Объект</MenuItem>
                <MenuItem value="xml">XML</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {(formData.responseFormat === 'json_object' || formData.responseFormat === 'xml') && (
            <Box sx={{ 
              border: 1, 
              borderColor: 'divider', 
              borderRadius: 1, 
              overflow: 'hidden',
              bgcolor: 'action.hover',
              '&:focus-within': {
                borderColor: 'primary.main',
                borderWidth: 2,
              }
            }}>
              <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary">
                  Структура {formData.responseFormat === 'json_object' ? 'JSON' : 'XML'}
                </Typography>
              </Box>
              <Editor
                value={formData.responseSchema || ''}
                onValueChange={(code) => handleChange('responseSchema', code)}
                highlight={(code) => highlight(
                  code, 
                  formData.responseFormat === 'json_object' ? languages.json : languages.xml, 
                  formData.responseFormat === 'json_object' ? 'json' : 'xml'
                )}
                padding={15}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 14,
                  backgroundColor: 'transparent',
                  minHeight: '150px',
                }}
                textareaClassName="focus:outline-none"
              />
            </Box>
          )}

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
              label="Seed"
              type="number"
              value={formData.seed || ''}
              onChange={(e) => handleChange('seed', parseInt(e.target.value) || undefined)}
              helperText="Для воспроизводимых результатов (опционально)"
            />
          </Box>
        </Box>
        </CustomTabPanel>

        <CustomTabPanel value={activeTab} index={1}>
          <McpSettings />
        </CustomTabPanel>

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
};
