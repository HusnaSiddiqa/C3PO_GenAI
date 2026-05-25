import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingSection } from "../../../screens/Setting/SettingsSection";
import { UserContext } from "../../../contexts/UserContext";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../ThemeV2";

// Mock the SettingTabsSection component
vi.mock("../../../screens/Setting/components/SettingTabs", () => ({
  __esModule: true,
  SettingTabsSection: () => <div data-testid="setting-tabs-section" />,
}));

const theme = getTheme("light");

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <UserContext.Provider
        value={{
          user: {
            userId: "test-user",
            userName: "Test User",
            userRole: "admin",
          },
          setUser: vi.fn(),
        }}
      >
        <MemoryRouter>{ui}</MemoryRouter>
      </UserContext.Provider>
    </ThemeProvider>
  );
};

describe("SettingSection", () => {
  it("should render the settings section title and description", () => {
    renderWithProviders(<SettingSection />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Manage all AI Agent functionalities and configurations.")
    ).toBeInTheDocument();
  });

  it("should render the SettingTabsSection component", () => {
    renderWithProviders(<SettingSection />);
    expect(screen.getByTestId("setting-tabs-section")).toBeInTheDocument();
  });
});
