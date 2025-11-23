import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Checkbox,
  ListItemText,
} from '@mui/material';
import { ZAI_MODELS } from '@/constants';

interface ZaiModelsTabProps {
  selectedModels: string[];
  handleToggleModel: (modelId: string) => void;
}

export const ZaiModelsTab: React.FC<ZaiModelsTabProps> = ({
  selectedModels,
  handleToggleModel,
}) => {
  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Выберите необходимые модели из списка:
        </Typography>
      </Box>

      <List
        sx={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
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
    </>
  );
};
