import { Box, TextField, InputAdornment, IconButton, CircularProgress, Tooltip } from '@mui/material';
import { Send as SendIcon, CompareArrows as CompareIcon } from '@mui/icons-material';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  onCompare: () => void;
  isLoading: boolean;
  agentName: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  onCompare,
  isLoading,
  agentName,
}) => {
  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
      <TextField
        fullWidth
        placeholder={`Сообщение... (введите /help для справки о проекте)`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        multiline
        maxRows={4}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={handleSend} disabled={isLoading || !input.trim()} color="primary">
                {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
              </IconButton>
              <Tooltip title="Сравнить (RAG vs Без RAG)">
                <IconButton onClick={onCompare} disabled={isLoading || !input.trim()} color="secondary">
                  <CompareIcon />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 3,
          }
        }}
      />
    </Box>
  );
};
