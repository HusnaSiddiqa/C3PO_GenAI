import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";

type ShowWarning = {
    showWarning: boolean;
    setShowWarning: Dispatch<SetStateAction<boolean>>;
};

const ShowWarningContext = createContext<ShowWarning>({
    showWarning: false,
    setShowWarning: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useShowWarning = () => useContext(ShowWarningContext);

export const ShowWarningProvider = ({ children }: { children: React.ReactNode }) => {
    const [showWarning, setShowWarning] = useState(false);
    return (
        <ShowWarningContext.Provider value={{ showWarning, setShowWarning }}>
            {children}
        </ShowWarningContext.Provider>
    );
};