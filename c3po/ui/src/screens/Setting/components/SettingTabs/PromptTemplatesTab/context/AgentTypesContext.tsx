import { useQuery } from "@tanstack/react-query";
import { createContext, useState } from "react";
import { Agent } from "../../../../helpers/types";
import { fetchAgentTypes } from "../../../../helpers/helpers";
import ErrorDialog from "../../../ErrorDialog";

type AgentTypes = {
  agentTypes: Agent[];
  setAgentTypes: (types: Agent[]) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AgentTypesContext = createContext<AgentTypes>({
  agentTypes: [],
  setAgentTypes: () => { },
});

export const AgentTypesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [defaultAgentTypes, setAgentTypes] = useState<Agent[]>([]);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(true);

  const {
    data: agentTypes,
    isLoading: isLoadingAgentTypes,
    error: agentTypesError,
  } = useQuery<Agent[]>({
    queryKey: ["agentTypes"],
    queryFn: async () => {
      const agentTypesResult = await fetchAgentTypes();
      setAgentTypes(agentTypesResult);
      return agentTypesResult;
    },
    retry: false,
    throwOnError: false,
  });


  if (agentTypesError) {
    return (
      <ErrorDialog
        title="Error fetching agent types"
        isErrorDialogOpen={isErrorDialogOpen}
        error={agentTypesError}
        setIsErrorDialogOpen={setIsErrorDialogOpen}
      />
    )
  }

  return (
    <AgentTypesContext.Provider
      value={{
        agentTypes: (isLoadingAgentTypes || agentTypesError) ?
          defaultAgentTypes :
          agentTypes || [],
        setAgentTypes
      }}
    >
      {children}
    </AgentTypesContext.Provider>
  );
};
