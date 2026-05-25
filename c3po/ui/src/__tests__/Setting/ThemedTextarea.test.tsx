import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../../ThemeV2";
import ThemedTextarea from "../../screens/Setting/components/ThemedTextarea";
import "@testing-library/jest-dom";

function renderWithProviders(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("ThemedTextarea", () => {
  describe("Rendering Tests", () => {
    it("renders textarea with provided value", () => {
      const mockOnChange = vi.fn();
      const testValue = "This is a test value";
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value={testValue}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toHaveValue(testValue);
    });

    it("renders with placeholder text", () => {
      const mockOnChange = vi.fn();
      const placeholderText = "Type something here...";
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText={placeholderText}
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText(placeholderText);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe("Overflow Style Tests", () => {
    it("applies overflow auto style via CSS class", () => {
      const mockOnChange = vi.fn();
      const { container } = renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      // Check that the style tag exists with overflow auto
      const styleTag = container.querySelector("style");
      expect(styleTag).toBeInTheDocument();
      expect(styleTag?.textContent).toContain("overflow: auto !important");
    });
  });

  describe("Resizable Tests", () => {
    it("renders with resize vertical when isResizable is true", () => {
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;
      expect(textarea.style.resize).toBe("vertical");
    });

    it("renders with resize none when isResizable is false", () => {
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={false}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;
      expect(textarea.style.resize).toBe("none");
    });
  });

  describe("Error State Tests", () => {
    it("renders without error state by default", () => {
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;
      expect(textarea.style.border).not.toContain("1px solid rgb(197, 32, 63)");
    });

    it("applies error styling when error prop is true", () => {
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
          error={true}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;
      expect(textarea.style.border).toContain("1px solid rgb(197, 32, 63)");
    });
  });

  describe("Interaction Tests", () => {
    it("calls onChange when user types", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      const userTypedText = "New text";
      await user.type(textarea, userTypedText);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it("calls onChange for each character typed", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      const userTypedText = "Test";
      await user.type(textarea, userTypedText);

      // Should be called for each character: T, e, s, t
      expect(mockOnChange).toHaveBeenCalledTimes(userTypedText.length);
    });

    it("handles clearing the textarea", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value="Existing text"
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      await user.clear(textarea);

      expect(mockOnChange).toHaveBeenCalled();
    });

    it("handles multiline text input", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      await user.type(textarea, "Line 1{Enter}Line 2{Enter}Line 3");

      expect(mockOnChange).toHaveBeenCalled();
    });

    it("updates border color on focus", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;
      expect(textarea.style.border).toContain("1px solid rgb(233, 233, 233)");

      await user.click(textarea);

      // After focus, border should be updated
      expect(textarea.style.border).toContain("1px solid rgb(27, 46, 85)");
    });

    it("restores border color on blur", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value=""
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text") as HTMLTextAreaElement;

      // Focus then blur
      await user.click(textarea);
      await user.tab();

      // After blur, border should be restored
      expect(textarea.style.border).toContain("1px solid rgb(233, 233, 233)");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long text content", () => {
      const mockOnChange = vi.fn();
      const longText = "A".repeat(10000);
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value={longText}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toHaveValue(longText);
    });

    it("handles text with special characters", () => {
      const mockOnChange = vi.fn();
      const specialText = "Special chars: @#$%^&*(){}[]|\\;:'\"<>?,./";
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value={specialText}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toHaveValue(specialText);
    });

    it("handles text with Unicode characters", () => {
      const mockOnChange = vi.fn();
      const unicodeText = "Hello 世界 🌍 🚀";
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value={unicodeText}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toHaveValue(unicodeText);
    });

    it("handles text with whitespace and newlines", () => {
      const mockOnChange = vi.fn();
      const formattedText = "Line 1\n\nLine 2\n  Indented line\n\nLine 3";
      renderWithProviders(
        <ThemedTextarea
          minRows={3}
          isResizable={true}
          placeHolderText="Enter text"
          value={formattedText}
          onChange={mockOnChange}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter text");
      expect(textarea).toHaveValue(formattedText);
    });
  });
});
