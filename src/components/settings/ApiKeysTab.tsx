import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

interface ApiKeysTabProps {
  openRouterKey: string;
  setOpenRouterKey: (key: string) => void;
  zaiKey: string;
  setZaiKey: (key: string) => void;
}

export const ApiKeysTab: React.FC<ApiKeysTabProps> = ({
  openRouterKey,
  setOpenRouterKey,
  zaiKey,
  setZaiKey,
}) => {
  return (
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
  );
};
