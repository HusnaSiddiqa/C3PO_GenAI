import React from 'react';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeedbackIconsBar } from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/FeedbackIconsBar";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserContext } from "../../../../../../contexts/UserContext";

const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider
        value={{
          user: { userId: "test-user", userName: "Test User", userRole: "user" },
          setUser: vi.fn(),
        }}
      >
        <ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>
      </UserContext.Provider>
    </QueryClientProvider>
  );
};

describe("FeedbackIconsBar", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    queryClient.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  const defaultProps = {
    text: "Test message",
    messageId: "test-message-id",
    messageTimestamp: "1234567890",
    rating: undefined,
    comment: "",
  };

  it("should render the feedback icons", () => {
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} />
    );
    const svgs = container.querySelectorAll("svg");
    // We expect ThumbsUp, ThumbsDown, Comment, and Copy icons
    expect(svgs.length).toBe(4);
  });

  it("should handle thumb up click", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} />
    );
    const thumbsUp = container.querySelectorAll("svg")[0];
    fireEvent.click(thumbsUp);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/v2/chat-manager/feedback/message/test-message-id",
        expect.any(Object)
      );
    });
  });

  it("should handle thumb down click", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} />
    );
    const thumbsDown = container.querySelectorAll("svg")[1];
    fireEvent.click(thumbsDown);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/v2/chat-manager/feedback/message/test-message-id",
        expect.any(Object)
      );
    });
  });

  it("should open feedback modal on comment click", () => {
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} rating="positive" />
    );
    const commentIcon = container.querySelectorAll("svg")[2];
    fireEvent.click(commentIcon);
    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
  });

  it("should copy text to clipboard on copy click", async () => {
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} />
    );
    const copyIcon = container.querySelectorAll("svg")[3];
    fireEvent.click(copyIcon);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Test message");
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("should submit feedback from modal", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const { container } = renderWithProviders(
      <FeedbackIconsBar {...defaultProps} rating="positive" />
    );
    const commentIcon = container.querySelectorAll("svg")[2];
    fireEvent.click(commentIcon);
    fireEvent.change(screen.getByPlaceholderText("Type your feedback..."), {
      target: { value: "Great response!" },
    });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/v2/chat-manager/feedback/message/test-message-id",
        expect.any(Object)
      );
    });
  });
});
