import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SelectedSubAgentProvider,
  useSelectedSubAgent,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedSubAgentContext";
import { Agent } from "../../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

describe("SelectedSubAgentContext", () => {
  describe("Default Values", () => {
    it("provides default selected sub-agent as null", () => {
      const { result } = renderHook(() => useSelectedSubAgent(), {
        wrapper: SelectedSubAgentProvider,
      });

      expect(result.current.selectedSubAgent).toBeNull();
    });
  });

  describe("State Management", () => {
    it("updates selected sub-agent", () => {
      const { result } = renderHook(() => useSelectedSubAgent(), {
        wrapper: SelectedSubAgentProvider,
      });

      const testSubAgent: Agent = {
        id: "sub-agent-1",
        name: "SQL Sub-Agent",
      };

      act(() => {
        result.current.setSelectedSubAgent(testSubAgent);
      });

      expect(result.current.selectedSubAgent).toEqual(testSubAgent);
    });

    it("can clear selected sub-agent", () => {
      const { result } = renderHook(() => useSelectedSubAgent(), {
        wrapper: SelectedSubAgentProvider,
      });

      const testSubAgent: Agent = {
        id: "sub-agent-1",
        name: "SQL Sub-Agent",
      };

      act(() => {
        result.current.setSelectedSubAgent(testSubAgent);
      });

      expect(result.current.selectedSubAgent).toEqual(testSubAgent);

      act(() => {
        result.current.setSelectedSubAgent(null);
      });

      expect(result.current.selectedSubAgent).toBeNull();
    });

    it("supports functional updates", () => {
      const { result } = renderHook(() => useSelectedSubAgent(), {
        wrapper: SelectedSubAgentProvider,
      });

      const subAgent: Agent = { id: "1", name: "Sub-Agent 1" };

      act(() => {
        result.current.setSelectedSubAgent(subAgent);
      });

      act(() => {
        result.current.setSelectedSubAgent((prev) => {
          expect(prev).toEqual(subAgent);
          return { id: "2", name: "Sub-Agent 2" };
        });
      });

      expect(result.current.selectedSubAgent).toEqual({ id: "2", name: "Sub-Agent 2" });
    });
  });
});
