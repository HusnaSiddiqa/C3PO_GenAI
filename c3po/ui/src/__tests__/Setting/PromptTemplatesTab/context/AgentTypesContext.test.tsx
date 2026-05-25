import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    AgentTypesContext,
    AgentTypesProvider,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AgentTypesContext";
import { Agent } from "../../../../screens/Setting/helpers/types";

// Mock the helper
vi.mock("../../../../screens/Setting/helpers/helpers", () => ({
  fetchAgentTypes: vi.fn(),
}));

// Mock ErrorDialog
vi.mock("../../../../screens/Setting/components/ErrorDialog", () => ({
  default: ({ title, isErrorDialogOpen, error, setIsErrorDialogOpen }: any) => (
    isErrorDialogOpen ? (
      <div data-testid="error-dialog">
        <div data-testid="error-title">{title}</div>
        <div data-testid="error-message">{error?.message}</div>
        <button onClick={() => setIsErrorDialogOpen(false)} data-testid="close-error-dialog">
          Close
        </button>
      </div>
    ) : null
  ),
}));

import { fetchAgentTypes } from "../../../../screens/Setting/helpers/helpers";

describe("AgentTypesContext", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const mockAgentTypes: Agent[] = [
    { id: "1", name: "SQL Agent" },
    { id: "2", name: "RAG Agent" },
    { id: "3", name: "Planning Agent" },
  ];

  describe("React Query Integration", () => {
    it("fetches agent types", async () => {
      vi.mocked(fetchAgentTypes).mockResolvedValue(mockAgentTypes);

      const TestComponent = () => {
        const { agentTypes } = useContext(AgentTypesContext);
        return (
          <div>
            {agentTypes.map((agent) => (
              <div key={agent.id} data-testid="agent-type">
                {agent.name}
              </div>
            ))}
          </div>
        );
      };

      render(
        <QueryClientProvider client={queryClient}>
          <AgentTypesProvider>
            <TestComponent />
          </AgentTypesProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(fetchAgentTypes).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getAllByTestId("agent-type")).toHaveLength(3);
      });

      expect(screen.getByText("SQL Agent")).toBeInTheDocument();
      expect(screen.getByText("RAG Agent")).toBeInTheDocument();
      expect(screen.getByText("Planning Agent")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("renders error dialog when fetch fails", async () => {
      const error = new Error("Failed to fetch");
      vi.mocked(fetchAgentTypes).mockRejectedValue(error);

      render(
        <QueryClientProvider client={queryClient}>
          <AgentTypesProvider>
            <div data-testid="child-content">Test Content</div>
          </AgentTypesProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
      });

      expect(screen.getByTestId("error-title")).toHaveTextContent("Error fetching agent types");
      expect(screen.getByTestId("error-message")).toHaveTextContent("Failed to fetch");
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });

    it("allows closing the error dialog", async () => {
      const user = userEvent.setup();
      vi.mocked(fetchAgentTypes).mockRejectedValue(new Error("Failed to fetch"));

      render(
        <QueryClientProvider client={queryClient}>
          <AgentTypesProvider>
            <div>Test</div>
          </AgentTypesProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId("close-error-dialog");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("error-dialog")).not.toBeInTheDocument();
      });
    });
  });
});
