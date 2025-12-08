import React from 'react';
import { Box, TextField } from '@mui/material';
import { DEFAULT_LM_STUDIO_URL } from '@/constants';

interface ApiKeysTabProps {
  openRouterKey: string;
  setOpenRouterKey: (key: string) => void;
  zaiKey: string;
  setZaiKey: (key: string) => void;
  lmStudioUrl: string;
  setLmStudioUrl: (url: string) => void;
}

export const ApiKeysTab: React.FC<ApiKeysTabProps> = ({
  openRouterKey,
  setOpenRouterKey,
  zaiKey,
  setZaiKey,
  lmStudioUrl,
  setLmStudioUrl,
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
      <TextField
        label="URL LM Studio"
        fullWidth
        value={lmStudioUrl}
        onChange={(e) => setLmStudioUrl(e.target.value)}
        placeholder={DEFAULT_LM_STUDIO_URL}
        helperText="Адрес локального сервера LM Studio (по умолчанию: http://localhost:1234/v1)"
      />
    </Box>
  );
};
