import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import AgentTileContainer from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/AgentTileContainer";
import { Agent, AgentDetails } from "../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

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
  default: vi.fn(({ agentName, isSelected, onClick, icon, parentAgentID, hasSubAgents }) => (
    <div
      data-testid={`agent-tile-${agentName}`}
      data-is-selected={isSelected}
      data-parent-agent-id={parentAgentID}
      data-has-sub-agents={hasSubAgents}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {agentName}
      {icon && <span data-testid="icon">{icon.type?.name}</span>}
    </div>
  )),
}));

vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/SubAgentsList", () => ({
  default: vi.fn(({ parentAgent }) => (
    <div data-testid={`sub-agents-list-${parentAgent.id}`}>
      Sub Agents for {parentAgent.name}
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

import { useSelectedAgentDetails } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentDetailsContext";
import { useInitialAgentDetails } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/InitialAgentDetailsContext";
import { useSelectedSubAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext";
import { useSelectedAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext";
import { useShowWarning } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/ShowWarningContext";
import { usePendingAgent } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/PendingAgentContext";
import { AgentTypesContext } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AgentTypesContext";

const mockAgentWithoutSubAgents: Agent = {
  id: "agent-1",
  name: "Simple Agent",
};

const mockAgentWithSubAgents: Agent = {
  id: "agent-2",
  name: "Parent Agent",
};

const mockAgentTypes: Agent[] = [
  {
    id: "agent-2",
    name: "Parent Agent",
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
    agentTypes = mockAgentTypes,
  }: {
    selectedAgentDetails?: AgentDetails;
    initialAgentDetails?: AgentDetails;
    selectedSubAgent?: Agent | null;
    selectedAgent?: Agent | null;
    showWarning?: boolean;
    pendingAgent?: Agent | null;
    agentTypes?: Agent[];
  } = {}
) {
  const theme = getTheme("light");

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
      <ThemeProvider theme={theme}>
        <AgentTypesContext.Provider value={{ agentTypes, setAgentTypes: vi.fn() }}>
          {ui}
        </AgentTypesContext.Provider>
      </ThemeProvider>
    ),
    setSelectedAgentDetails,
    setInitialAgentDetails,
    setSelectedSubAgent,
    setSelectedAgent,
    setShowWarning,
    setPendingAgent,
  };
}

describe("AgentTileContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders parent agent tile correctly", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />);

      expect(screen.getByTestId("agent-tile-Parent Agent")).toBeInTheDocument();
    });

    it("renders agent without sub-agents correctly", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithoutSubAgents} />, {
        agentTypes: [],
      });

      expect(screen.getByTestId("agent-tile-Simple Agent")).toBeInTheDocument();
    });

    it("does not render warning by default", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />);

      expect(screen.queryByTestId("warning-dialog")).not.toBeInTheDocument();
    });

    it("shows warning dialog", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />, {
        showWarning: true,
      });

      expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
    });
  });

  describe("Selection Tests", () => {
    it("highlights selected agent", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />, {
        selectedAgent: mockAgentWithSubAgents,
      });

      const tile = screen.getByTestId("agent-tile-Parent Agent");
      expect(tile).toHaveAttribute("data-is-selected", "true");
    });

    it("does not highlight non-selected agent", () => {
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />);

      const tile = screen.getByTestId("agent-tile-Parent Agent");
      expect(tile).toHaveAttribute("data-is-selected", "false");
    });

    it("selects agent directly when it has no sub-agents", async () => {
      const user = userEvent.setup();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithoutSubAgents} />,
        {
          agentTypes: [],
        }
      );

      const tile = screen.getByTestId("agent-tile-Simple Agent");
      await user.click(tile);

      expect(setSelectedAgent).toHaveBeenCalledWith(mockAgentWithoutSubAgents);
      expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
    });

    it("does not directly select agent when it has sub-agents", async () => {
      const user = userEvent.setup();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />
      );

      const tile = screen.getByTestId("agent-tile-Parent Agent");
      await user.click(tile);

      expect(setSelectedAgent).toHaveBeenCalledWith(null);
      expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
    });
  });

  describe("Expand/Collapse Tests", () => {
    it("expands sub-agents when clicking parent with sub-agents", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />);

      expect(screen.queryByTestId(`sub-agents-list-${mockAgentWithSubAgents.id}`)).not.toBeInTheDocument();

      const tile = screen.getByTestId("agent-tile-Parent Agent");
      await user.click(tile);

      await waitFor(() => {
        expect(screen.getByTestId(`sub-agents-list-${mockAgentWithSubAgents.id}`)).toBeInTheDocument();
      });
    });

    it("collapses sub-agents when clicking parent again", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />);

      const tile = screen.getByTestId("agent-tile-Parent Agent");

      // First click to expand
      await user.click(tile);
      await waitFor(() => {
        expect(screen.getByTestId(`sub-agents-list-${mockAgentWithSubAgents.id}`)).toBeInTheDocument();
      });

      // Second click to collapse
      await user.click(tile);
      await waitFor(() => {
        expect(screen.queryByTestId(`sub-agents-list-${mockAgentWithSubAgents.id}`)).not.toBeInTheDocument();
      });
    });

    it("does not render sub-agents list for agent without sub-agents", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AgentTileContainer agent={mockAgentWithoutSubAgents} />, {
        agentTypes: [],
      });

      const tile = screen.getByTestId("agent-tile-Simple Agent");
      await user.click(tile);

      expect(screen.queryByTestId(`sub-agents-list-${mockAgentWithoutSubAgents.id}`)).not.toBeInTheDocument();
    });
  });

  describe("Dirty State Tests", () => {
    it("shows warning dialog when attempting to switch with dirty model", async () => {
      const user = userEvent.setup();
      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithoutSubAgents} />,
        {
          agentTypes: [],
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            model: "gpt-3.5-turbo", // Different from initial
          },
        }
      );

      const tile = screen.getByTestId("agent-tile-Simple Agent");
      await user.click(tile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockAgentWithoutSubAgents);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });

    it("shows warning dialog when attempting to switch with dirty temperature", async () => {
      const user = userEvent.setup();
      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />,
        {
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            temperature: "0.9", // Different from initial
          },
        }
      );

      const tile = screen.getByTestId("agent-tile-Parent Agent");
      await user.click(tile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockAgentWithSubAgents);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });

    it("shows warning dialog when attempting to switch with dirty prompt", async () => {
      const user = userEvent.setup();
      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithoutSubAgents} />,
        {
          agentTypes: [],
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            prompt: "Modified prompt", // Different from initial
          },
        }
      );

      const tile = screen.getByTestId("agent-tile-Simple Agent");
      await user.click(tile);

      expect(setPendingAgent).toHaveBeenCalledWith(mockAgentWithoutSubAgents);
      expect(setShowWarning).toHaveBeenCalledWith(true);
    });

    it("does not show warning when state is clean", async () => {
      const user = userEvent.setup();
      const { setPendingAgent, setShowWarning } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithoutSubAgents} />,
        {
          agentTypes: [],
        }
      );

      const tile = screen.getByTestId("agent-tile-Simple Agent");
      await user.click(tile);

      expect(setPendingAgent).not.toHaveBeenCalled();
      expect(setShowWarning).not.toHaveBeenCalled();
    });
  });

  describe("Warning Dialog Interaction Tests", () => {
    it("resets agent details to initial state when confirming switch", async () => {
      const user = userEvent.setup();
      const {
        setSelectedAgentDetails,
        setInitialAgentDetails,
        setShowWarning,
        setPendingAgent,
      } = renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />, {
        showWarning: true,
        pendingAgent: mockAgentWithoutSubAgents,
        agentTypes: [],
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

    it("resets agent details on confirm", async () => {
      const user = userEvent.setup();
      const { setSelectedAgentDetails } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />,
        {
          showWarning: true,
          pendingAgent: mockAgentWithoutSubAgents,
          agentTypes: [],
          selectedAgentDetails: {
            ...mockSelectedAgentDetails,
            model: "gpt-3.5-turbo",
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      expect(setSelectedAgentDetails).toHaveBeenCalledWith({
        model: "",
        temperature: "",
        versionAlias: "",
        prompt: "",
        versions: [],
      });
    });

    it("resets initial agent details on confirm", async () => {
      const user = userEvent.setup();
      const { setInitialAgentDetails } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />,
        {
          showWarning: true,
          pendingAgent: mockAgentWithSubAgents,
          initialAgentDetails: {
            ...mockInitialAgentDetails,
            prompt: "Different prompt",
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      expect(setInitialAgentDetails).toHaveBeenCalledWith({
        model: "",
        temperature: "",
        versionAlias: "",
        prompt: "",
        versions: [],
      });
    });

    it("unselects parent agent when pending agent has sub-agents", async () => {
      const user = userEvent.setup();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithoutSubAgents} />,
        {
          showWarning: true,
          pendingAgent: mockAgentWithSubAgents, // This agent has sub-agents
          agentTypes: mockAgentTypes,
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      // Because pending agent has sub-agents, selectedAgent should be null
      expect(setSelectedAgent).toHaveBeenCalledWith(null);
      expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
    });

    it("selects parent agent when pending agent has no sub-agents", async () => {
      const user = userEvent.setup();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />,
        {
          showWarning: true,
          pendingAgent: mockAgentWithoutSubAgents, // This agent has no sub-agents
          agentTypes: [],
        }
      );

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const leaveButton = screen.getByTestId("leave-button");
      await user.click(leaveButton);

      // Because pending agent has no sub-agents, it should be set as selectedAgent
      expect(setSelectedAgent).toHaveBeenCalledWith(mockAgentWithoutSubAgents);
      expect(setSelectedSubAgent).toHaveBeenCalledWith(null);
    });

    it("stays on current agent when stay button is clicked", async () => {
      const user = userEvent.setup();
      const {
        setSelectedAgent,
        setSelectedSubAgent,
        setShowWarning,
        setPendingAgent,
      } = renderWithProviders(<AgentTileContainer agent={mockAgentWithSubAgents} />, {
        showWarning: true,
        pendingAgent: mockAgentWithoutSubAgents,
      });

      await waitFor(() => {
        expect(screen.getByTestId("warning-dialog")).toBeInTheDocument();
      });

      const stayButton = screen.getByTestId("stay-button");
      await user.click(stayButton);

      expect(setSelectedAgent).not.toHaveBeenCalled();
      expect(setSelectedSubAgent).not.toHaveBeenCalled();
      expect(setShowWarning).toHaveBeenCalledWith(false);
      expect(setPendingAgent).toHaveBeenCalledWith(null);
    });

    it("does not switch agent when pending agent is null", async () => {
      const user = userEvent.setup();
      const { setSelectedAgent, setSelectedSubAgent } = renderWithProviders(
        <AgentTileContainer agent={mockAgentWithSubAgents} />,
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

      expect(setSelectedAgent).not.toHaveBeenCalled();
      expect(setSelectedSubAgent).not.toHaveBeenCalled();
    });
  });
});
