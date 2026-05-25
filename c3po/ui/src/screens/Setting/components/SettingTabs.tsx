import { Tab, Tabs } from "@mui/material";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUnsavedChanges } from "../context/UnsavedTabChangesContext";
import { DirtyChangesWarning } from "./DirtyChangesWarning";

export const SettingTabsSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [pendingTabIndex, setPendingTabIndex] = useState<number | null>(null);

  const TABS_LABEL = [
    { label: "Onboarding", path: "onboarding" },
    { label: "Instructions", path: "instructions" },
    { label: "Prompt Templates", path: "prompt-templates" },
    { label: "Schema Config", path: "schema-config" },
    { label: "Benchmarking", path: "benchmarking" },
    { label: "Feedback", path: "feedback" },
  ];

  const currentTab = TABS_LABEL.findIndex((tab) =>
    location.pathname.endsWith(tab.path)
  );

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (hasUnsavedChanges) {
      setPendingTabIndex(newValue);
      setShowWarningDialog(true);
    } else {
      navigate(TABS_LABEL[newValue].path);
    }
  };

  const handleLeave = () => {
    setHasUnsavedChanges(false);
    setShowWarningDialog(false);
    if (pendingTabIndex !== null) {
      navigate(TABS_LABEL[pendingTabIndex].path);
      setPendingTabIndex(null);
    }
  };

  return (
    <>
      <Tabs
        value={currentTab === -1 ? 0 : currentTab}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          "& .MuiTabs-scrollButtons": {
            display: "none",
          },
        }}
      >
        {TABS_LABEL.map((tab, index) => (
          <Tab
            key={index}
            label={tab.label}
            sx={(theme) => ({
              ...theme.typography.p1Bold,
              textTransform: "none",
              marginRight: theme.spacing(8),
              color: theme.palette.contrast.grayscale.level50,
              "&.Mui-selected": {
                color: theme.palette.contrast.main.main100,
              },
            })}
          />
        ))}
      </Tabs>
      {showWarningDialog && (
        <DirtyChangesWarning
          onClose={handleLeave}
          onStay={() => setShowWarningDialog(false)}
          open={showWarningDialog}
        />
      )}
    </>
  );
};
