import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { getTheme } from "../../../../ThemeV2";
import { ErrorTile } from "../../../../screens/Setting/components/ErrorTile";
import { vi } from "vitest";

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

describe("ErrorTile", () => {
  it("should render with the provided message", () => {
    renderWithTheme(<ErrorTile visible message="This is an error" />);
    expect(screen.getByText("This is an error")).toBeInTheDocument();
  });

  it("renders with default message when visible", () => {
    renderWithTheme(<ErrorTile visible={true} />);
    expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
  });

  it("renders with custom message when visible", () => {
    renderWithTheme(<ErrorTile visible={true} message="Custom error" />);
    expect(screen.getByText(/custom error/i)).toBeInTheDocument();
  });

  it("does not render when not visible and not shown before", () => {
    const { container } = renderWithTheme(<ErrorTile visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const theme = getTheme("light");

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};
