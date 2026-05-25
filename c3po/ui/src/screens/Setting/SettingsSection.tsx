import { Box, Card, Grid, Typography, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { SettingTabsSection } from "./components/SettingTabs";
import { useState } from "react";
import { UnsavedChangesDataContext } from "./context/UnsavedTabChangesContext";

export const SettingSection = () => {
  const theme = useTheme();
  const [hasTabUnsavedChanges, setHasTabUnsavedChanges] = useState(false);

  return (
    <UnsavedChangesDataContext.Provider
      value={{
        hasUnsavedChanges: hasTabUnsavedChanges,
        setHasUnsavedChanges: setHasTabUnsavedChanges,
      }}
    >
      <Box
        flexGrow={1}
        width="80vw"
        display="flex"
        flexWrap="wrap"
        height="calc(100vh - 100px)"
        paddingBlock={theme.spacing(16)}
      >
        <Card
          variant="elevation"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "start",
            width: "100%",
            height: "auto",
          }}
        >
          <Box
            sx={{
              width: "100%",
              overflow: "unset",
              zIndex: 1,
              maxHeight: "100%",
              height: "auto",
            }}
          >
            <Grid
              container
              height={"auto"}
              width="100%"
              rowGap={theme.spacing(8)}
            >
              <Box display="flex" alignItems="center" gap={theme.spacing(8)}>
                <Typography variant="h2">Settings</Typography>
                <Typography
                  sx={{
                    color: (theme) => theme.palette.contrast.grayscale.level50,
                  }}
                >
                  •
                </Typography>
                <Typography
                  variant="p3"
                  sx={{
                    color: (theme) => theme.palette.contrast.grayscale.level50,
                  }}
                >
                  Manage all AI Agent functionalities and configurations.
                </Typography>
              </Box>
            </Grid>
            <Box
              sx={{
                height: "1px",
                backgroundColor: theme.palette.contrast.grayscale.level10,
                marginTop: theme.spacing(8),
                marginX: theme.spacing(-8),
              }}
            />
            <SettingTabsSection />

            <Outlet />
          </Box>
        </Card>
      </Box>
    </UnsavedChangesDataContext.Provider>
  );
};
