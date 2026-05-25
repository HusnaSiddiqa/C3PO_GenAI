import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PendingAgentProvider,
  usePendingAgent,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/PendingAgentContext";
import { Agent } from "../../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

describe("PendingAgentContext", () => {
  describe("Default Values", () => {
    it("provides default pending agent as null", () => {
      const { result } = renderHook(() => usePendingAgent(), {
        wrapper: PendingAgentProvider,
      });

      expect(result.current.pendingAgent).toBeNull();
    });
  });

  describe("State Management", () => {
    it("updates pending agent", () => {
      const { result } = renderHook(() => usePendingAgent(), {
        wrapper: PendingAgentProvider,
      });

      const testAgent: Agent = {
        id: "agent-1",
        name: "Pending Agent",
      };

      act(() => {
        result.current.setPendingAgent(testAgent);
      });

      expect(result.current.pendingAgent).toEqual(testAgent);
    });

    it("can clear pending agent", () => {
      const { result } = renderHook(() => usePendingAgent(), {
        wrapper: PendingAgentProvider,
      });

      const testAgent: Agent = {
        id: "agent-1",
        name: "Pending Agent",
      };

      act(() => {
        result.current.setPendingAgent(testAgent);
      });

      expect(result.current.pendingAgent).toEqual(testAgent);

      act(() => {
        result.current.setPendingAgent(null);
      });

      expect(result.current.pendingAgent).toBeNull();
    });

    it("supports functional updates", () => {
      const { result } = renderHook(() => usePendingAgent(), {
        wrapper: PendingAgentProvider,
      });

      const agent1: Agent = { id: "1", name: "Agent 1" };

      act(() => {
        result.current.setPendingAgent(agent1);
      });

      act(() => {
        result.current.setPendingAgent((prev) => {
          expect(prev).toEqual(agent1);
          return null;
        });
      });

      expect(result.current.pendingAgent).toBeNull();
    });
  });
});
