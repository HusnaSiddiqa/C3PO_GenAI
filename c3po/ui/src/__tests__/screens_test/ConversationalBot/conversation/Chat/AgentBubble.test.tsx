import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AgentBubble } from "../../../../../screens/ConversationalBot/conversation/Chat/AgentBubble";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "../../../../../screens/ConversationalBot/conversation/components/ChatSection/TableDataVisualizer",
  () => ({
    __esModule: true,
    default: () => <div data-testid="table-visualizer">Mock Table</div>,
  })
);

vi.mock(
  "../../../../../screens/ConversationalBot/conversation/components/ChatSection/DynamicChart",
  () => ({
    __esModule: true,
    default: () => <div data-testid="dynamic-chart">Mock Chart</div>,
  })
);

vi.mock(
  "../../../../../screens/ConversationalBot/conversation/components/ChatSection/FeedbackIconsBar",
  () => ({
    __esModule: true,
    FeedbackIconsBar: () => <div data-testid="feedback-bar">Mock Feedback</div>,
  })
);
const theme = createTheme({
  palette: {
    grey: { 500: "#888" },
    contrast: {
      main: { main100: "#1976d2" },
      grayscale: {
        level0: "#fff",
        level5: "#fafafa",
        level10: "#eee",
        level50: "#333",
        level75: "#888",
        level100: "#111",
      },
      fixed: { white: "#fff" },
      status: { blue10: "#d0e6ff", redOff10: "#ffdddd", redOff100: "#990000" },
    },
    error: { main: "#f00", light: "#faa" },
    primary: { main: "#1976d2" },
    text: { secondary: "#888", primary: "#111" },
  },
  spacing: (n: number) => `${n * 4}px`,
});

const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactNode) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

const baseAgentBubbleProps = {
  dataLimitExceeded: false,
  conversationId: "test-conversation-id",
  csvFileName: "test.csv",
  userId: "test-user",
};

describe("AgentBubble", () => {
  // ...existing tests...

  it("renders loader when toShowInitialStaticLoader is true", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-loader"
        type="text"
        content="Loading..."
        toShowInitialStaticLoader={true}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="Loader Agent"
      />
    );
    expect(screen.getByText("Loader Agent is thinking...")).toBeInTheDocument();
  });

  it("renders thinking visualDataType", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-thinking"
        type="text"
        content="Thinking content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="thinking"
        chartData={null}
        getAgentName="Thinker"
      />
    );
    expect(screen.getByText("Thinking content")).toBeInTheDocument();
  });

  it("renders agent-routing visualDataType with selected_agents", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-routing"
        type="text"
        content="Routing info"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="agent-routing"
        chartData={null}
        getAgentName="Router"
        selected_agents={["AgentA", "AgentB"]}
      />
    );
    expect(screen.getByText("Routing info")).toBeInTheDocument();
    expect(
      screen.getByText(/Selected Agents: AgentA, AgentB/)
    ).toBeInTheDocument();
  });

  it("renders agent-routing visualDataType without selected_agents", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-routing2"
        type="text"
        content="Routing info"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="agent-routing"
        chartData={null}
        getAgentName="Router"
      />
    );
    expect(screen.getByText("Routing info")).toBeInTheDocument();
    expect(screen.queryByText(/Selected Agents:/)).not.toBeInTheDocument();
  });

  it("renders working visualDataType", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-working"
        type="text"
        content="Working content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="working"
        chartData={null}
        getAgentName="Worker"
      />
    );
    expect(screen.getByText("Working content")).toBeInTheDocument();
  });

  it("renders error visualDataType with error_type", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-error"
        type="text"
        content="Error content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="error"
        chartData={null}
        getAgentName="ErrorAgent"
        error_type="SomeErrorType"
      />
    );
    expect(screen.getByText("Error Occurred")).toBeInTheDocument();
    expect(screen.getByText("Error content")).toBeInTheDocument();
    expect(screen.getByText(/Error Type: SomeErrorType/)).toBeInTheDocument();
  });

  it("renders error visualDataType without error_type", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-error2"
        type="text"
        content="Error content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="error"
        chartData={null}
        getAgentName="ErrorAgent"
      />
    );
    expect(screen.getByText("Error Occurred")).toBeInTheDocument();
    expect(screen.getByText("Error content")).toBeInTheDocument();
    expect(screen.queryByText(/Error Type:/)).not.toBeInTheDocument();
  });

  it("renders default StreamingText when no special visualDataType", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-default"
        type="text"
        content="Default streaming"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="DefaultAgent"
      />
    );
    expect(screen.getByText("Default streaming")).toBeInTheDocument();
  });

  it("renders FeedbackIconsBar with all feedback props", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-feedback"
        type="text"
        content="Feedback content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="FeedbackAgent"
        rating="good"
        comment="Nice job"
      />
    );
    expect(screen.getByTestId("feedback-bar")).toBeInTheDocument();
  });

  it("renders ThinkingBlock when thinkingSteps are provided and not streaming", () => {
    const thinkingSteps = [
      { content: "Analyzing query...", stage: "analysis" },
      { content: "Fetching data...", stage: "data-fetch" },
    ];
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-thinking-block"
        type="text"
        content="Final response"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="ThinkingAgent"
        thinkingSteps={thinkingSteps}
      />
    );
    expect(screen.getByText("Final response")).toBeInTheDocument();
    expect(screen.getByText(/Thinking Process/)).toBeInTheDocument();
    expect(screen.getByText("2 steps")).toBeInTheDocument();
  });

  it("does not render ThinkingBlock when streaming is in progress", () => {
    const thinkingSteps = [
      { content: "Analyzing query...", stage: "analysis" },
    ];
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-streaming"
        type="text"
        content="Streaming content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={true}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="StreamingAgent"
        thinkingSteps={thinkingSteps}
      />
    );
    expect(screen.queryByText(/Thinking Process/)).not.toBeInTheDocument();
  });

  it("does not render ThinkingBlock when thinkingSteps is empty", () => {
    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-no-thinking"
        type="text"
        content="Response without thinking"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType=""
        chartData={null}
        getAgentName="NoThinkingAgent"
        thinkingSteps={[]}
      />
    );
    expect(screen.getByText("Response without thinking")).toBeInTheDocument();
    expect(screen.queryByText(/Thinking Process/)).not.toBeInTheDocument();
  });

  it("does not render ThinkingBlock for error messages", () => {
    const thinkingSteps = [
      { content: "Analyzing query...", stage: "analysis" },
    ];

    renderWithProviders(
      <AgentBubble
        {...baseAgentBubbleProps}
        messageId="msg-error-thinking"
        type="text"
        content="Error content"
        toShowInitialStaticLoader={false}
        isBotResponseStreaming={false}
        visualTableData={[]}
        visualDataType="error"
        chartData={null}
        getAgentName="ErrorAgent"
        thinkingSteps={thinkingSteps}
      />
    );

    expect(screen.getByText("Error Occurred")).toBeInTheDocument();
    expect(screen.getByText("Error content")).toBeInTheDocument();
    expect(screen.queryByText(/Thinking Process/)).not.toBeInTheDocument();
  });
});
