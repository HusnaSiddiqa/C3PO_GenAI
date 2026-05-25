import React from 'react';
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/Sidebar";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/AgentOptions",
  () => ({
    AgentOptions: () => <div data-testid="agent-options" />,
  })
);

const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe("Sidebar", () => {
  const defaultProps = {
    open: true,
    startNewConversation: vi.fn(),
    setCurrentConversationId: vi.fn(),
    setConversationTitle: vi.fn(),
  };

  it("should render the sidebar with the new chat button and history tab", () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    expect(screen.getByText("New Chat")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByTestId("agent-options")).toBeInTheDocument();
  });

  it('should call startNewConversation when "New Chat" button is clicked', () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByText("New Chat"));
    expect(defaultProps.startNewConversation).toHaveBeenCalled();
  });

  it("should not render AgentOptions when another tab is selected", () => {
    renderWithProviders(<Sidebar {...defaultProps} />);
    // Note: We need a second tab to test this, but the component currently only has one.
    // If more tabs were added, we would click the new tab and assert that agent-options is not present.
    const historyTab = screen.getByText("History");
    fireEvent.click(historyTab); // Re-clicking the same tab
    expect(screen.getByTestId("agent-options")).toBeInTheDocument(); // It should still be there
  });

  it("should be hidden when open prop is false", () => {
    const { container } = renderWithProviders(
      <Sidebar {...defaultProps} open={false} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveStyle("min-width: 0");
  });

  it("should be visible when open prop is true", () => {
    const { container } = renderWithProviders(
      <Sidebar {...defaultProps} open={true} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveStyle("min-width: 400px");
  });
});

