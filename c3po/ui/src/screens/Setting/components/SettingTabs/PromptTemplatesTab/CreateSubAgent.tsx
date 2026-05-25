import { Box, Button, Menu, MenuItem, Typography, useTheme } from "@mui/material";
import { useContext, useState } from "react";
import { Agent } from "../../../helpers/types";
import CreateSubAgentDialog from "./CreateSubAgentDialog";
import { AgentTypesContext } from "./context/AgentTypesContext";
import { AllSubAgentsProvider } from "./context/AllSubAgentsContext";
import { Add } from "@mui/icons-material";

function CreateSubAgent() {
  const theme = useTheme();
  const { agentTypes } = useContext(AgentTypesContext);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box
      alignItems={"center"}
      paddingY={theme.spacing(8)}
      display={"flex"}
    >
      <Box flex={1}>
        <Typography
          variant='p1Bold'
        >
          Prompt Templates
        </Typography>
      </Box>

      <Button
        id="create-agent-button"
        aria-controls={isMenuOpen ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={isMenuOpen ? 'true' : undefined}
        onClick={handleClick}
        startIcon={<Add />}
        variant="contained"
      >
        <Typography
          variant='p3Bold'
          color={theme.palette.contrast.fixed.white}
        >
          Add Agent
        </Typography>
      </Button>
      <Menu
        id="create-agent-menu"
        aria-labelledby="create-agent-button"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'transparent',
            },
          },
        }}
      >
        {
          agentTypes.map((agentType: Agent) => (
            <MenuItem
              key={agentType.id}
              onClick={() => {
                setSelectedAgent(agentType);
                setDialogOpen(true);
                handleMenuClose();
              }}
            >
              {agentType.name}
            </MenuItem>
          ))
        }
      </Menu>
      {
        selectedAgent &&
        <AllSubAgentsProvider>
          <CreateSubAgentDialog
            closeDialog={() => setDialogOpen(false)}
            isDialogOpen={dialogOpen}
            agentType={selectedAgent}
          />
        </AllSubAgentsProvider>
      }
    </Box >
  )
}

export default CreateSubAgent;