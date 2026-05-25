import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  SelectedAgentDetailsProvider,
  useSelectedAgentDetails,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/SelectedAgentDetailsContext";
import { AgentDetails } from "../../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

describe("SelectedAgentDetailsContext", () => {
  const defaultAgentDetails: AgentDetails = {
    model: "",
    temperature: "",
    versionAlias: "",
    prompt: "",
    versions: [],
  };

  describe("Default Values", () => {
    it("provides default selected agent details", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      expect(result.current.selectedAgentDetails).toEqual(defaultAgentDetails);
    });
  });

  describe("State Management", () => {
    it("updates selected agent details completely", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      const newDetails: AgentDetails = {
        model: "gpt-4",
        temperature: "0.7",
        versionAlias: "v1",
        prompt: "Test prompt",
        versions: ["v1", "v2"],
      };

      act(() => {
        result.current.setSelectedAgentDetails(newDetails);
      });

      expect(result.current.selectedAgentDetails).toEqual(newDetails);
    });

    it("updates model only", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          model: "gpt-4-turbo",
        }));
      });

      expect(result.current.selectedAgentDetails.model).toBe("gpt-4-turbo");
      expect(result.current.selectedAgentDetails.temperature).toBe("");
    });

    it("updates temperature only", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          temperature: "0.9",
        }));
      });

      expect(result.current.selectedAgentDetails.temperature).toBe("0.9");
    });

    it("updates prompt only", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      const newPrompt = "You are a helpful AI assistant.";

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          prompt: newPrompt,
        }));
      });

      expect(result.current.selectedAgentDetails.prompt).toBe(newPrompt);
    });

    it("updates versionAlias only", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          versionAlias: "v2.5",
        }));
      });

      expect(result.current.selectedAgentDetails.versionAlias).toBe("v2.5");
    });

    it("updates versions array", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      const newVersions = ["v1", "v2", "v3"];

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          versions: newVersions,
        }));
      });

      expect(result.current.selectedAgentDetails.versions).toEqual(newVersions);
    });

    it("updates multiple fields at once", () => {
      const { result } = renderHook(() => useSelectedAgentDetails(), {
        wrapper: SelectedAgentDetailsProvider,
      });

      act(() => {
        result.current.setSelectedAgentDetails((prev) => ({
          ...prev,
          model: "gpt-4",
          temperature: "0.8",
          prompt: "New prompt",
        }));
      });

      expect(result.current.selectedAgentDetails).toMatchObject({
        model: "gpt-4",
        temperature: "0.8",
        prompt: "New prompt",
      });
    });
  });
});
