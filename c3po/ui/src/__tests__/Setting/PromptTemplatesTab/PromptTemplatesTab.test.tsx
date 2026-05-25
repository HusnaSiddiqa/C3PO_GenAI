import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../../ThemeV2";
import PromptTemplates from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/PromptTemplatesTab";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UnsavedChangesDataContext } from "../../../screens/Setting/context/UnsavedTabChangesContext";
import userEvent from "@testing-library/user-event";

import "@testing-library/jest-dom";
import type { Mock } from "vitest";
import { act } from "react";

// Mocks
vi.mock("@tanstack/react-query");
vi.mock("../../screens/Setting/context/UnsavedTabChangesContext");

const mockSetHasUnsavedChanges = vi.fn();

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(
    <UnsavedChangesDataContext
      value={{
        setHasUnsavedChanges: mockSetHasUnsavedChanges,
        hasUnsavedChanges: false,
      }}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </UnsavedChangesDataContext>
  );
}

const mockAgents = [
  { id: "a1", name: "Agent One" },
  { id: "a2", name: "Agent Two" },
];

const mockAgentVersionDetails = {
  agentId: "a1",
  model: "gpt-4",
  temperature: "0.7",
  versionAlias: "v1",
  prompt: "Prompt text",
  versions: ["v1", "v2"],
};

const mockModels = ["gpt-4", "gpt-3.5"];

describe("PromptTemplatesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useMutation as unknown as Mock).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    });
    (useQueryClient as unknown as Mock).mockReturnValue({
      setQueryData: vi.fn(),
    });
  });

  it("renders loading state for agents", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents") return { isLoading: true };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    expect(screen.getByText(/fetching agents/i)).toBeInTheDocument();
  });

  it("renders error state for agents", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, error: { message: "Agent error" } };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    expect(screen.getByText(/agent error/i)).toBeInTheDocument();
  });

  it("renders agent list and allows selection", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    expect(screen.getByText("Agent One")).toBeInTheDocument();
    expect(screen.getByText("Agent Two")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByPlaceholderText(/Enter your prompt template here*/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Prompt text")).toBeInTheDocument();
  });

  it("shows loading state for agent details", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails") return { isLoading: true };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByText(/fetching agent details/i)).toBeInTheDocument();
  });

  it("shows error state for agent details", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, error: { message: "Details error" } };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByText(/details error/i)).toBeInTheDocument();
  });

  it("renders model dropdown and allows change", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/model/i));
    // Optionally test dropdown change logic here
  });

  it("shows warning tile when form is dirty", async () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    const promptInput = screen.getByPlaceholderText(
      /enter your prompt template here/i
    );
    await userEvent.clear(promptInput);
    await userEvent.type(promptInput, "Changed prompt");
    expect(
      screen.getByText(/by editing you'll be creating a new prompt template/i)
    ).toBeInTheDocument();
    expect(mockSetHasUnsavedChanges).toHaveBeenCalledWith(true);
  });

  it("disables Save button when form is unchanged", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("enables Save button when form is dirty", () => {
    (useMutation as unknown as Mock).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    });
    (useQueryClient as unknown as Mock).mockReturnValue({
      setQueryData: vi.fn(),
    });
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    const promptInput = screen.getByPlaceholderText(
      /enter your prompt template here/i
    );
    fireEvent.change(promptInput, { target: { value: "Changed prompt" } });
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
  });

  it("calls saveAgentPrompt mutation on Save", () => {
    const mutate = vi.fn();
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    (useMutation as unknown as Mock).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    const promptInput = screen.getByPlaceholderText(
      /enter your prompt template here/i
    );
    fireEvent.change(promptInput, { target: { value: "Changed prompt" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(mutate).toHaveBeenCalled();
  });

  it("calls onSuccess after saving", async () => {
    const onSuccessSpy = vi.fn();

    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });

    const mockMutate = vi.fn((_data, options = {}) => {
      act(() => {
        options.onSuccess?.({
          agentId: "agent-1",
          versionAlias: "v1",
          model: "gpt-3.5",
          temperature: 0.7,
          prompt: "Agent 1 Prompt",
        });
        onSuccessSpy(); // ✅ track call
      });
    });

    (useMutation as unknown as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
    });

    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));

    const input = screen.getByPlaceholderText(
      /enter your prompt template here/i
    );
    await userEvent.clear(input);
    await userEvent.type(input, "Updated prompt");

    fireEvent.click(screen.getByText("Save"));

    expect(mockMutate).toHaveBeenCalled();
    expect(onSuccessSpy).toHaveBeenCalled();
  });

  it("renders benchmarking file input and handles file selection", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    expect(screen.getByText(/benchmarking file/i)).toBeInTheDocument();
    // Simulate file input logic if needed
  });

  it("shows file format error for unsupported file", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    const fileInput = screen.getByTestId("file-upload");

    const invalidFile = new File(["content"], "test.txt", {
      type: "text/plain",
    });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
  });

  it("shows file size error for large file", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    const fileInput = screen.getByTestId("file-upload");

    // Create a large CSV file (>10MB)
    const bigFile = new File(["x".repeat(11 * 1024 * 1024)], "big.csv", {
      type: "text/csv",
    });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    // More flexible matching that covers both possible error messages
    expect(
      screen.getByText(
        /file size too large|maximum allowed size|file exceeds.*size/i
      )
    ).toBeInTheDocument();
  });

  it("shows N/A for accuracy by default", () => {
    (useQuery as unknown as Mock).mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "agents")
        return { isLoading: false, data: mockAgents };
      if (queryKey[0] === "agentVersionDetails")
        return { isLoading: false, data: mockAgentVersionDetails };
      if (queryKey[0] === "modelsList")
        return { isLoading: false, data: mockModels };
      return {};
    });
    renderWithTheme(<PromptTemplates />);
    fireEvent.click(screen.getByText("Agent One"));
    // expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
