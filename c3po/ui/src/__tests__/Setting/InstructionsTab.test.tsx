import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery, useMutation } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import type { Mock } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../ThemeV2";
import { InstructionsTab } from "../../screens/Setting/components/SettingTabs/InstructionsTab";
import * as UnsavedTabChangesContext from "../../screens/Setting/context/UnsavedTabChangesContext";

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

vi.mock("@tanstack/react-query");
vi.mock("../../screens/Setting/context/UnsavedTabChangesContext");

const mockSetHasUnsavedChanges = vi.fn();
(UnsavedTabChangesContext.useUnsavedChanges as Mock).mockReturnValue({
  setHasUnsavedChanges: mockSetHasUnsavedChanges,
});

const mockInstructions = [
  {
    instructionId: "1",
    category: "general_instructions",
    description: "General desc",
    updatedBy: "admin",
    updatedAt: "2024-07-30T10:00:00Z",
  },
  {
    instructionId: "2",
    category: "business_rules",
    description: "Business desc",
    updatedBy: "admin",
    updatedAt: "2024-07-30T10:00:00Z",
  },
  {
    instructionId: "3",
    category: "data_handling_rules",
    description: "Data desc",
    updatedBy: "admin",
    updatedAt: "2024-07-30T10:00:00Z",
  },
];

describe("InstructionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      error: undefined,
    });
    renderWithTheme(<InstructionsTab />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      error: { message: "Failed to load instructions" },
    });
    renderWithTheme(<InstructionsTab />);
    expect(screen.getByText("Failed to load instructions")).toBeInTheDocument();
  });

  it("renders all instruction fields and save buttons", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    const textareas = screen.getAllByRole("textbox");
    expect(textareas).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /Save/i })).toHaveLength(3);
  });

  it("disables save buttons when no changes are made", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    expect(screen.getAllByRole("button", { name: /Save/i })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Save/i })[1]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Save/i })[2]).toBeDisabled();
  });

  it("enables save button when input is changed", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    const [generalInput] = screen.getAllByRole("textbox");
    fireEvent.change(generalInput, { target: { value: "Changed" } });
    expect(screen.getAllByRole("button", { name: /Save/i })[0]).toBeEnabled();
  });

  it("calls updateInstruction and shows success tile on save", async () => {
    const mutate = vi.fn();
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
    });
    renderWithTheme(<InstructionsTab />);
    const [generalInput] = screen.getAllByRole("textbox");
    fireEvent.change(generalInput, { target: { value: "Changed" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);
    expect(mutate).toHaveBeenCalled();
  });

  it("shows success tile after saving", async () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      isSuccess: true,
      isPending: false,
      mutate: vi.fn(),
    });
    renderWithTheme(<InstructionsTab />);
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it("calls setHasUnsavedChanges on form change", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    const [generalInput] = screen.getAllByRole("textbox");
    fireEvent.change(generalInput, { target: { value: "Changed" } });
    expect(mockSetHasUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it("shows last updated date and time", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });

  it("shows 'Save' on button when saving", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      isPending: true,
      isSuccess: false,
      mutate: vi.fn(),
    });
    renderWithTheme(<InstructionsTab />);
    expect(
      screen.getAllByRole("button", { name: /save/i })[0]
    ).toHaveTextContent(/save/i);
  });

  it("does not call updateInstruction if form is unchanged", () => {
    const mutate = vi.fn();
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    (useMutation as unknown as Mock).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
    });
    renderWithTheme(<InstructionsTab />);
    fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("updates form fields on user input", () => {
    (useQuery as unknown as Mock).mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockInstructions,
    });
    renderWithTheme(<InstructionsTab />);
    const [generalInput, businessInput, dataInput] =
      screen.getAllByRole("textbox");

    fireEvent.change(generalInput, { target: { value: "New General" } });
    expect((generalInput as HTMLInputElement).value).toBe("New General");

    fireEvent.change(businessInput, { target: { value: "New Business" } });
    expect((businessInput as HTMLInputElement).value).toBe("New Business");

    fireEvent.change(dataInput, { target: { value: "New Data" } });
    expect((dataInput as HTMLInputElement).value).toBe("New Data");
  });
});
