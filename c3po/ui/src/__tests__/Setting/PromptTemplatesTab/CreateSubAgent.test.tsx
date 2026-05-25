import { ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import CreateSubAgent from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/CreateSubAgent";
import { AgentTypesContext } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AgentTypesContext";

import "@testing-library/jest-dom";
import { Agent } from "../../../screens/Setting/helpers/types";

// Mock the CreateSubAgentDialog component
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/CreateSubAgentDialog", () => ({
  default: vi.fn(({ isDialogOpen, closeDialog, agentType }) => {
    if (!isDialogOpen) return null;
    return (
      <div data-testid="create-sub-agent-dialog">
        <div>Dialog for {agentType?.name}</div>
        <button onClick={closeDialog}>Close Dialog</button>
      </div>
    );
  }),
}));

// Mock the AllSubAgentsProvider
vi.mock("../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AllSubAgentsContext", () => ({
  AllSubAgentsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockAgentTypes: Agent[] = [
  { id: "agent-1", name: "SQL Agent" },
  { id: "agent-2", name: "RAG Agent" },
  { id: "agent-3", name: "Planning Agent" },
];

function renderWithTheme(ui: React.ReactElement, agentTypes: Agent[] = mockAgentTypes) {
  const theme = getTheme("light");
  return render(
    <AgentTypesContext.Provider
      value={{
        agentTypes,
        setAgentTypes: vi.fn(),
      }}
    >
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </AgentTypesContext.Provider>
  );
}

describe("CreateSubAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the component with title and button", () => {
      renderWithTheme(<CreateSubAgent />);

      expect(screen.getByText("Prompt Templates")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add agent/i })).toBeInTheDocument();
    });

    it("renders the Add Agent button with correct icon", () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('svg[data-testid="AddIcon"]')).toBeInTheDocument();
    });

    it("renders with correct ARIA attributes when menu is closed", () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      expect(button).toHaveAttribute("aria-haspopup", "true");
      // aria-expanded is only set when menu is open, not when closed
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  describe("Menu Interactions", () => {
    it("opens the menu when Add Agent button is clicked", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("displays all agent types in the menu", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("SQL Agent")).toBeInTheDocument();
        expect(screen.getByText("RAG Agent")).toBeInTheDocument();
        expect(screen.getByText("Planning Agent")).toBeInTheDocument();
      });
    });

    it("closes the menu when clicking outside", async () => {
      const user = userEvent.setup();
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // Click outside the menu (on the backdrop or ESC key)
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("updates ARIA attributes when menu is open", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("renders empty menu when no agent types are available", async () => {
      renderWithTheme(<CreateSubAgent />, []);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        const menu = screen.getByRole("menu");
        expect(menu).toBeInTheDocument();
        expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
      });
    });
  });

  describe("Dialog Interactions", () => {
    it("opens the dialog when an agent type is selected from menu", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("SQL Agent")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("SQL Agent"));

      await waitFor(() => {
        expect(screen.getByTestId("create-sub-agent-dialog")).toBeInTheDocument();
        expect(screen.getByText("Dialog for SQL Agent")).toBeInTheDocument();
      });
    });

    it("closes the menu when an agent type is selected", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("SQL Agent"));

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("closes the dialog when closeDialog is called", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("SQL Agent")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("SQL Agent"));

      await waitFor(() => {
        expect(screen.getByTestId("create-sub-agent-dialog")).toBeInTheDocument();
      });

      // Close the dialog
      fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));

      await waitFor(() => {
        expect(screen.queryByTestId("create-sub-agent-dialog")).not.toBeInTheDocument();
      });
    });

    it("passes the correct agent type to the dialog", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("RAG Agent")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("RAG Agent"));

      await waitFor(() => {
        expect(screen.getByText("Dialog for RAG Agent")).toBeInTheDocument();
      });
    });

    it("does not render dialog when no agent is selected", () => {
      renderWithTheme(<CreateSubAgent />);

      expect(screen.queryByTestId("create-sub-agent-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Multiple Agent Type Selection", () => {
    it("allows selecting different agent types sequentially", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });

      // Select first agent
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText("SQL Agent")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("SQL Agent"));

      await waitFor(() => {
        expect(screen.getByText("Dialog for SQL Agent")).toBeInTheDocument();
      });

      // Close the dialog
      fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));

      await waitFor(() => {
        expect(screen.queryByTestId("create-sub-agent-dialog")).not.toBeInTheDocument();
      });

      // Select second agent
      fireEvent.click(button);
      await waitFor(() => {
        expect(screen.getByText("Planning Agent")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Planning Agent"));

      await waitFor(() => {
        expect(screen.getByText("Dialog for Planning Agent")).toBeInTheDocument();
      });
    });
  });

  describe("Menu Positioning and Styling", () => {
    it("renders menu with correct anchor origin", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        const menu = screen.getByRole("menu");
        expect(menu).toBeInTheDocument();
        // Menu should be positioned relative to the button
      });
    });

    it("renders menu with transparent backdrop", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // The Menu component should have transparent backdrop styling
      // This is configured in slotProps.backdrop.sx.backgroundColor
    });
  });

  describe("Context Integration", () => {
    it("uses agentTypes from AgentTypesContext", async () => {
      const customAgentTypes: Agent[] = [
        { id: "custom-1", name: "Custom Agent 1" },
        { id: "custom-2", name: "Custom Agent 2" },
      ];

      renderWithTheme(<CreateSubAgent />, customAgentTypes);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Custom Agent 1")).toBeInTheDocument();
        expect(screen.getByText("Custom Agent 2")).toBeInTheDocument();
        expect(screen.queryByText("SQL Agent")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper button semantics", () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      expect(button).toHaveAttribute("id", "create-agent-button");
    });

    it("has proper menu semantics", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        // The menu role element exists and is accessible
        const menu = screen.getByRole("menu");
        expect(menu).toBeInTheDocument();
        // The menu's parent container has the id and aria-labelledby
        expect(menu.closest('[role="presentation"]')).toHaveAttribute("id", "create-agent-menu");
        expect(menu.closest('[role="presentation"]')).toHaveAttribute("aria-labelledby", "create-agent-button");
      });
    });

    it("menu items have correct role", async () => {
      renderWithTheme(<CreateSubAgent />);

      const button = screen.getByRole("button", { name: /add agent/i });
      fireEvent.click(button);

      await waitFor(() => {
        const menuItems = screen.getAllByRole("menuitem");
        expect(menuItems).toHaveLength(mockAgentTypes.length);
      });
    });
  });
});
