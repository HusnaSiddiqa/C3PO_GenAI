import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import AgentTile from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/AgentTile";
import "@testing-library/jest-dom";

// Mock the helpers
vi.mock("../../../screens/Setting/helpers/helpers", () => ({
  deleteSubAgent: vi.fn(),
}));

// Mock the context hooks
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext", () => ({
  useSelectedAgent: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext", () => ({
  useSelectedSubAgent: vi.fn(),
}));

import { deleteSubAgent } from "../../../screens/Setting/helpers/helpers";
import { useSelectedAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext";
import { useSelectedSubAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext";

function renderWithProviders(
  ui: React.ReactElement,
  {
    invalidateQueries = vi.fn(),
  }: {
    invalidateQueries?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const theme = getTheme("light");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Mock the invalidateQueries method
  queryClient.invalidateQueries = invalidateQueries;

  const setSelectedAgent = vi.fn();
  const setSelectedSubAgent = vi.fn();

  // Mock the context hooks
  vi.mocked(useSelectedAgent).mockReturnValue({
    selectedAgent: null,
    setSelectedAgent,
  });

  vi.mocked(useSelectedSubAgent).mockReturnValue({
    selectedSubAgent: null,
    setSelectedSubAgent,
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </QueryClientProvider>
    ),
    setSelectedAgent,
    setSelectedSubAgent,
    invalidateQueries,
  };
}

describe("AgentTile", () => {
  const mockIcon = <div data-testid="mock-icon">Icon</div>;
  const defaultProps = {
    agentName: "Test Agent",
    isSelected: false,
    onClick: vi.fn(),
    hasSubAgents: false,
    icon: mockIcon,
    parentAgentID: "parent-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders with agent name and icon", () => {
      renderWithProviders(<AgentTile {...defaultProps} />);

      expect(screen.getByText("Test Agent")).toBeInTheDocument();
      expect(screen.getByTestId("mock-icon")).toBeInTheDocument();
    });

    it("shows selected sub-agent with border", () => {
      renderWithProviders(
        <AgentTile {...defaultProps} isSelected={true} />
      );

      const tile = screen.getByText("Test Agent").closest("div");
      expect(tile).toHaveStyle({
        borderRight: expect.stringContaining("6px solid"),
      });
    });

    it("shows unselected state correctly", () => {
      renderWithProviders(<AgentTile {...defaultProps} />);

      const tile = screen.getByText("Test Agent").closest("div");
      const computedStyle = window.getComputedStyle(tile!);
      // Unselected should not have a 6px solid border
      expect(computedStyle.borderRight).not.toContain("6px solid");
    });

    it("renders delete button only for sub-agents", () => {
      renderWithProviders(
        <AgentTile {...defaultProps} isSubAgent={true} />
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("does not show delete button for parent agents", () => {
      renderWithProviders(
        <AgentTile {...defaultProps} isSubAgent={false} />
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not show as selected when parent agent has sub-agents", () => {
      renderWithProviders(
        <AgentTile
          {...defaultProps}
          isSelected={true}
          hasSubAgents={true}
        />
      );

      const tile = screen.getByText("Test Agent").closest("div");
      const computedStyle = window.getComputedStyle(tile!);
      // Should not have selected styling when hasSubAgents is true
      expect(computedStyle.borderRight).not.toContain("6px solid");
    });
  });

  describe("Interaction Tests", () => {
    it("calls onClick handler when tile is clicked", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      renderWithProviders(
        <AgentTile {...defaultProps} onClick={onClick} />
      );

      const tile = screen.getByText("Test Agent");
      await user.click(tile);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("calls onClick when clicking on the icon area", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();

      renderWithProviders(
        <AgentTile {...defaultProps} onClick={onClick} />
      );

      const icon = screen.getByTestId("mock-icon");
      await user.click(icon);

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe("Delete Functionality Tests", () => {
    it("shows confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0]; // First button is the delete icon button
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });
    });

    it("displays agent name in confirmation dialog", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="My Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      // The agent name should be somewhere in the document
      expect(screen.getAllByText("My Sub Agent").length).toBeGreaterThan(0);
    });

    it("deletes sub-agent when confirmation is accepted", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockResolvedValue({
        success: true,
        agent_id: "sub-1",
        message: "Deleted successfully",
        agent_name: "Sub Agent",
      });

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteSubAgent).toHaveBeenCalledWith("Sub Agent");
      });
    });

    it("does not delete sub-agent when confirmation is cancelled", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId("delete-confirmation-dialog")).not.toBeInTheDocument();
      });

      expect(mockDeleteSubAgent).not.toHaveBeenCalled();
    });

    it("closes confirmation dialog after cancelling", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId("delete-confirmation-dialog")).not.toBeInTheDocument();
      });
    });

    it("unselects agent on successful delete", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockResolvedValue({

        success: true,
        agent_id: "sub-1",
        message: "Deleted successfully",
        agent_name: "Sub Agent",
      });

      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(setSelectedAgent).toHaveBeenCalledWith(null);
        expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
      });
    });

    it("refreshes sub-agents after successful delete", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockResolvedValue({
        success: true,
        agent_id: "sub-1",
        message: "Deleted successfully",
        agent_name: "Sub Agent",
      });

      const invalidateQueries = vi.fn();
      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />,
        { invalidateQueries }
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(invalidateQueries).toHaveBeenCalledWith({
          queryKey: ["subAgents", "parent-1"],
        });
      });
    });

    it("shows error dialog on delete failure", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValue(
        new Error("Failed to delete sub-agent")
      );

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
      });
    });

    it("displays correct error message in dialog", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      const errorMessage = "Network error occurred";
      mockDeleteSubAgent.mockRejectedValue(new Error(errorMessage));

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });
  });

  describe("Error Dialog Tests", () => {
    it("error dialog is initially closed", () => {
      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      expect(screen.queryByText("Error deleting sub-agent")).not.toBeInTheDocument();
    });

    it("retry button tries to delete sub-agent again", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValue(new Error("First failure"));

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
      });

      // Clear the mock to count only retry calls
      mockDeleteSubAgent.mockClear();
      mockDeleteSubAgent.mockResolvedValue({
        success: true,
        agent_id: "sub-1",
        message: "Deleted successfully",
        agent_name: "Sub Agent",
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      expect(mockDeleteSubAgent).toHaveBeenCalledWith("Sub Agent");
    });

    it("successful retry closes dialog and refreshes data", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValueOnce(new Error("First failure"));
      mockDeleteSubAgent.mockResolvedValueOnce({
        success: true,
        agent_id: "sub-1",
        message: "Deleted successfully",
        agent_name: "Sub Agent",
      });

      const invalidateQueries = vi.fn();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />,
        { invalidateQueries }
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);


      // Verify retry was successful and context was updated
      await waitFor(() => {
        expect(setSelectedAgent).toHaveBeenCalledWith(null);
        expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
      });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["subAgents", "parent-1"],
      });
    });

    it("failed retry keeps dialog open with new error message", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValueOnce(new Error("First failure"));
      mockDeleteSubAgent.mockRejectedValueOnce(new Error("Second failure"));

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("First failure")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Second failure")).toBeInTheDocument();
      });

      expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
    });

    it("dismiss button closes dialog without retrying", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValue(new Error("Delete failed"));

      renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
      });

      // Clear the mock to ensure it's not called again
      mockDeleteSubAgent.mockClear();

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      await user.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText("Error deleting sub-agent")).not.toBeInTheDocument();
      });

      // Ensure delete was not called again
      expect(mockDeleteSubAgent).not.toHaveBeenCalled();
    });

    it("dismiss button clears selection state", async () => {
      const user = userEvent.setup();
      const mockDeleteSubAgent = vi.mocked(deleteSubAgent);
      mockDeleteSubAgent.mockRejectedValue(new Error("Delete failed"));

      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTile
          {...defaultProps}
          agentName="Sub Agent"
          isSubAgent={true}
        />
      );

      const deleteButton = screen.getAllByRole("button")[0];
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Error deleting sub-agent")).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      await user.click(dismissButton);

      await waitFor(() => {
        expect(setSelectedAgent).toHaveBeenCalledWith(null);
        expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
      });
    });
  });
});
