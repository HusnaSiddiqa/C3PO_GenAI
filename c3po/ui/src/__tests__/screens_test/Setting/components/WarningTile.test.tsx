import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { WarningTile } from "../../../../screens/Setting/components/WarningTile";
import { getTheme } from "../../../../ThemeV2";
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

const theme = getTheme("light");

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe("WarningTile", () => {
  it("should render with the provided message", () => {
    renderWithTheme(<WarningTile visible={true} message="This is a warning" />);
    expect(screen.getByText("This is a warning")).toBeInTheDocument();
  });

  it("renders with message and default width", () => {
    renderWithTheme(<WarningTile visible={true} message="Warning!" />);
    expect(screen.getByText(/warning!/i)).toBeInTheDocument();
  });

  it("renders with custom width", () => {
    renderWithTheme(
      <WarningTile visible={true} message="Width test" width="50%" />
    );
    expect(screen.getByText(/width test/i)).toBeInTheDocument();
  });

  it("does not render when not visible and not shown before", () => {
    const { container } = renderWithTheme(
      <WarningTile visible={false} message="Hidden" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
