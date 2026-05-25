import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { RobotIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { fetchSubAgents, isPromptTemplateDirty } from "../../../helpers/helpers";
import { Agent, SubAgent } from "../../../helpers/types";
import AgentTile from "./AgentTile";
import { useInitialAgentDetails } from "./context/InitialAgentDetailsContext";
import { usePendingAgent } from "./context/PendingAgentContext";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { useSelectedAgentDetails } from "./context/SelectedAgentDetailsContext";
import { useShowWarning } from "./context/ShowWarningContext";
import { DirtyChangesWarning } from "../../DirtyChangesWarning";
import ErrorDialog from "../../ErrorDialog";
import { useState } from "react";

const initialAgentDetailsValue = {
  model: "",
  temperature: "",
  versionAlias: "",
  prompt: "",
  versions: [],
};

const SubAgentsList = ({ parentAgent }: { parentAgent: Agent; }) => {
  const theme = useTheme();
  const { showWarning, setShowWarning } = useShowWarning();
  const { pendingAgent, setPendingAgent } = usePendingAgent();
  const { selectedAgentDetails, setSelectedAgentDetails } = useSelectedAgentDetails();
  const {
    initialAgentDetails: initialAgentDetailsState,
    setInitialAgentDetails
  } = useInitialAgentDetails();
  const { selectedAgent, setSelectedAgent } = useSelectedAgent();
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    data: subAgentsList,
    isLoading: isLoadingAgentsList,
  } = useQuery<SubAgent[]>({
    queryKey: ["subAgents", parentAgent.id],
    queryFn: () => fetchSubAgents(parentAgent.name)
      .catch((error) => {
        setIsErrorDialogOpen(true)
        setError(error)
        return []
      }),
    retry: false,
    throwOnError: false,
  });

  const isDirty = isPromptTemplateDirty({
    selectedAgentDetails: selectedAgentDetails,
    initialAgentDetails: initialAgentDetailsState,
  })

  const handleSubAgentClick = (agent: Agent) => {
    if (isDirty) {
      setPendingAgent(agent);
      setShowWarning(true);
    } else {
      setSelectedAgent(agent);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingAgent) {
      setSelectedAgent(pendingAgent);
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

  if (isLoadingAgentsList) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap={theme.spacing(3)}
      >
        <CircularProgress color={"inherit"} size={24} />
        <Typography>Fetching Sub-agents...</Typography>
      </Box>
    );
  }

  return (
    <>
      <ErrorDialog
        title={"No Sub-agents available"}
        isErrorDialogOpen={isErrorDialogOpen}
        error={error}
        setIsErrorDialogOpen={setIsErrorDialogOpen}
      />
      <DirtyChangesWarning
        open={showWarning}
        onClose={handleConfirmSwitch}
        onStay={handleStay}
      />
      <Box
        width="100%"
        sx={{
          paddingLeft: theme.spacing(3),
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(4),
        }}
      >
        {subAgentsList?.map((subAgent) => {
          return (
            <AgentTile
              key={subAgent.id}
              agentName={subAgent.name}
              icon={<RobotIcon />}
              isSelected={selectedAgent?.id === subAgent.id}
              onClick={() => handleSubAgentClick(subAgent)}
              hasSubAgents={false}
              parentAgentID={parentAgent.id}
              isSubAgent
            />
          );
        })}
      </Box>
    </>
  );
};

export default SubAgentsList;