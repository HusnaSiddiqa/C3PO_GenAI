// DEBUG: Log typeof window and document to check environment
console.log('DEBUG typeof window:', typeof window);
console.log('DEBUG typeof document:', typeof document);
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatSection } from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/ChatSection";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/Chat/Chat",
  () => ({
    __esModule: true,
    Chat: ({ conversationHistory }) => (
      <div data-testid="chat">
        {conversationHistory.map((msg, index) => (
          <div key={index}>{msg.text}</div>
        ))}
      </div>
    ),
  })
);

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

describe("ChatSection", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    queryClient.clear();
  });

  const defaultProps = {
    isMenuOpen: false,
    openMenu: vi.fn(),
    conversationHistory: [],
    toShowInitialStaticLoader: false,
    handleSelectQuestion: vi.fn(),
    conversationLoading: false,
    conversationError: false,
    isBotResponseStreaming: false,
  };

  it("should render with default props", () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          agent_name: "Test Agent",
          agent_description: "Test Description",
        }),
    });
    renderWithProviders(<ChatSection {...defaultProps} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should display conversation title when provided", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          agent_name: "Test Agent",
          agent_description: "Test Description",
        }),
    });
    renderWithProviders(
      <ChatSection {...defaultProps} conversationTitle="My Conversation" />
    );
    expect(await screen.findByText("My Conversation")).toBeInTheDocument();
    expect(await screen.findByText("Test Agent")).toBeInTheDocument();
  });

  it("should show loading skeletons when fetching agent data", () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    const { container } = renderWithProviders(<ChatSection {...defaultProps} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should show skeleton loader if fetching agent data fails", async () => {
    (global.fetch as any).mockRejectedValue(new Error("API Error"));
    renderWithProviders(<ChatSection {...defaultProps} />);
    // The skeleton loader should be present (MUI Skeleton uses class 'MuiSkeleton-root')
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should call openMenu when the menu button is clicked", () => {
    const openMenuMock = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    renderWithProviders(
      <ChatSection {...defaultProps} openMenu={openMenuMock} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(openMenuMock).toHaveBeenCalledTimes(1);
  });

  it("should show loading message when conversation is loading", () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    renderWithProviders(
      <ChatSection {...defaultProps} conversationLoading={true} />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should show error message when there is a conversation error", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    renderWithProviders(
      <ChatSection {...defaultProps} conversationError={true} />
    );
    expect(
      await screen.findByText((content) => content.includes("Error fetching conversation"))
    ).toBeInTheDocument();
  });
});

