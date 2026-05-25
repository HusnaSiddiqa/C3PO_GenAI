import {
    Backdrop,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ThemeProvider,
    useTheme
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { fetchConfig } from "../screens/Setting/helpers/helpers";
import { ConfigData } from "../screens/Setting/helpers/types";

type Config = {
    config: ConfigData;
    setConfig: (config: ConfigData) => void;
};

const emptyConfig = {
    admin_ad_group: '',
    admin_secret: '',
    app_default_user_id: '',
    app_title: '',
    chat_mgr_secret: '',
    okta_auth_url: '',
    okta_client_id: '',
    okta_redirect_uri: '',
    support_email: '',
    enable_source_selector: '',
};
// eslint-disable-next-line react-refresh/only-export-components
export const ConfigContext = createContext<Config>({
    config: emptyConfig,
    setConfig: () => { },
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [configData, setConfigData] = useState<ConfigData | null>();

    const {
        isLoading: isLoadingConfig,
        error: configError,
    } = useQuery<ConfigData>({
        queryKey: ["config"],
        queryFn: async () => {
            const config = await fetchConfig()
            setConfigData(config);
            return config;
        },
        retry: false,
        throwOnError: false,
    });

    const theme = useTheme();

    if (configError) {
        return (
            <ThemeProvider theme={theme}>
                <Dialog open>
                    <DialogTitle>
                        Error loading config
                    </DialogTitle>
                    <DialogContent>
                        {configError.message}
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="contained"
                            onClick={() => window.location.reload()}
                        >
                            Refresh page
                        </Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>
        )
    }

    const shouldDisplayBackdrop = isLoadingConfig || !configData;

    return (
        shouldDisplayBackdrop ?
            <Backdrop open={shouldDisplayBackdrop}>
                <CircularProgress />
            </Backdrop> :
            <ConfigContext.Provider
                value={{
                    config: configData,
                    setConfig: setConfigData
                }}
            >
                {children}
            </ConfigContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useConfig = () => useContext(ConfigContext);

