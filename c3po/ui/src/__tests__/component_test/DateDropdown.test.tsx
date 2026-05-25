import { render, screen, fireEvent } from "@testing-library/react";
import { DateDropdown } from "../../screens/Setting/components/DateDropdown";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../ThemeV2";
import React from "react";
import { describe, expect, it, vi } from "vitest";

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("DateDropdown", () => {
  it("renders with default label", () => {
    renderWithTheme(<DateDropdown onChange={vi.fn()} />);
    expect(screen.getByText(/date: all/i)).toBeInTheDocument();
  });

  it("calls onChange with all data when 'All' is clicked", () => {
    const onChange = vi.fn();
    renderWithTheme(<DateDropdown onChange={onChange} />);
    const trigger = screen.getByText(/date: all/i).closest("div");
    fireEvent.click(trigger!);
    const allOption = screen.getByText(/^all$/i).closest("div");
    fireEvent.click(allOption!);
    expect(onChange).toHaveBeenCalledWith({
      range: { from: null, to: null },
      showAllData: true,
    });
    // Dropdown closes
    expect(screen.queryByText(/^all$/i)).not.toBeInTheDocument();
  });

  it("radio button reflects showAllData state", () => {
    renderWithTheme(<DateDropdown onChange={vi.fn()} />);
    const trigger = screen.getByText(/date: all/i).closest("div");
    fireEvent.click(trigger!);
    const radio = screen.getByRole("radio");
    expect(radio).toBeChecked();
  });
});
