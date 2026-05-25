import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ShowSuccessProvider,
  useShowSuccess,
} from "../../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/context/ShowSuccessContext";
import "@testing-library/jest-dom";

describe("ShowSuccessContext", () => {
  describe("Default Values", () => {
    it("provides default showSuccess as false", () => {
      const { result } = renderHook(() => useShowSuccess(), {
        wrapper: ShowSuccessProvider,
      });

      expect(result.current.showSuccess).toBe(false);
    });
  });

  describe("State Management", () => {
    it("sets showSuccess to true when called", () => {
      const { result } = renderHook(() => useShowSuccess(), {
        wrapper: ShowSuccessProvider,
      });

      act(() => {
        result.current.setShowSuccess(true);
      });

      expect(result.current.showSuccess).toBe(true);
    });

    it("sets showSuccess to false when called", () => {
      const { result } = renderHook(() => useShowSuccess(), {
        wrapper: ShowSuccessProvider,
      });

      act(() => {
        result.current.setShowSuccess(true);
      });

      expect(result.current.showSuccess).toBe(true);

      act(() => {
        result.current.setShowSuccess(false);
      });

      expect(result.current.showSuccess).toBe(false);
    });

    it("supports functional updates", () => {
      const { result } = renderHook(() => useShowSuccess(), {
        wrapper: ShowSuccessProvider,
      });

      act(() => {
        result.current.setShowSuccess(true);
      });

      act(() => {
        result.current.setShowSuccess((prev) => {
          expect(prev).toBe(true);
          return !prev;
        });
      });

      expect(result.current.showSuccess).toBe(false);
    });
  });
});
