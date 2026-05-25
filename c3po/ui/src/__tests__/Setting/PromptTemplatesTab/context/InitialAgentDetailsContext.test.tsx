import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  InitialAgentDetailsProvider,
  useInitialAgentDetails,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/InitialAgentDetailsContext";
import { AgentDetails } from "../../../../screens/Setting/helpers/types";
import "@testing-library/jest-dom";

describe("InitialAgentDetailsContext", () => {
  const defaultAgentDetails: AgentDetails = {
    model: "",
    temperature: "",
    versionAlias: "",
    prompt: "",
    versions: [],
  };

  describe("Default Values", () => {
    it("provides default initial agent details", () => {
      const { result } = renderHook(() => useInitialAgentDetails(), {
        wrapper: InitialAgentDetailsProvider,
      });

      expect(result.current.initialAgentDetails).toEqual(defaultAgentDetails);
    });
  });

  describe("State Management", () => {
    it("updates initial agent details when set", () => {
      const { result } = renderHook(() => useInitialAgentDetails(), {
        wrapper: InitialAgentDetailsProvider,
      });

      const newDetails: AgentDetails = {
        model: "gpt-4",
        temperature: "0.7",
        versionAlias: "v1",
        prompt: "Test prompt",
        versions: ["v1", "v2"],
      };

      act(() => {
        result.current.setInitialAgentDetails(newDetails);
      });

      expect(result.current.initialAgentDetails).toEqual(newDetails);
    });

    it("can partially update details using functional update", () => {
      const { result } = renderHook(() => useInitialAgentDetails(), {
        wrapper: InitialAgentDetailsProvider,
      });

      const initial: AgentDetails = {
        model: "gpt-3",
        temperature: "0.5",
        versionAlias: "v1",
        prompt: "Initial prompt",
        versions: ["v1"],
      };

      act(() => {
        result.current.setInitialAgentDetails(initial);
      });

      act(() => {
        result.current.setInitialAgentDetails((prev) => ({
          ...prev,
          model: "gpt-4",
          temperature: "0.8",
        }));
      });

      expect(result.current.initialAgentDetails).toEqual({
        model: "gpt-4",
        temperature: "0.8",
        versionAlias: "v1",
        prompt: "Initial prompt",
        versions: ["v1"],
      });
    });
  });
});
