import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";
import { Agent } from "../../../../helpers/types";

type SelectedAgent = {
    selectedAgent: Agent | null;
    setSelectedAgent: Dispatch<SetStateAction<Agent | null>>;
};

const SelectedAgentContext = createContext<SelectedAgent>({
    selectedAgent: null,
    setSelectedAgent: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSelectedAgent = () => useContext(SelectedAgentContext);

export const SelectedAgentProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    return (
        <SelectedAgentContext.Provider value={{ selectedAgent, setSelectedAgent }}>
            {children}
        </SelectedAgentContext.Provider>
    );
};