import React from 'react';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingTabsSection } from "../../../../screens/Setting/components/SettingTabs";
import { UnsavedChangesDataContext } from "../../../../screens/Setting/context/UnsavedTabChangesContext";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../ThemeV2";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/settings/onboarding" }),
  };
});

vi.mock("../../../../components/WarningComponent/WarningComponent", () => ({
  __esModule: true,
  default: ({ onConfirm, onCancel, open }) =>
    open ? (
      <div data-testid="warning-dialog">
        <button onClick={onCancel}>Stay</button>
        <button onClick={onConfirm}>Leave</button>
      </div>
    ) : null,
}));

const theme = getTheme("light");

const renderWithProviders = (
  ui: React.ReactElement,
  hasUnsavedChanges = false
) => {
  const setHasUnsavedChanges = vi.fn();
  return render(
    <UnsavedChangesDataContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges }}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </UnsavedChangesDataContext.Provider>
  );
};

describe("SettingTabsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all the tabs", () => {
    renderWithProviders(<SettingTabsSection />);
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("Prompt Templates")).toBeInTheDocument();
    expect(screen.getByText("Schema Config")).toBeInTheDocument();
    expect(screen.getByText("Benchmarking")).toBeInTheDocument();
    expect(screen.getByText("Feedback")).toBeInTheDocument();
  });

  it("should navigate to the correct path when a tab is clicked", () => {
    renderWithProviders(<SettingTabsSection />);
    fireEvent.click(screen.getByText("Instructions"));
    expect(mockNavigate).toHaveBeenCalledWith("instructions");
  });

  it("should show warning dialog when changing tabs with unsaved changes", () => {
    renderWithProviders(<SettingTabsSection />, true);
    fireEvent.click(screen.getByText("Instructions"));
    expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
  });

  it('should stay on the current tab when "Stay" is clicked', () => {
    renderWithProviders(<SettingTabsSection />, true);
    fireEvent.click(screen.getByText("Instructions"));
    expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Stay"));
    expect(screen.queryByTestId("warning-dialog")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate to new tab when "Leave" is clicked', () => {
    renderWithProviders(<SettingTabsSection />, true);
    fireEvent.click(screen.getByText("Instructions"));
    expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Leave without saving"));
    expect(screen.queryByTestId("warning-dialog")).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith("instructions");
  });
});
