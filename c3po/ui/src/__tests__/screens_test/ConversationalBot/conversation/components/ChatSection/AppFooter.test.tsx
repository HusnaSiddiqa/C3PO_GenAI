import React from 'react';
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppFooter from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/AppFooter";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>);
};

describe("AppFooter", () => {
  it("should render the footer content correctly", () => {
    renderWithTheme(<AppFooter />);
    expect(
      screen.getByText(
        /Make sure AI-generated content is accurate/
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Read more")).toBeInTheDocument();
    expect(screen.getByText("GenAI App © 2026")).toBeInTheDocument();
  });

  it("should call openDisclaimer when 'Read more' is clicked", () => {
    const openDisclaimerMock = vi.fn();
    renderWithTheme(<AppFooter openDisclaimer={openDisclaimerMock} />);
    fireEvent.click(screen.getByText("Read more"));
    expect(openDisclaimerMock).toHaveBeenCalledTimes(1);
  });

  it("should not throw an error when 'Read more' is clicked and openDisclaimer is not provided", () => {
    renderWithTheme(<AppFooter />);
    expect(() =>
      fireEvent.click(screen.getByText("Read more"))
    ).not.toThrow();
  });
});

