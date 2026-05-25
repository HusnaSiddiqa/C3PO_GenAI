import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import PromptTemplateField from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/PromptTemplateField";
import "@testing-library/jest-dom";

// Mock LabelledInputTextField
vi.mock("../../../screens/Setting/components/LabelledInputTextField", () => ({
  LabelledInputTextField: vi.fn(({ label, value, onChange, error, minRows, maxRows, multiline, placeHolderText, isFullWidth }) => (
    <div data-testid="labelled-input-textfield">
      {label}
      <textarea
        data-testid="prompt-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeHolderText}
        className={error ? "error" : ""}
        rows={minRows}
        data-multiline={multiline}
        data-full-width={isFullWidth}
        data-max-rows={maxRows}
      />
    </div>
  )),
}));

function renderWithProviders(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("PromptTemplateField", () => {
  describe("Rendering Tests", () => {
    it("renders with label 'Prompt Template'", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
        />
      );

      expect(screen.getByText("Prompt Template")).toBeInTheDocument();
    });

    it("renders textarea with provided prompt value", () => {
      const mockSetPrompt = vi.fn();
      const testPrompt = "This is a test prompt template";
      renderWithProviders(
        <PromptTemplateField
          prompt={testPrompt}
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveValue(testPrompt);
    });

    it("renders with empty prompt", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt=""
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveValue("");
    });

    it("renders with placeholder text", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt=""
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByPlaceholderText("Enter your prompt template here*");
      expect(textarea).toBeInTheDocument();
    });

    it("renders error state when error prop is true", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
          error={true}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveClass("error");
    });

    it("renders without error state when error prop is false", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
          error={false}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).not.toHaveClass("error");
    });

    it("renders multiline textarea", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveAttribute("data-multiline", "true");
    });

    it("renders with full width", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveAttribute("data-full-width", "true");
    });
  });

  describe("MinRows and MaxRows Tests", () => {
    it("renders with default rows", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toBeInTheDocument();
    });

    it("renders with min rows", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
          minRows={5}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveAttribute("rows", "5");
    });

    it("renders with max rows", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
          maxRows={10}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveAttribute("data-max-rows", "10");
    });

    it("renders with both min rows and max rows", () => {
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Test prompt"
          setPrompt={mockSetPrompt}
          minRows={3}
          maxRows={8}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      expect(textarea).toHaveAttribute("rows", "3");
      expect(textarea).toHaveAttribute("data-max-rows", "8");
    });
  });

  describe("Interaction Tests", () => {
    it("changes value on user input", async () => {
      const user = userEvent.setup();
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt=""
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      await user.type(textarea, "New prompt text");

      expect(mockSetPrompt).toHaveBeenCalled();
    });

    it("updates value when user types", async () => {
      const user = userEvent.setup();
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt=""
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      await user.type(textarea, "Test");

      // setPrompt should be called for each character typed
      expect(mockSetPrompt).toHaveBeenCalledTimes(4); // T, e, s, t
    });

    it("handles clearing the prompt", async () => {
      const user = userEvent.setup();
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt="Existing prompt"
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      await user.clear(textarea);

      expect(mockSetPrompt).toHaveBeenCalledWith("");
    });

    it("handles multiline text input", async () => {
      const user = userEvent.setup();
      const mockSetPrompt = vi.fn();
      renderWithProviders(
        <PromptTemplateField
          prompt=""
          setPrompt={mockSetPrompt}
        />
      );

      const textarea = screen.getByTestId("prompt-textarea");
      await user.type(textarea, "Line 1{Enter}Line 2{Enter}Line 3");

      expect(mockSetPrompt).toHaveBeenCalledTimes(20);
    });
  });
});
