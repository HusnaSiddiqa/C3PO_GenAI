import { createContext, Dispatch, SetStateAction, useContext, useState } from "react";

type ShowSuccess = {
    showSuccess: boolean;
    setShowSuccess: Dispatch<SetStateAction<boolean>>;
};

const ShowSuccessContext = createContext<ShowSuccess>({
    showSuccess: false,
    setShowSuccess: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useShowSuccess = () => useContext(ShowSuccessContext);

export const ShowSuccessProvider = ({ children }: { children: React.ReactNode }) => {
    const [showSuccess, setShowSuccess] = useState(false);
    return (
        <ShowSuccessContext.Provider value={{ showSuccess: showSuccess, setShowSuccess: setShowSuccess }}>
            {children}
        </ShowSuccessContext.Provider>
    );
};