import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { vi } from "vitest";
import { DirtyChangesWarning } from "../../../../screens/Setting/components/DirtyChangesWarning";
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


describe("DirtyChangesWarning", () => {
  it("should call onStay when the 'Stay' button is clicked", () => {
    const onStay = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(
      <DirtyChangesWarning open={true} onStay={onStay} onClose={onClose} />
    );
    screen.getByText("Stay").click();
    expect(onStay).toHaveBeenCalled();
  });

  it("should call onClose when the 'Leave without saving' button is clicked", () => {
    const onStay = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(
      <DirtyChangesWarning open={true} onStay={onStay} onClose={onClose} />
    );
    screen.getByText("Leave without saving").click();
    expect(onClose).toHaveBeenCalled();
  });
})
