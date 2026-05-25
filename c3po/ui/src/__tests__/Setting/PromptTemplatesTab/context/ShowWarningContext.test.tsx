import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ShowWarningProvider,
  useShowWarning,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/ShowWarningContext";
import "@testing-library/jest-dom";

describe("ShowWarningContext", () => {
  describe("Default Values", () => {
    it("provides default showWarning as false", () => {
      const { result } = renderHook(() => useShowWarning(), {
        wrapper: ShowWarningProvider,
      });

      expect(result.current.showWarning).toBe(false);
    });
  });

  describe("State Management", () => {
    it("sets showWarning to true when called", () => {
      const { result } = renderHook(() => useShowWarning(), {
        wrapper: ShowWarningProvider,
      });

      act(() => {
        result.current.setShowWarning(true);
      });

      expect(result.current.showWarning).toBe(true);
    });

    it("sets showWarning to false when called", () => {
      const { result } = renderHook(() => useShowWarning(), {
        wrapper: ShowWarningProvider,
      });

      act(() => {
        result.current.setShowWarning(true);
      });

      expect(result.current.showWarning).toBe(true);

      act(() => {
        result.current.setShowWarning(false);
      });

      expect(result.current.showWarning).toBe(false);
    });
  });
});
