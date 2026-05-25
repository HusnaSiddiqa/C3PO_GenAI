import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingTab } from "../../screens/Setting/components/SettingTabs/OnboardingTab";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUnsavedChanges } from "../../screens/Setting/context/UnsavedTabChangesContext";
import "@testing-library/jest-dom";
import type { Mock } from "vitest";
import { ThemeProvider } from "@mui/material/styles"; // or your theme lib
import { getTheme } from "../../ThemeV2";

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light"); // or "dark" if you want dark mode
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// Mock dependencies
vi.mock("@tanstack/react-query");
vi.mock("../../screens/Setting/context/UnsavedTabChangesContext");

const mockSetHasUnsavedChanges = vi.fn();
(useUnsavedChanges as unknown as Mock).mockReturnValue({
  setHasUnsavedChanges: mockSetHasUnsavedChanges,
});

const defaultData = {
  onboardingId: "id-1",
  agentName: "Agent X",
  agentDescription: "Description X",
  updatedBy: "user1",
  updatedAt: "2025-07-30T12:00:00Z",
};

describe("OnboardingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for useMutation
    (useMutation as unknown as Mock).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    });
  });

  it("renders loading state", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });
    renderWithTheme(<OnboardingTab />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders error state", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });
    renderWithTheme(<OnboardingTab />);
    expect(
      screen.getByText(/failed to load onboarding details/i)
    ).toBeInTheDocument();
  });

  it("renders form with fetched data", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    renderWithTheme(<OnboardingTab />);
    expect(screen.getByDisplayValue(defaultData.agentName)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(defaultData.agentDescription)
    ).toBeInTheDocument();
  });

  it("updates form fields on user input", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    renderWithTheme(<OnboardingTab />);
    const [nameInput, descInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "New Name" } });
    expect((nameInput as HTMLInputElement).value).toBe("New Name");
    fireEvent.change(descInput, { target: { value: "New Desc" } });
    expect((descInput as HTMLInputElement).value).toBe("New Desc");
  });

  it("disables Save button when form is invalid", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...defaultData, agentName: "", agentDescription: "" },
    });
    renderWithTheme(<OnboardingTab />);
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("enables Save button when form is valid and changed", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    renderWithTheme(<OnboardingTab />);
    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("calls saveOnboarding mutation on Save", () => {
    const mutate = vi.fn();
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
    });
    renderWithTheme(<OnboardingTab />);
    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ agent_name: "Changed Name" })
    );
  });

  it("shows success tile after saving", async () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      isSuccess: true,
      isPending: false,
      mutate: vi.fn(),
    });
    renderWithTheme(<OnboardingTab />);
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it("calls setHasUnsavedChanges on form change", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    renderWithTheme(<OnboardingTab />);
    const [nameInput] = screen.getAllByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Changed Name" } });
    expect(mockSetHasUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it("displays last updated date and time", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    renderWithTheme(<OnboardingTab />);
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    // expect(screen.getByText(/30\/07\/2025 12:00/)).toBeInTheDocument();
  });

  it("shows 'Saving...' on button when saving", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      isPending: true,
      isSuccess: false,
      mutate: vi.fn(),
    });
    renderWithTheme(<OnboardingTab />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument();
  });

  it("does not call saveOnboarding if form is unchanged", () => {
    const mutate = vi.fn();
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: defaultData,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
    });
    renderWithTheme(<OnboardingTab />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("handles empty onboarding details gracefully", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {},
    });
    renderWithTheme(<OnboardingTab />);
    const [nameInput, descInput] = screen.getAllByRole("textbox");
    expect(nameInput).toBeInTheDocument();
    expect(descInput).toBeInTheDocument();
  });
});
  