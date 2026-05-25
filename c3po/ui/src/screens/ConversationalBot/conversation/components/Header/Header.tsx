import { Box, Button, Card, Typography, useTheme } from "@mui/material";
import { ChatsIcon, MoonIcon, NutIcon, SunIcon } from "@phosphor-icons/react";
import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../../../../contexts/UserContext";
import { UserMenu } from "./UserMenu";
import { Readme } from "./Readme";

function Header({
  toggleTheme,
  mode,
}: {
  toggleTheme: () => void;
  mode: "light" | "dark";
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useTheme();
  const { user } = useContext(UserContext);

  const authEnabled = localStorage.getItem("authEnabled");

  let navItems;
  if (authEnabled === "true") {
    navItems = [
      { label: "Chat", icon: <ChatsIcon size={18} />, path: "/" },
      // Only add Settings if user is admin
      ...(user?.userRole === "admin"
        ? [
            {
              label: "Settings",
              icon: <NutIcon size={18} />,
              path: "/settings",
            },
          ]
        : []),
    ];
  } else {
    navItems = [
      { label: "Chat", icon: <ChatsIcon size={18} />, path: "/" },
      { label: "Settings", icon: <NutIcon size={18} />, path: "/settings" },
    ];
  }

  return (
    <Card
      data-testid="header"
      data-mode={mode}
      variant="elevation"
      sx={{ overflow: "unset", zIndex: 1, width: "100%", borderRadius: 0 }}
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
              src="/gilead-logo.svg"
              alt="Gilead Logo"
              style={{ height: "32px", width: "32px" }}
            />
            <img
              src="/c3po.svg"
              alt="C3PO Logo"
              style={{ height: "32px", width: "32px" }}
            />
          </Box>
          <Box display="flex" gap={2}>
            <Box display="flex" gap={1.5}>
              {navItems.map(({ label, icon, path }) => {
                const isActive =
                  label === "Settings"
                    ? pathname.startsWith("/settings")
                    : pathname === "/" || !pathname.startsWith("/settings");

                return (
                  <Button
                    key={label}
                    size="small"
                    onClick={() => {
                      const recentConversationId = sessionStorage.getItem(
                        "recentConversationId"
                      );

                      if (
                        label === "Chat" &&
                        recentConversationId &&
                        recentConversationId !== "/"
                      ) {
                        navigate(`/${recentConversationId}`);
                      } else if (
                        label === "Chat" &&
                        recentConversationId === "/"
                      ) {
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
        <Box display={"flex"} gap={0} alignItems="center">
          <Readme />
          <Box
            onClick={toggleTheme}
            sx={{
              cursor: "pointer",
              paddingX: theme.spacing(2),
              paddingY: theme.spacing(2),
              border: "none",
              backgroundColor: "transparent",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            {mode === "light" ? (
              <SunIcon
                size={19.5}
                color={theme.palette.contrast.grayscale.level50}
              />
            ) : (
              <MoonIcon
                size={19.5}
                color={theme.palette.contrast.grayscale.level50}
              />
            )}
          </Box>
          <UserMenu />
        </Box>
      </Box>
    </Card>
  );
}

export default Header;
