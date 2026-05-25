import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "../../../helpers/helpers";
import { Agent } from "../../../helpers/types";
import AgentTileContainer from "./AgentTileContainer";

const AgentsList = () => {
  const theme = useTheme();

  const {
    data: agentsList,
    isLoading: isLoadingAgentsList,
    error: agentListError,
  } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    retry: false,
    throwOnError: true,
  });

  if (isLoadingAgentsList) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap={theme.spacing(3)}
      >
        <CircularProgress color={"inherit"} size={24} />
        <Typography>Fetching Agents...</Typography>
      </Box>
    );
  }

  if (agentListError) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Typography color="error" variant="body1">
          {agentListError?.message}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        width="100%"
        sx={{
          maxHeight: {
            sm: "230px",
            md: "280px",
            lg: "400px",
          },
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(4),
        }}
      >
        {agentsList?.map((agent) =>
          <AgentTileContainer
            key={`AgentTileContainer-${agent.id}`}
            agent={agent}
          />)}
      </Box>
    </>
  );
};

export default AgentsList;