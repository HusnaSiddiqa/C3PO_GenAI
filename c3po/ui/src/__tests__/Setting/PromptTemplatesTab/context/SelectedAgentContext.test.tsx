import { renderHook, act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SelectedAgentProvider,
  useSelectedAgent,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentContext";
import { Agent } from "../../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";

describe("SelectedAgentContext", () => {
  describe("Default Values", () => {
    it("provides default selected agent as null", () => {
      const { result } = renderHook(() => useSelectedAgent(), {
        wrapper: SelectedAgentProvider,
      });

      expect(result.current.selectedAgent).toBeNull();
    });
  });

  describe("State Management", () => {
    it("updates selected agent", () => {
      const { result } = renderHook(() => useSelectedAgent(), {
        wrapper: SelectedAgentProvider,
      });

      const testAgent: Agent = {
        id: "agent-1",
        name: "Test Agent",
      };

      act(() => {
        result.current.setSelectedAgent(testAgent);
      });

      expect(result.current.selectedAgent).toEqual(testAgent);
    });

    it("can clear selected agent", () => {
      const { result } = renderHook(() => useSelectedAgent(), {
        wrapper: SelectedAgentProvider,
      });

      const testAgent: Agent = {
        id: "agent-1",
        name: "Test Agent",
      };

      act(() => {
        result.current.setSelectedAgent(testAgent);
      });

      expect(result.current.selectedAgent).toEqual(testAgent);

      act(() => {
        result.current.setSelectedAgent(null);
      });

      expect(result.current.selectedAgent).toBeNull();
    });

    it("uses functional update form of setState", () => {
      const { result } = renderHook(() => useSelectedAgent(), {
        wrapper: SelectedAgentProvider,
      });

      const agent1: Agent = { id: "1", name: "Agent 1" };

      act(() => {
        result.current.setSelectedAgent(agent1);
      });

      act(() => {
        result.current.setSelectedAgent((prev) => {
          expect(prev).toEqual(agent1);
          return { id: "2", name: "Agent 2" };
        });
      });

      expect(result.current.selectedAgent).toEqual({ id: "2", name: "Agent 2" });
    });
  });

  describe("Provider Rendering", () => {
    it("renders children correctly", () => {
      const TestComponent = () => {
        const { selectedAgent } = useSelectedAgent();
        return <div data-testid="test-component">{selectedAgent?.name || "No agent"}</div>;
      };

      render(
        <SelectedAgentProvider>
          <TestComponent />
        </SelectedAgentProvider>
      );

      expect(screen.getByTestId("test-component")).toBeInTheDocument();
      expect(screen.getByText("No agent")).toBeInTheDocument();
    });
  });
});
