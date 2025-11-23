'use client';

import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { AgentSettings } from '@/components/AgentSettings';
import { SettingsModal } from '@/components/SettingsModal';
import { useStore } from '@/store/store';
import { useState } from 'react';
import { Box } from '@mui/material';

export default function Home() {
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { currentAgentId } = useStore();

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', bgcolor: 'background.default', color: 'text.primary' }}>
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      <ChatArea onOpenAgentSettings={() => setShowAgentSettings(true)} />
      
      <AgentSettings 
        isOpen={showAgentSettings} 
        onClose={() => setShowAgentSettings(false)} 
        agentId={currentAgentId || ''} 
      />
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </Box>
  );
}
