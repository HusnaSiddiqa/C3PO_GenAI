import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmationDialog } from "../../../screens/Setting/components/SettingTabs/PromptTemplatesTab/DeleteConfirmationDialog";
import { getTheme } from "../../../ThemeV2";
import "@testing-library/jest-dom";

const theme = getTheme("light");

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe("DeleteConfirmationDialog", () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    agentName: "Test Agent",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders the dialog", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
    });

    it("displays the correct dialog title", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      expect(screen.getByText("Delete Sub-Agent")).toBeInTheDocument();
    });

    it("displays the agent name in the confirmation message", () => {
      renderWithTheme(
        <DeleteConfirmationDialog {...defaultProps} agentName="My Test Agent" />
      );

      expect(screen.getByText(/My Test Agent/)).toBeInTheDocument();
    });

    it("displays the warning message correctly", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      expect(
        screen.getByText(/This action cannot be undone/)
      ).toBeInTheDocument();
    });

    it("renders both Cancel and Delete buttons", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });
  });

  describe("Interaction Tests", () => {
    it("cancels the dialog when Cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      renderWithTheme(
        <DeleteConfirmationDialog {...defaultProps} onCancel={onCancel} />
      );

      const cancelButton = screen.getByText("Cancel");
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("deletes the agent when Delete button is clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      renderWithTheme(
        <DeleteConfirmationDialog {...defaultProps} onConfirm={onConfirm} />
      );

      const deleteButton = screen.getByText("Delete");
      await user.click(deleteButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dialog State Tests", () => {
    it("does not render dialog content", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} open={false} />);

      expect(screen.queryByText("Delete Sub-Agent")).not.toBeInTheDocument();
    });

    it("renders dialog content", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      expect(screen.getByText("Delete Sub-Agent")).toBeInTheDocument();
    });
  });

  describe("Agent Name Display Tests", () => {
    it("displays agent name in bold", () => {
      renderWithTheme(
        <DeleteConfirmationDialog {...defaultProps} agentName="Bold Agent" />
      );

      const strongElement = screen.getByText("Bold Agent");
      expect(strongElement.tagName).toBe("STRONG");
    });
  });

  describe("Button Styling Tests", () => {
    it("Delete button has error styling", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      const deleteButton = screen.getByText("Delete").closest("button");
      expect(deleteButton).toHaveStyle({
        backgroundColor: theme.palette.error.main,
      });
    });

    it("Cancel button has outlined variant", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      const cancelButton = screen.getByText("Cancel").closest("button");
      expect(cancelButton).toHaveClass("MuiButton-outlined");
    });

    it("Delete button has contained variant", () => {
      renderWithTheme(<DeleteConfirmationDialog {...defaultProps} />);

      const deleteButton = screen.getByText("Delete").closest("button");
      expect(deleteButton).toHaveClass("MuiButton-contained");
    });
  });
});
