import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Person as UserIcon, SmartToy as BotIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MessageListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, messagesEndRef }) => {
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {messages.map((msg) => (
        <Box
          key={msg.id}
          sx={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 2,
              maxWidth: '80%',
              bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
              color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: 0.7 }}>
              {msg.role === 'user' ? <UserIcon sx={{ fontSize: 16, mr: 1 }} /> : <BotIcon sx={{ fontSize: 16, mr: 1 }} />}
              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                {msg.role === 'user' ? 'Вы' : 'Ассистент'}
              </Typography>
            </Box>
            <Box className="prose" sx={{ '& p': { m: 0 } }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </Box>
            
            {msg.role === 'assistant' && msg.metrics && (
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">
                  ⏱️ {(msg.metrics.latency ? (msg.metrics.latency / 1000).toFixed(2) : 0)}с
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ⚡ {msg.metrics.speed || 0} т/с
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  🪙 {msg.metrics.totalTokens || 0} токенов
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  🤖 {msg.metrics.model}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      ))}
      <div ref={messagesEndRef} />
    </Box>
  );
};
