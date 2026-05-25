import {
  Box,
  useTheme
} from "@mui/material";
import {
  useEffect
} from "react";
import { SuccessTile } from "../../SuccessTile";
import AgentDetailsSection from "./AgentDetailsSection";
import AgentsList from "./AgentsList";
import { AgentTypesProvider } from "./context/AgentTypesContext";
import { InitialAgentDetailsProvider } from "./context/InitialAgentDetailsContext";
import { PendingAgentProvider } from "./context/PendingAgentContext";
import { SelectedAgentProvider, useSelectedAgent } from "./context/SelectedAgentContext";
import { SelectedAgentDetailsProvider } from "./context/SelectedAgentDetailsContext";
import { ShowSuccessProvider, useShowSuccess } from "./context/ShowSuccessContext";
import { ShowWarningProvider } from "./context/ShowWarningContext";
import CreateSubAgent from "./CreateSubAgent";

const PromptTemplates = () => {
  const theme = useTheme();

  const { showSuccess, setShowSuccess } = useShowSuccess();
  const { selectedAgent: currentSelectedAgent } = useSelectedAgent();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (showSuccess) {
      timeoutId = setTimeout(() => setShowSuccess(false), 1000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [setShowSuccess, showSuccess]);

  return (
    <>
      <Box
        sx={{
          paddingX: theme.spacing(8),
          paddingY: theme.spacing(1),
          marginX: theme.spacing(-8),
          borderBottomLeftRadius: theme.spacing(4),
          borderBottomRightRadius: theme.spacing(4),
          transform: `translateY(-${theme.spacing(2)})`,
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.03)",
        }}
      />
      {showSuccess && <SuccessTile visible={showSuccess} />}
      <Box
        width="100%"
        sx={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CreateSubAgent />
        <Box
          flex={1}
          sx={{
            display: "flex",
            flexDirection: "row",
            gap: theme.spacing(8),
          }}
        >
          <Box flex={1}>
            <AgentsList />
          </Box>
          <Box flex={3} minWidth={0}>
            {currentSelectedAgent && (
              <AgentDetailsSection />
            )}
          </Box>
        </Box>
      </Box>
    </>
  )
}

const PromptTemplatesWrapper = () => (
  <AgentTypesProvider>
    <InitialAgentDetailsProvider>
      <PendingAgentProvider>
        <SelectedAgentProvider>
          <SelectedAgentDetailsProvider>
            <ShowWarningProvider>
              <ShowSuccessProvider>
                <PromptTemplates />
              </ShowSuccessProvider>
            </ShowWarningProvider>
          </SelectedAgentDetailsProvider>
        </SelectedAgentProvider>
      </PendingAgentProvider>
    </InitialAgentDetailsProvider>
  </AgentTypesProvider>
);

export default PromptTemplatesWrapper;