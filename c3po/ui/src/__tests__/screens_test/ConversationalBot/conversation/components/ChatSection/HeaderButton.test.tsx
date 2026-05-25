import React from 'react';
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeaderButton } from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/HeaderButton";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>);
};

describe("HeaderButton", () => {
  it("should render children correctly", () => {
    renderWithProviders(<HeaderButton>Click Me</HeaderButton>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  it("should handle onClick events", () => {
    const handleClick = vi.fn();
    renderWithProviders(<HeaderButton onClick={handleClick}>Click Me</HeaderButton>);
    fireEvent.click(screen.getByText("Click Me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should accept other Button props, like variant", () => {
    const { container } = renderWithProviders(
      <HeaderButton variant="contained">Contained</HeaderButton>
    );
    // Check for a class that MUI applies for contained buttons
    expect(container.firstChild).toHaveClass("MuiButton-contained");
  });
});
