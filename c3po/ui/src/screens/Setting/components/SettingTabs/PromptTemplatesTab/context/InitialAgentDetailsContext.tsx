import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";
import { AgentDetails } from "../../../../helpers/types";

const initialValue = {
    model: "",
    temperature: "",
    versionAlias: "",
    prompt: "",
    versions: [],
  };

type InitialAgentDetails = {
  initialAgentDetails: AgentDetails;
  setInitialAgentDetails: Dispatch<SetStateAction<AgentDetails>>;
};

const InitialAgentDetailsContext = createContext<InitialAgentDetails>({
  initialAgentDetails: initialValue,
  setInitialAgentDetails: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useInitialAgentDetails = () => useContext(InitialAgentDetailsContext);

export const InitialAgentDetailsProvider = ({ children }: { children: React.ReactNode }) => {
  const [initialAgentDetails, setInitialAgentDetails] = useState<AgentDetails>(initialValue);
  return (
    <InitialAgentDetailsContext.Provider
      value={{ initialAgentDetails, setInitialAgentDetails }}
    >
      {children}
    </InitialAgentDetailsContext.Provider>
  );
};
