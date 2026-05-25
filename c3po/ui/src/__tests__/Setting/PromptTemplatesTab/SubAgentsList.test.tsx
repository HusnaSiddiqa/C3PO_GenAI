import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import SubAgentsList from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/SubAgentsList";
import { Agent, SubAgent, AgentDetails } from "../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

// Mock the helpers
vi.mock("../../../screens/Setting/helpers/helpers", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchSubAgents: vi.fn(),
}));

// Mock all the context hooks
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentDetailsContext", () => ({
  useSelectedAgentDetails: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/InitialAgentDetailsContext", () => ({
  useInitialAgentDetails: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext", () => ({
  useSelectedSubAgent: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext", () => ({
  useSelectedAgent: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/ShowWarningContext", () => ({
  useShowWarning: vi.fn(),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/PendingAgentContext", () => ({
  usePendingAgent: vi.fn(),
}));

// Mock child components
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/AgentTile", () => ({
  default: vi.fn(({ agentName, isSelected, onClick, icon, parentAgentID, isSubAgent, hasSubAgents }) => (
    <div
      data-testid={`agent-tile-${agentName}`}
      data-is-selected={isSelected}
      data-parent-agent-id={parentAgentID}
      data-is-sub-agent={isSubAgent}
      data-has-sub-agents={hasSubAgents}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {agentName}
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/DirtyChangesWarning", () => ({
  DirtyChangesWarning: vi.fn(({ open, onClose, onStay }) =>
    open ? (
      <div data-testid="warning-dialog">
        <button data-testid="leave-button" onClick={onClose}>
          Leave without saving
        </button>
        <button data-testid="stay-button" onClick={onStay}>
          Stay
        </button>
      </div>
    ) : null
  ),
}));

vi.mock("../../../screens/Setting/components/ErrorDialog", () => ({
  default: vi.fn(({ isErrorDialogOpen, title, error, setIsErrorDialogOpen }) =>
    isErrorDialogOpen ? (
      <div data-testid="error-dialog">
        <div data-testid="error-title">{title}</div>
        <div data-testid="error-message">{error?.message}</div>
        <button onClick={() => setIsErrorDialogOpen(false)}>Close</button>
      </div>
    ) : null
  ),
}));

import { fetchSubAgents } from "../../../screens/Setting/helpers/helpers";
import { useSelectedAgentDetails } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentDetailsContext";
import { useInitialAgentDetails } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/InitialAgentDetailsContext";
import { useSelectedSubAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext";
import { useSelectedAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext";
import { useShowWarning } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/ShowWarningContext";
import { usePendingAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/PendingAgentContext";

const mockParentAgent: Agent = {
  id: "parent-agent-1",
  name: "Parent Agent",
};

const mockSubAgents: SubAgent[] = [
  {
    id: "sub-1",
    name: "SQL Sub Agent",
    agent_type: "SQL Agent",
    description: "SQL sub agent",
    relates_to: [],
  },
  {
    id: "sub-2",
    name: "RAG Sub Agent",
    agent_type: "RAG Agent",
    description: "RAG sub agent",
    relates_to: [],
  },
  {
    id: "sub-3",
    name: "Planning Sub Agent",
    agent_type: "Planning Agent",
    description: "Planning sub agent",
    relates_to: [],
  },
];

const mockSelectedAgentDetails: AgentDetails = {
  model: "gpt-4",
  temperature: "0.7",
  prompt: "Test prompt",
  versionAlias: "v1",
  versions: [],
};

const mockInitialAgentDetails: AgentDetails = {
  model: "gpt-4",
  temperature: "0.7",
  prompt: "Test prompt",
  versionAlias: "v1",
  versions: [],
};

function renderWithProviders(
  ui: React.ReactElement,
  {
    selectedAgentDetails = mockSelectedAgentDetails,
    initialAgentDetails = mockInitialAgentDetails,
    selectedSubAgent = null,
    selectedAgent = null,
    showWarning = false,
    pendingAgent = null,
  }: {
    selectedAgentDetails?: AgentDetails;
    initialAgentDetails?: AgentDetails;
    selectedSubAgent?: Agent | null;
    selectedAgent?: Agent | null;
    showWarning?: boolean;
    pendingAgent?: Agent | null;
  } = {}
) {
  const theme = getTheme("light");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const setSelectedAgentDetails = vi.fn();
  const setInitialAgentDetails = vi.fn();
  const setSelectedSubAgent = vi.fn();
  const setSelectedAgent = vi.fn();
  const setShowWarning = vi.fn();
  const setPendingAgent = vi.fn();

  // Mock the context hooks
  vi.mocked(useSelectedAgentDetails).mockReturnValue({
    selectedAgentDetails,
    setSelectedAgentDetails,
  });

  vi.mocked(useInitialAgentDetails).mockReturnValue({
    initialAgentDetails: initialAgentDetails,
    setInitialAgentDetails,
  });

  vi.mocked(useSelectedSubAgent).mockReturnValue({
    selectedSubAgent,
    setSelectedSubAgent,
  });

  vi.mocked(useSelectedAgent).mockReturnValue({
    selectedAgent,
    setSelectedAgent,
  });

  vi.mocked(useShowWarning).mockReturnValue({
    showWarning,
    setShowWarning,
  });

  vi.mocked(usePendingAgent).mockReturnValue({
    pendingAgent,
    setPendingAgent,
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </QueryClientProvider>
    ),
    setSelectedAgentDetails,
    setInitialAgentDetails,
    setSelectedSubAgent,
    setSelectedAgent,
    setShowWarning,
    setPendingAgent,
  };
}

describe("SubAgentsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders loading state while fetching sub-agents", () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockImplementation(
        () => new Promise(() => { }) // Never resolves
      );

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      expect(screen.getByText("Fetching Sub-agents...")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("renders list of sub-agents after successful fetch", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.getByTestId("agent-tile-SQL Sub Agent")).toBeInTheDocument();
        expect(screen.getByTestId("agent-tile-RAG Sub Agent")).toBeInTheDocument();
        expect(screen.getByTestId("agent-tile-Planning Sub Agent")).toBeInTheDocument();
      });
    });

    it("renders empty list when no sub-agents are returned", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue([]);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.queryByTestId(/agent-tile-/)).not.toBeInTheDocument();
      });
    });

    it("does not render DirtyChangesWarning by default", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.queryByTestId("warning-dialog")).not.toBeInTheDocument();
      });
    });

    it("does not render ErrorDialog by default", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.queryByTestId("error-dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Query Integration Tests", () => {
    it("calls fetchSubAgents with parent agent name", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(mockFetchSubAgents).toHaveBeenCalledWith(mockParentAgent.name);
      });
    });

    it("handles fetch error and shows error dialog", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      const testError = new Error("Failed to fetch sub-agents");
      mockFetchSubAgents.mockRejectedValue(testError);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
        expect(screen.getByTestId("error-title")).toHaveTextContent("No Sub-agents available");
        expect(screen.getByTestId("error-message")).toHaveTextContent("Failed to fetch sub-agents");
      });
    });

    it("renders empty list on fetch error", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockRejectedValue(new Error("Failed to fetch"));

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />);

      await waitFor(() => {
        expect(screen.queryByTestId(/agent-tile-/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Selection Tests", () => {
    it("highlights selected sub-agent", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        selectedSubAgent: mockSubAgents[0],
      });

      await waitFor(() => {
        const selectedTile = screen.getByTestId("agent-tile-SQL Sub Agent");
        expect(selectedTile).toHaveAttribute("data-is-selected", "true");
      });
    });

    it("does not highlight non-selected sub-agents", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        selectedSubAgent: mockSubAgents[0],
      });

      await waitFor(() => {
        const ragTile = screen.getByTestId("agent-tile-RAG Sub Agent");
        expect(ragTile).toHaveAttribute("data-is-selected", "false");
      });
    });

    it("updates selected sub-agent and agent on click when clean", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const { setSelectedSubAgent, setSelectedAgent } = renderWithProviders(
        <SubAgentsList parentAgent={mockParentAgent} />
      );

      await waitFor(() => {
        expect(screen.getByTestId("agent-tile-SQL Sub Agent")).toBeInTheDocument();
      });

      const sqlTile = screen.getByTestId("agent-tile-SQL Sub Agent");
      await user.click(sqlTile);

      expect(setSelectedSubAgent).toHaveBeenCalledWith(mockSubAgents[0]);
      expect(setSelectedAgent).toHaveBeenCalledWith(mockSubAgents[0]);
    });

    it("shows warning dialog on click when model is dirty", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <SubAgentsList parentAgent={mockParentAgent} />,
        {
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            model: "gpt-3.5-turbo", // Different from initial
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("agent-tile-SQL Sub Agent")).toBeInTheDocument();
      });

      const sqlTile = screen.getByTestId("agent-tile-SQL Sub Agent");
      await user.click(sqlTile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockSubAgents[0]);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });

    it("shows warning dialog when temperature is dirty", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <SubAgentsList parentAgent={mockParentAgent} />,
        {
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            temperature: "0.9", // Different from initial
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("agent-tile-RAG Sub Agent")).toBeInTheDocument();
      });

      const ragTile = screen.getByTestId("agent-tile-RAG Sub Agent");
      await user.click(ragTile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockSubAgents[1]);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });

    it("shows warning dialog when prompt is dirty", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <SubAgentsList parentAgent={mockParentAgent} />,
        {
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            prompt: "Modified prompt", // Different from initial
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("agent-tile-Planning Sub Agent")).toBeInTheDocument();
      });

      const planningTile = screen.getByTestId("agent-tile-Planning Sub Agent");
      await user.click(planningTile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockSubAgents[2]);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });
  });

  describe("Warning Dialog Interaction Tests", () => {
    it("renders warning dialog when showWarning is true", async () => {
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        showWarning: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });
    });

    it("switches to pending agent on confirm (leave without saving)", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const {
        setSelectedSubAgent,
        setSelectedAgent,
        setShowWarning,
        setPendingAgent,
      } = renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        showWarning: true,
        pendingAgent: mockSubAgents[1],
      });

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      expect(setSelectedSubAgent).toHaveBeenCalledWith(mockSubAgents[1]);
      expect(setSelectedAgent).toHaveBeenCalledWith(mockSubAgents[1]);
      expect(setShowWarning).toHaveBeenCalledWith(false);
      expect(setPendingAgent).toHaveBeenCalledWith(null);
    });

    it("stays on current agent when stay button is clicked", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const {
        setSelectedSubAgent,
        setSelectedAgent,
        setShowWarning,
        setPendingAgent,
      } = renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        showWarning: true,
        pendingAgent: mockSubAgents[1],
      });

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const stayButton = screen.getByTestId("stay-button");
      await user.click(stayButton);

      expect(setSelectedSubAgent).not.toHaveBeenCalled();
      expect(setSelectedAgent).not.toHaveBeenCalled();
      expect(setShowWarning).toHaveBeenCalledWith(false);
      expect(setPendingAgent).toHaveBeenCalledWith(null);
    });

    it("does not switch agent when pending agent is null", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const { setSelectedSubAgent, setSelectedAgent } = renderWithProviders(
        <SubAgentsList parentAgent={mockParentAgent} />,
        {
          showWarning: true,
          pendingAgent: null,
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      expect(setSelectedSubAgent).not.toHaveBeenCalled();
      expect(setSelectedAgent).not.toHaveBeenCalled();
    });

    it("resets agent details to initial state when confirming switch", async () => {
      const user = userEvent.setup();
      const mockFetchSubAgents = vi.mocked(fetchSubAgents);
      mockFetchSubAgents.mockResolvedValue(mockSubAgents);

      const {
        setSelectedAgentDetails,
        setInitialAgentDetails,
        setShowWarning,
        setPendingAgent,
      } = renderWithProviders(<SubAgentsList parentAgent={mockParentAgent} />, {
        showWarning: true,
        pendingAgent: mockSubAgents[1],
      });

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      const expectedInitialValue = {
        model: "",
        temperature: "",
        versionAlias: "",
        prompt: "",
        versions: [],
      };

      expect(setSelectedAgentDetails).toHaveBeenCalledWith(expectedInitialValue);
      expect(setInitialAgentDetails).toHaveBeenCalledWith(expectedInitialValue);
      expect(setShowWarning).toHaveBeenCalledWith(false);
      expect(setPendingAgent).toHaveBeenCalledWith(null);
    });
  });
});
