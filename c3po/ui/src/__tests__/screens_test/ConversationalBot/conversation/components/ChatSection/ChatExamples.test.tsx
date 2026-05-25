// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChatExamples } from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/ChatExamples";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

const mockClickableData = [
  {
    category: "Sales Analysis",
    clickable_questions: [
      { id: 1, question: "What were the total sales last quarter?" },
      { id: 2, question: "Which product had the highest sales in May?" },
    ],
  },
  {
    category: "Customer Insights",
    clickable_questions: [
      { id: 3, question: "What is the average customer satisfaction score?" },
    ],
  },
];

describe("ChatExamples", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    queryClient.clear();
  });

  it("should display a loading state initially", () => {
    (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves
    renderWithProviders(
      <ChatExamples select={vi.fn()} getAgentName="Test Agent" />
    );
    expect(
      screen.getByText("Loading clickable questions...")
    ).toBeInTheDocument();
  });

  it("should display a loading state if fetching fails and retry is enabled", async () => {
    (global.fetch as any).mockRejectedValue(new Error("API Error"));
    renderWithProviders(
      <ChatExamples select={vi.fn()} getAgentName="Test Agent" />
    );

    // Wait for the loading message to be present
    expect(await screen.findByText("Loading clickable questions...")).toBeInTheDocument();
    // Optionally, ensure the error message is not present
    expect(screen.queryByText("Failed to load clickable questions. Please try again later.")).not.toBeInTheDocument();
  });

  it("should render categories and questions on successful fetch", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockClickableData),
    });
    renderWithProviders(
      <ChatExamples select={vi.fn()} getAgentName="Test Agent" />
    );

    await waitFor(() => {
      expect(screen.getByText("Sales Analysis")).toBeInTheDocument();
      expect(
        screen.getByText("What were the total sales last quarter?")
      ).toBeInTheDocument();
      expect(screen.getByText("Customer Insights")).toBeInTheDocument();
    });
  });

  it("should call the select function with the question when a question is clicked", async () => {
    const selectMock = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockClickableData),
    });
    renderWithProviders(
      <ChatExamples select={selectMock} getAgentName="Test Agent" />
    );

    await waitFor(async () => {
      const questionElement = await screen.findByText(
        "Which product had the highest sales in May?"
      );
      fireEvent.click(questionElement);
      expect(selectMock).toHaveBeenCalledWith(
        "Which product had the highest sales in May?"
      );
    });
  });

  it("should display a message when no clickable questions are available", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    renderWithProviders(
      <ChatExamples select={vi.fn()} getAgentName="Test Agent" />
    );

    expect(
      await screen.findByText("No clickable questions available.")
    ).toBeInTheDocument();
  });
});
