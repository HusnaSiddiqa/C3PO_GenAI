import React, { useState } from 'react';
import {Box, Card, Divider, Tab, Tabs, Typography, useTheme} from '@mui/material';
import { PlusCircleIcon } from "@phosphor-icons/react"
import { AgentOptions } from '../AgentOptions/AgentOptions';
import { HeaderButton } from './HeaderButton';
type SidebarProps = {
    open: boolean;
    startNewConversation: () => void;
    setCurrentConversationId: React.Dispatch<React.SetStateAction<string>>
    setConversationTitle: React.Dispatch<React.SetStateAction<string | undefined>>
    updateConversationTitleInHistory?: (conversationId: string, newTitle: string) => void;
}

const Sidebar = ({ open, startNewConversation, setCurrentConversationId, setConversationTitle, updateConversationTitleInHistory }: SidebarProps) => {
    const theme = useTheme();
    const [selectedTab, setSelectedTab] = useState(0)
    function a11yProps(index: number) {
      return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
      };
    }
    const handleChangeTab = (_: React.SyntheticEvent, newValue: number) => {
      setSelectedTab(newValue);
    };
    return (
      <Card
        variant='elevation'
        sx={{
            width: 0,
            minWidth: open ? '400px' : 0,
            overflowX: 'hidden',
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            transition: 'min-width 0.3s ease-in-out',
            borderRadius: theme.spacing(4),
            height: '100%',
            padding: 0
        }}
      >
          <Box display="flex" flexDirection="column" height="100%" padding={theme.spacing(8)} gap={theme.spacing(8)}>
            <HeaderButton 
              startIcon={<PlusCircleIcon />} 
              sx={{ width: "max-content", textTransform: "none" }} 
              variant="contained" color="secondary"
              onClick={startNewConversation}
              // onClick={() => handleHistory({agentId: "auto"}, true)}
              >
                <Typography variant='p3Bold' color={theme.palette.contrast.fixed.white}>New Chat</Typography>
              </HeaderButton>
            <Divider />
            <Tabs value={selectedTab} onChange={handleChangeTab} aria-label="Chat Options">
              <Tab label="History" {...a11yProps(0)} />
            </Tabs>
            <Box display="flex" flexGrow={1} gap={theme.spacing(8)} flexDirection="column" overflow="hidden">
              {selectedTab === 0 && (<AgentOptions setCurrentConversationId={setCurrentConversationId} setConversationTitle={setConversationTitle} updateConversationTitleInHistory={updateConversationTitleInHistory} />)}
            </Box>
          </Box>
      </Card>
    );
};

export default Sidebar;