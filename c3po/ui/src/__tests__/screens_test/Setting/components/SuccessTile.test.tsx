import { ThemeProvider } from "@mui/material";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SuccessTile
} from "../../../../screens/Setting/components/SuccessTile";
import { getTheme } from "../../../../ThemeV2";


vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({
      spacing: (n: number) => `${n * 4}px`,
      palette: {
        contrast: {
          grayscale: {
            level0: '#fff',
            level10: '#eee',
            level50: '#ccc',
            level100: '#000',
          },
          status: {
            green10: '#e0ffe0',
            green100: '#00ff00',
            redOff10: '#ffe0e0',
            redOff100: '#ff0000',
          },
          main: {
            main10: '#e0e0ff',
            main100: '#0000ff',
          },
          fixed: {
            white: '#ffffff',
          },
        },
      },
    }),
  };
});

const theme = getTheme("light");

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe("SuccessTile", () => {
  it("should not be visible initially", () => {
    renderWithTheme(<SuccessTile visible={false} />);
    expect(screen.queryByText("Save successfully")).not.toBeInTheDocument();
  });

  it("should be visible when the visible prop is true", () => {
    renderWithTheme(<SuccessTile visible={true} />);
    expect(screen.getByText("Save successfully")).toBeInTheDocument();
  });

  it("should fade in and out", async () => {
    const { rerender } = renderWithTheme(<SuccessTile visible={false} />);
    expect(screen.queryByText("Save successfully")).not.toBeInTheDocument();

    rerender(<SuccessTile visible={true} />);
    const successMessage = await screen.findByText("Save successfully");
    expect(successMessage).toBeInTheDocument();
    expect(successMessage.parentElement).toHaveStyle("opacity: 1");

    rerender(<SuccessTile visible={false} />);
    await waitFor(() => {
      expect(successMessage.parentElement).toHaveStyle("opacity: 0");
    });
  });
});
