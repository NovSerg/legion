'use client';

import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { UserProfile } from '@/types';

interface UserProfileTabProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
}

export const UserProfileTab: React.FC<UserProfileTabProps> = ({
  profile,
  onChange,
}) => {
  const handleChange = (field: keyof UserProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <PersonIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h6">Профиль пользователя</Typography>
          <Typography variant="body2" color="text.secondary">
            Эта информация будет автоматически добавляться всем агентам
          </Typography>
        </Box>
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={profile.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
        }
        label="Включить персонализацию"
      />

      {profile.enabled && (
        <>
          <Alert severity="info" sx={{ mb: 1 }}>
            Информация из профиля будет автоматически добавлена в системный промпт каждого агента
          </Alert>

          <TextField
            label="Имя"
            fullWidth
            value={profile.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Например: Сергей"
            helperText="Как агенты должны к вам обращаться"
          />

          <TextField
            label="Роль / Профессия"
            fullWidth
            value={profile.role || ''}
            onChange={(e) => handleChange('role', e.target.value)}
            placeholder="Например: Full-stack разработчик, TypeScript, React, Next.js"
            helperText="Ваша специализация для более релевантных ответов"
          />

          <TextField
            label="Предпочтения в общении"
            multiline
            rows={3}
            fullWidth
            value={profile.preferences || ''}
            onChange={(e) => handleChange('preferences', e.target.value)}
            placeholder="Например: Предпочитаю краткие ответы с примерами кода. Русский язык."
            helperText="Как агенты должны формулировать ответы"
          />

          <TextField
            label="Дополнительный контекст"
            multiline
            rows={4}
            fullWidth
            value={profile.context || ''}
            onChange={(e) => handleChange('context', e.target.value)}
            placeholder="Например: Работаю над проектом Legion. Часовой пояс UTC+5. Обычно работаю вечерами."
            helperText="Любая дополнительная информация о вас, проектах, привычках"
          />
        </>
      )}
    </Box>
  );
};
