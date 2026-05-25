import { FallbackProps } from 'react-error-boundary';
import { Button, Box, Typography, Card, CssBaseline, ThemeProvider } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTheme } from '../../../ThemeV2';
import { ChatsIcon, LinkBreakIcon, UserCircleIcon } from '@phosphor-icons/react';


export function ErrorFallback({ error }: FallbackProps) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [mode] = useState<"light" | "dark">("light")
    const theme = useMemo(() => getTheme(mode), [mode])
    const [errorInfo, setErrorInfo] = useState<Object>()
        ;
    const navItems = [
        { label: "Chat", icon: <ChatsIcon size={18} />, path: "/" }
    ];
    useEffect(() => {
        if (error) {
            setErrorInfo(error.message)
        }
    }, []);

    return (
        <Box>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100vw",
                    justifyContent: "center",
                    alignItems: "center",
                    borderBottom: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                    background: theme.palette.contrast.grayscale.level0,
                    boxShadow: " 0px 0px 24px 0px rgba(0, 0, 0, 0.05)",
                    gap: 0,
                }}>
                    <Box sx={{ width: "100%", height: "100%" }}>
                        <Card
                            variant="elevation"
                            sx={{ overflow: "unset", zIndex: 1, width: "100%" }}
                        >
                            <Box display="flex" justifyContent="space-between">
                                <Box
                                    display="flex"
                                    justifyContent="space-between"
                                    gap={theme.spacing(8)}
                                    alignItems="center"
                                >
                                    <Box display="flex" gap={2}>
                                        <img
                                            src="c3po.svg"
                                            alt="C3PO Logo"
                                            style={{ height: "32px", width: "32px" }}
                                        />
                                    </Box>
                                    <Box display="flex" gap={2}>
                                        <Box display="flex" gap={1.5}>
                                            {navItems.map(({ label, icon, path }) => {
                                                const isActive = label === "Settings"
                                                    ? pathname.startsWith("/settings")
                                                    : pathname === "/" || !pathname.startsWith("/settings");

                                                return (
                                                    <Button
                                                        key={label}
                                                        size="small"
                                                        onClick={() => {
                                                            const recentConversationId = sessionStorage.getItem("recentConversationId");

                                                            if (label === "Chat" && recentConversationId && recentConversationId !== "/") {
                                                                navigate(`/${recentConversationId}`);
                                                            } else if (label === "Chat" && recentConversationId === "/") {
                                                                navigate(path);
                                                            } else if (label === "Settings") {
                                                                navigate(path);
                                                            } else {
                                                                navigate(path || "/");
                                                            }
                                                        }}
                                                        startIcon={icon}
                                                        variant="outlined"
                                                        sx={{
                                                            paddingX: theme.spacing(4),
                                                            paddingY: theme.spacing(2),
                                                            border: "none",
                                                            backgroundColor: isActive
                                                                ? theme.palette.contrast.main.main10
                                                                : "transparent",

                                                            textTransform: "none",
                                                            color: isActive
                                                                ? theme.palette.contrast.main.main100
                                                                : theme.palette.contrast.grayscale.level50,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="p3Bold"
                                                            color={
                                                                isActive
                                                                    ? theme.palette.contrast.main.main100
                                                                    : theme.palette.contrast.grayscale.level50
                                                            }
                                                        >
                                                            {label}
                                                        </Typography>
                                                    </Button>
                                                );
                                            })}
                                        </Box>
                                    </Box>
                                </Box>
                                <Box display={"flex"} gap={2}>
                                    <UserCircleIcon size={19.5} />
                                    <Typography>John Doe</Typography>
                                </Box>
                            </Box>
                        </Card>
                    </Box>
                    <Box sx={{
                        display: "flex",
                        width: "100%",
                        height: "100vh",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        borderRadius: "12px",
                        border: `0px solid ${theme.palette.contrast.grayscale.level10}`,
                        background: theme.palette.contrast.grayscale.level5,
                        padding: "48px",
                    }}>
                        <LinkBreakIcon style={{ alignSelf: "center", marginTop: "308px", }} size={64} />
                        <Typography key={"0"} sx={{
                            alignSelf: "center",
                            color: theme.palette.contrast.grayscale.level75,
                            textAlign: "center",
                            fontFeatureSettings: "'liga' off, 'clig' off",
                            fontFamily: "Proxima Nova",
                            fontSize: "28px",
                            fontStyle: "normal",
                            fontWeight: "700",
                            lineHeight: "normal"
                        }}>Technical issue encountred

                        </Typography>
                        <Typography sx={{  textAlign: "center", alignSelf: "center", }}>{JSON.stringify(errorInfo)} </Typography>
                        <Typography key="1" sx={{
                            color: theme.palette.contrast.grayscale.level75,
                            textAlign: "center",
                            fontFeatureSettings: "'liga' off, 'clig' off",
                            alignSelf: "center",
                            width: "743px",
                            height: "44px",
                            fontFamily: "Proxima Nova",
                            fontSize: "18px",
                            fontStyle: "normal",
                            fontWeight: "400",
                            lineHeight: "normal"
                        }}> 
                        we're facing a temporary issue and couldn't complete your request.
                        Our team is looking into it. For assistance, please reach out to support@example.com
                        </Typography>
                    </Box>
                </Box>
            </ThemeProvider>
        </Box>
    );
}
