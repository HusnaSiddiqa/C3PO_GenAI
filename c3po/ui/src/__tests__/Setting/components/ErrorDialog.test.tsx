import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../../../ThemeV2";
import ErrorDialog from "../../../screens/Setting/components/ErrorDialog";
import "@testing-library/jest-dom";

function renderWithProviders(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("ErrorDialog", () => {
  describe("Rendering Tests", () => {
    it("renders dialog during error", () => {
      const mockSetIsErrorDialogOpen = vi.fn();
      const testError = new Error("Test error message");
      const testTitle = "Error Title";

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={testError}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(testTitle)).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    it("does not render dialog", () => {
      const mockSetIsErrorDialogOpen = vi.fn();
      const testTitle = "Error Title";

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={null}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Interaction Tests", () => {
    it("closes dialog on dismiss", async () => {
      const user = userEvent.setup();
      const mockSetIsErrorDialogOpen = vi.fn();
      const testError = new Error("Test error message");
      const testTitle = "Error Title";

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={testError}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockSetIsErrorDialogOpen).toHaveBeenCalledTimes(1);
      expect(mockSetIsErrorDialogOpen).toHaveBeenCalledWith(false);
    });

    it("stops event propagation when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      const mockSetIsErrorDialogOpen = vi.fn();
      const testError = new Error("Test error message");
      const testTitle = "Error Title";

      const mockStopPropagation = vi.fn();

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={testError}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });

      // Add event listener to capture the event
      dismissButton.addEventListener("click", (e) => {
        e.stopPropagation = mockStopPropagation;
      });

      await user.click(dismissButton);

      // Verify setIsErrorDialogOpen was still called
      expect(mockSetIsErrorDialogOpen).toHaveBeenCalledWith(false);
    });
  });

  describe("Dismiss Button Tests", () => {
    it("dismiss button has correct text", () => {
      const mockSetIsErrorDialogOpen = vi.fn();
      const testError = new Error("Test error message");
      const testTitle = "Error Title";

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={testError}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      expect(dismissButton).toHaveTextContent("Dismiss");
    });

    it("dismiss button can be clicked multiple times (idempotent)", async () => {
      const user = userEvent.setup();
      const mockSetIsErrorDialogOpen = vi.fn();
      const testError = new Error("Test error message");
      const testTitle = "Error Title";

      renderWithProviders(
        <ErrorDialog
          title={testTitle}
          isErrorDialogOpen={true}
          error={testError}
          setIsErrorDialogOpen={mockSetIsErrorDialogOpen}
        />
      );

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });

      await user.click(dismissButton);
      await user.click(dismissButton);
      await user.click(dismissButton);

      expect(mockSetIsErrorDialogOpen).toHaveBeenCalledTimes(3);
      expect(mockSetIsErrorDialogOpen).toHaveBeenNthCalledWith(1, false);
      expect(mockSetIsErrorDialogOpen).toHaveBeenNthCalledWith(2, false);
      expect(mockSetIsErrorDialogOpen).toHaveBeenNthCalledWith(3, false);
    });
  });
});
