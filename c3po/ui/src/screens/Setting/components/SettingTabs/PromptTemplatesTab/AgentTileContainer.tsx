import { Box, Collapse, useTheme } from "@mui/material";
import { RobotIcon } from "@phosphor-icons/react";
import { List } from "phosphor-react";
import { useContext, useState } from "react";
import { Agent } from "../../../helpers/types";
import AgentTile from "./AgentTile";
import { AgentTypesContext } from "./context/AgentTypesContext";
import { useInitialAgentDetails } from "./context/InitialAgentDetailsContext";
import { usePendingAgent } from "./context/PendingAgentContext";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { useSelectedAgentDetails } from "./context/SelectedAgentDetailsContext";
import { useShowWarning } from "./context/ShowWarningContext";
import SubAgentsList from "./SubAgentsList";
import { DirtyChangesWarning } from "../../DirtyChangesWarning";
import { isPromptTemplateDirty } from "../../../helpers/helpers";
import { some } from "lodash";

interface AgentTileContainerProps {
  agent: Agent;
}

const initialAgentDetailsValue = {
  model: "",
  temperature: "",
  versionAlias: "",
  prompt: "",
  versions: [],
};

function AgentTileContainer({
  agent,
}: AgentTileContainerProps) {
  const theme = useTheme();
  const { agentTypes } = useContext(AgentTypesContext);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    selectedAgent: currentSelectedAgent,
    setSelectedAgent: setCurrentSelectedAgent,
  } = useSelectedAgent();
  const isSelected = currentSelectedAgent === agent;
  const hasSubAgents = some(agentTypes, (agentType) => agentType.id == agent.id);

  const { selectedAgentDetails, setSelectedAgentDetails } = useSelectedAgentDetails();
  const {
    initialAgentDetails: initialAgentDetailsState,
    setInitialAgentDetails
  } = useInitialAgentDetails();
  const { pendingAgent, setPendingAgent } = usePendingAgent();
  const { showWarning, setShowWarning } = useShowWarning();

  const isDirty = isPromptTemplateDirty({
    selectedAgentDetails: selectedAgentDetails,
    initialAgentDetails: initialAgentDetailsState,
  })

  const handleAgentClick = (agent: Agent) => {
    if (isDirty) {
      setPendingAgent(agent);
      setShowWarning(true);
    } else {
      setCurrentSelectedAgent(hasSubAgents ? null : agent);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingAgent) {
      const pendingAgentHasSubAgents = some(
        agentTypes,
        (agentType) => agentType.id == pendingAgent.id
      );
      setCurrentSelectedAgent(pendingAgentHasSubAgents ? null : pendingAgent);
    }
    setSelectedAgentDetails(initialAgentDetailsValue);
    setInitialAgentDetails(initialAgentDetailsValue);
    setShowWarning(false);
    setPendingAgent(null);
  };

  const handleStay = () => {
    setShowWarning(false);
    setPendingAgent(null);
  };

  return (
    <Box
      key={`AgentTileWrapper-${agent.id}`}
      display="flex"
      flexDirection="column"
      gap={theme.spacing(2)}
    >
      <DirtyChangesWarning
        open={showWarning}
        onClose={handleConfirmSwitch}
        onStay={handleStay}
      />
      <AgentTile
        key={`AgentTile-${agent.id}`}
        icon={hasSubAgents ? <List /> : <RobotIcon />}
        agentName={agent.name}
        isSelected={isSelected}
        onClick={() => {
          if (hasSubAgents) {
            setIsExpanded(!isExpanded);
          }
          handleAgentClick(agent);
        }}
        hasSubAgents={hasSubAgents}
        parentAgentID={agent.id}
      />
      <Collapse in={hasSubAgents && isExpanded} timeout="auto" unmountOnExit>
        <SubAgentsList
          key={`SubAgentsList-${agent.id}`}
          parentAgent={agent}
        />
      </Collapse>
    </Box>
  );
}

export default AgentTileContainer;