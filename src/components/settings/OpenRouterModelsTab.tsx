import React from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Checkbox,
  ListItemText,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface OpenRouterModelsTabProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadingModels: boolean;
  handleFetchModels: () => void;
  allModels: any[];
  filteredModels: any[];
  selectedModels: string[];
  handleToggleModel: (modelId: string) => void;
}

export const OpenRouterModelsTab: React.FC<OpenRouterModelsTabProps> = ({
  searchQuery,
  setSearchQuery,
  loadingModels,
  handleFetchModels,
  allModels,
  filteredModels,
  selectedModels,
  handleToggleModel,
}) => {
  return (
    <>
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
          <Button onClick={handleFetchModels} sx={{ mt: 1 }}>
            Загрузить модели из OpenRouter
          </Button>
        </Box>
      ) : (
        <List
          sx={{
            flex: 1,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
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
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    minWidth: 100,
                  }}
                >
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
    </>
  );
};
