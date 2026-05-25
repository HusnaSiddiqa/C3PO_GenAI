import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";
import { AgentDetails } from "../../../../helpers/types";

type SelectedAgentDetails = {
  selectedAgentDetails: AgentDetails;
  setSelectedAgentDetails: Dispatch<SetStateAction<AgentDetails>>;
};

const initialValue = {
  model: "",
  temperature: "",
  versionAlias: "",
  prompt: "",
  versions: [],
};

const SelectedAgentDetailsContext = createContext<SelectedAgentDetails>({
  selectedAgentDetails: initialValue,
  setSelectedAgentDetails: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSelectedAgentDetails = () => useContext(SelectedAgentDetailsContext);


export const SelectedAgentDetailsProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<AgentDetails>(initialValue);
  return (
    <SelectedAgentDetailsContext.Provider
      value={{ selectedAgentDetails, setSelectedAgentDetails }}
    >
      {children}
    </SelectedAgentDetailsContext.Provider>
  );
};
