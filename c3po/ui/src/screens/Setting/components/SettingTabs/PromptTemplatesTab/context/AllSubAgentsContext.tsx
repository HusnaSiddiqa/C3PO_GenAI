import { useQuery } from "@tanstack/react-query";
import { createContext, useState } from "react";
import { fetchAllSubAgents } from "../../../../helpers/helpers";
import { SubAgent } from "../../../../helpers/types";
import ErrorDialog from "../../../ErrorDialog";

type AllSubAgents = {
  allSubAgents: SubAgent[];
  setAllSubAgents: (types: SubAgent[]) => void;
};

// eslint-disable-next-line react-refresh/only-export-components
export const AllSubAgentsContext = createContext<AllSubAgents>({
  allSubAgents: [],
  setAllSubAgents: () => { },
});

export const AllSubAgentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allSubAgents, setAllSubAgents] = useState<SubAgent[]>([]);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(true);

  const {
    data: agentTypes,
    isLoading: isLoadingAllSubAgents,
    error: allSubAgentsError,
  } = useQuery<SubAgent[]>({
    queryKey: ["allSubAgents"],
    queryFn: async () => {
      const allSubAgentsResult = await fetchAllSubAgents();
      setAllSubAgents(allSubAgentsResult);
      return allSubAgentsResult;
    },
    retry: false,
    throwOnError: false,
  });

  return (
    <AllSubAgentsContext.Provider
      value={{
        allSubAgents: (isLoadingAllSubAgents || allSubAgentsError) ?
          allSubAgents :
          agentTypes || [],
        setAllSubAgents: setAllSubAgents
      }}
    >
      {
        allSubAgentsError &&
        <ErrorDialog
          title="Error fetching all sub-agents"
          isErrorDialogOpen={isErrorDialogOpen}
          error={allSubAgentsError}
          setIsErrorDialogOpen={setIsErrorDialogOpen}
        />
      }
      {children}
    </AllSubAgentsContext.Provider>
  );
};
