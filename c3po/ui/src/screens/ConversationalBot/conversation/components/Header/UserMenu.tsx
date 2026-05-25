import { Box, Typography, Popover, Paper, useTheme } from "@mui/material";
import { UserCircleIcon, SignOut } from "@phosphor-icons/react";
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserContext,
  UserContextType,
} from "../../../../../contexts/UserContext"; // Adjust path if needed
import { useConfig } from "../../../../../contexts/ConfigContext";

// const userEmail = "irving.b@gilead.com";
// const userName = "Irving B.";

export const UserMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const { user, setUser } = useContext(UserContext) as UserContextType;
  const theme = useTheme();
  const { config } = useConfig();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    sessionStorage.clear();
    localStorage.clear(); // Clear all localStorage (or remove specific keys if needed)
    setUser({
      userId: "",
      userName: "",
      userRole: "",
    }); // Reset user context
    // navigate("/login");
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    const authUrl =
      `${config.okta_auth_url}?` +
      `client_id=${config.okta_client_id}&` +
      `response_type=code&` +
      `scope=openid profile email groups&` +
      `redirect_uri=${config.okta_redirect_uri}&` +
      `state=${state}&` +
      `nonce=${nonce}&` +
      `prompt=login`;

    window.location.href = authUrl;
    handleClose();
  };

  return (
    <>
      <Box
        display="flex"
        gap={0.5}
        alignItems="center"
        onClick={handleClick}
        sx={{
          cursor: "pointer",
          paddingX: theme.spacing(2),
          paddingY: theme.spacing(2),
          border: "none",
          backgroundColor: "transparent",
          borderRadius: "4px",
          "&:hover": {
            backgroundColor: theme.palette.action.hover,
          },
        }}
      >
        <UserCircleIcon
          size={19.5}
          color={theme.palette.contrast.grayscale.level50}
        />
        <Typography
          variant="p3Bold"
          color={theme.palette.contrast.grayscale.level50}
          sx={{
            textTransform: "none",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {user?.userName || "Unknown User"}
        </Typography>
      </Box>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "transparent",
            },
          },
        }}
        disableScrollLock={true}
        disablePortal={false}
      >
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            maxWidth: 400,
            background:
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : "white",
            boxShadow: "0px 0px 24px rgba(0, 0, 0, 0.10)",
            overflow: "hidden",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
          }}
        >
          {/* User Profile Section */}
          <Box
            sx={{
              alignSelf: "stretch",
              padding: "24px",
              overflow: "hidden",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "12px",
              display: "flex",
            }}
          >
            <Box
              sx={{
                width: 336,
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                display: "flex",
              }}
            >
              <Box
                sx={{
                  flex: "1 1 0",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: "12px",
                  display: "flex",
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserCircleIcon
                    size={19.5}
                    color={
                      theme.palette.mode === "dark"
                        ? theme.palette.contrast.grayscale.level50
                        : "#8E8E8E"
                    }
                  />
                </Box>
                <Box
                  sx={{
                    flex: "1 1 0",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <Typography
                    sx={{
                      alignSelf: "stretch",
                      color:
                        theme.palette.mode === "dark"
                          ? theme.palette.contrast.grayscale.level100
                          : "#1E1E1E",
                      fontSize: 16,
                      fontFamily: "Proxima Nova",
                      fontWeight: 700,
                      wordWrap: "break-word",
                    }}
                  >
                    {user?.userName || "Unknown User"}
                  </Typography>
                  <Typography
                    sx={{
                      alignSelf: "stretch",
                      color:
                        theme.palette.mode === "dark"
                          ? theme.palette.contrast.grayscale.level100
                          : "#8E8E8E",
                      fontSize: 14,
                      fontFamily: "Proxima Nova",
                      fontWeight: 400,
                      wordWrap: "break-word",
                    }}
                  >
                    {user?.userId || "No Email"}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Sign Out Section */}
          <Box
            sx={{
              alignSelf: "stretch",
              padding: "24px",
              overflow: "hidden",
              borderTop: "1px solid #E9E9E9",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "flex-start",
              gap: "24px",
              display: "flex",
            }}
          >
            <Box
              sx={{
                alignSelf: "stretch",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "12px",
                display: "flex",
                cursor: "pointer",
              }}
              onClick={handleSignOut}
            >
              <Box
                sx={{
                  flex: "1 1 0",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: "12px",
                  display: "flex",
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SignOut
                    size={18}
                    color={
                      theme.palette.mode === "dark"
                        ? theme.palette.contrast.grayscale.level100
                        : "#8E8E8E"
                    }
                  />
                </Box>
                <Box
                  sx={{
                    flex: "1 1 0",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    display: "flex",
                  }}
                >
                  <Typography
                    sx={{
                      alignSelf: "stretch",
                      color: "#8E8E8E",
                      fontSize: 16,
                      fontFamily: "Proxima Nova",
                      fontWeight: 700,
                      wordWrap: "break-word",
                    }}
                  >
                    Sign Out
                  </Typography>
                  <Typography
                    sx={{
                      alignSelf: "stretch",
                      color: "#8E8E8E",
                      fontSize: 14,
                      fontFamily: "Proxima Nova",
                      fontWeight: 400,
                      wordWrap: "break-word",
                    }}
                  >
                    End your current session and log out.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Popover>
    </>
  );
};
