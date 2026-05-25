import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";
import { Agent } from "../../../../helpers/types";

type PendingAgent = {
    pendingAgent: Agent | null;
    setPendingAgent: Dispatch<SetStateAction<Agent | null>>;
};

const PendingAgentContext = createContext<PendingAgent>({
    pendingAgent: null,
    setPendingAgent: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const usePendingAgent = () => useContext(PendingAgentContext);

export const PendingAgentProvider = ({ children }: { children: React.ReactNode }) => {
    const [pendingAgent, setPendingAgent] = useState<Agent | null>(null);
    return (
        <PendingAgentContext.Provider value={{ pendingAgent, setPendingAgent }}>
            {children}
        </PendingAgentContext.Provider>
    );
};