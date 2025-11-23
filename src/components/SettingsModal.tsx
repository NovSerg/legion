import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/store';
import { fetchModels } from '@/services/api';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Tabs,
  Tab,

} from '@mui/material';
import { 
  Close as CloseIcon, 
  Key as KeyIcon, 
  Dns as DnsIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ApiKeysTab } from './settings/ApiKeysTab';
import { OpenRouterModelsTab } from './settings/OpenRouterModelsTab';
import { ZaiModelsTab } from './settings/ZaiModelsTab';

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

  // Models State
  const [allModels, setAllModels] = useState<any[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(apiKeys.openRouter || '');
      setZaiKey(apiKeys.zai || '');
      setSelectedModels(enabledModels);
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
        <Typography variant="h6" component="div">Настройки</Typography>
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
          <ApiKeysTab
            openRouterKey={openRouterKey}
            setOpenRouterKey={setOpenRouterKey}
            zaiKey={zaiKey}
            setZaiKey={setZaiKey}
          />
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={1}>
          <OpenRouterModelsTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loadingModels={loadingModels}
            handleFetchModels={handleFetchModels}
            allModels={allModels}
            filteredModels={filteredModels}
            selectedModels={selectedModels}
            handleToggleModel={handleToggleModel}
          />
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={2}>
          <ZaiModelsTab
            selectedModels={selectedModels}
            handleToggleModel={handleToggleModel}
          />
        </CustomTabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
};
