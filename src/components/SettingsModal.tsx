import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/store';
import { fetchCredits, fetchModels } from '@/services/api';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Box,
  Typography,
  Tabs,
  Tab,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Key as KeyIcon, 
  Dns as DnsIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
      style={{ height: '100%', overflow: 'hidden', display: value === index ? 'flex' : 'none', flexDirection: 'column' }}
    >
      {value === index && (
        <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { apiKeys, setApiKey, enabledModels, setEnabledModels } = useStore();
  const [tabValue, setTabValue] = useState(0);
  
  // API Keys State
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [zaiKey, setZaiKey] = useState('');
  const [credits, setCredits] = useState<number | null>(null);

  // Models State
  const [allModels, setAllModels] = useState<any[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const ZAI_MODELS = [
    { id: 'glm-4.6', name: 'GLM-4.6' },
    { id: 'glm-4.5', name: 'GLM-4.5' },
    { id: 'glm-4.5-air', name: 'GLM-4.5 Air' },
    { id: 'glm-4.5-x', name: 'GLM-4.5 X' },
    { id: 'glm-4.5-airx', name: 'GLM-4.5 AirX' },
    { id: 'glm-4.5-flash', name: 'GLM-4.5 Flash' },
  ];

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(apiKeys.openRouter || '');
      setZaiKey(apiKeys.zai || '');
      setSelectedModels(enabledModels);
      
      if (apiKeys.openRouter) {
        fetchCredits(apiKeys.openRouter).then(setCredits);
      }
    }
  }, [apiKeys, isOpen, enabledModels]);

  const handleFetchModels = async () => {
    setLoadingModels(true);
    const models = await fetchModels();
    setAllModels(models);
    setLoadingModels(false);
  };

  const handleToggleModel = (modelId: string) => {
    setSelectedModels(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSave = () => {
    setApiKey('openRouter', openRouterKey);
    setApiKey('zai', zaiKey);
    setEnabledModels(selectedModels);
    onClose();
  };

  const filteredModels = allModels.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, height: '80vh' } }}>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Настройки</Typography>
          {credits !== null && (
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
              OpenRouter: ${credits.toFixed(2)}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)}>
          <Tab icon={<KeyIcon />} iconPosition="start" label="API Ключи" />
          <Tab icon={<DnsIcon />} iconPosition="start" label="Модели OpenRouter" />
          <Tab icon={<DnsIcon />} iconPosition="start" label="Модели ZAI" />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CustomTabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <TextField
                label="API Ключ OpenRouter"
                type="password"
                fullWidth
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-..."
                helperText="Требуется для моделей GPT, Claude, Llama"
              />

            </Box>
            <TextField
              label="API Ключ ZAI"
              type="password"
              fullWidth
              value={zaiKey}
              onChange={(e) => setZaiKey(e.target.value)}
              placeholder="zai-..."
              helperText="Требуется для моделей GLM"
            />
          </Box>
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск моделей OpenRouter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button 
              variant="outlined" 
              startIcon={loadingModels ? <CircularProgress size={20} /> : <RefreshIcon />}
              onClick={handleFetchModels}
              disabled={loadingModels}
            >
              Обновить
            </Button>
          </Box>

          {allModels.length === 0 && !loadingModels ? (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <Typography>Модели не загружены.</Typography>
              <Button onClick={handleFetchModels} sx={{ mt: 1 }}>Загрузить модели из OpenRouter</Button>
            </Box>
          ) : (
            <List sx={{ flex: 1, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {filteredModels.map((model) => (
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 100 }}>
                      {model.pricing?.prompt && (
                        <Typography variant="caption" color="text.secondary">
                          Вход: ${parseFloat(model.pricing.prompt) * 1000000}/1M
                        </Typography>
                      )}
                      {model.pricing?.completion && (
                        <Typography variant="caption" color="text.secondary">
                          Выход: ${parseFloat(model.pricing.completion) * 1000000}/1M
                        </Typography>
                      )}
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 2 }}>
             <Typography variant="body2" color="text.secondary">
              Выберите необходимые модели из списка:
            </Typography>
          </Box>

          <List sx={{ flex: 1, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {ZAI_MODELS.map((model) => (
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
        </CustomTabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
};
