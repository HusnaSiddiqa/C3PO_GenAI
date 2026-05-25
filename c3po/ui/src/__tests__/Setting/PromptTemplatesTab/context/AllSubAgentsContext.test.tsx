import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllSubAgentsProvider,
  AllSubAgentsContext,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/AllSubAgentsContext";
import { SubAgent } from "../../../../screens/Setting/helpers/types";

// Mock the helper
vi.mock("../../../../screens/Setting/helpers/helpers", () => ({
  fetchAllSubAgents: vi.fn(),
}));

// Mock ErrorDialog
vi.mock("../../../../screens/Setting/components/ErrorDialog", () => ({
  default: ({ title, isErrorDialogOpen, error, setIsErrorDialogOpen }: any) =>
    isErrorDialogOpen ? (
      <div data-testid="error-dialog">
        <div data-testid="error-title">{title}</div>
        <div data-testid="error-message">{error?.message}</div>
        <button onClick={() => setIsErrorDialogOpen(false)} data-testid="close-error-dialog">
          Close
        </button>
      </div>
    ) : null,
}));

import { fetchAllSubAgents } from "../../../../screens/Setting/helpers/helpers";

describe("AllSubAgentsContext", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryOnMount: false,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
        },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const mockAllSubAgents: SubAgent[] = [
    {
      id: "sub-1",
      name: "SQL Sub Agent 1",
      agent_type: "SQL Agent",
      description: "SQL sub agent",
      relates_to: [],
    },
    {
      id: "sub-2",
      name: "RAG Sub Agent 1",
      agent_type: "RAG Agent",
      description: "RAG sub agent",
      relates_to: ["sub-1"],
    },
    {
      id: "sub-3",
      name: "Planning Sub Agent",
      agent_type: "Planning Agent",
      description: "Planning sub agent",
      relates_to: [],
    },
  ];

  describe("React Query Integration", () => {
    it("fetches all sub-agents", async () => {
      vi.mocked(fetchAllSubAgents).mockResolvedValue(mockAllSubAgents);

      const TestComponent = () => {
        const { allSubAgents } = useContext(AllSubAgentsContext);
        return (
          <div>
            {allSubAgents.map((subAgent) => (
              <div key={subAgent.id} data-testid="sub-agent">
                {subAgent.name}
              </div>
            ))}
          </div>
        );
      };

      render(
        <QueryClientProvider client={queryClient}>
          <AllSubAgentsProvider>
            <TestComponent />
          </AllSubAgentsProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(fetchAllSubAgents).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getAllByTestId("sub-agent")).toHaveLength(3);
      });

      expect(screen.getByText("SQL Sub Agent 1")).toBeInTheDocument();
      expect(screen.getByText("RAG Sub Agent 1")).toBeInTheDocument();
      expect(screen.getByText("Planning Sub Agent")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("renders error dialog when fetch fails", async () => {
      const errorMessage = "Failed to fetch sub-agents";
      vi.mocked(fetchAllSubAgents).mockRejectedValue(new Error(errorMessage));

      const TestComponent = () => {
        return <div data-testid="test-content">Test Content</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <AllSubAgentsProvider>
            <TestComponent />
          </AllSubAgentsProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
      });

      expect(screen.getByTestId("error-title")).toHaveTextContent(
        "Error fetching all sub-agents"
      );
      expect(screen.getByTestId("error-message")).toHaveTextContent(errorMessage);
    });

    it("renders children even when there is an error", async () => {
      vi.mocked(fetchAllSubAgents).mockRejectedValue(
        new Error("Network error")
      );

      const TestComponent = () => {
        return <div data-testid="test-content">Test Content</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <AllSubAgentsProvider>
            <TestComponent />
          </AllSubAgentsProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("test-content")).toBeInTheDocument();
    });

    it("allows closing error dialog", async () => {
      vi.mocked(fetchAllSubAgents).mockRejectedValue(
        new Error("Failed to fetch")
      );

      const TestComponent = () => {
        return <div data-testid="test-content">Test Content</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <AllSubAgentsProvider>
            <TestComponent />
          </AllSubAgentsProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-dialog")).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId("close-error-dialog");
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("error-dialog")).not.toBeInTheDocument();
      });
    });
  });
});
