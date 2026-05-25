import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentOptions } from "../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/AgentOptions";

// Stable mocks
const invalidateQueriesMock = vi.fn();
const deleteMutateMock = vi.fn();
const updateMutateMock = vi.fn();
const setCurrentConversationId = vi.fn();
const setConversationTitle = vi.fn();

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/styles",
  () => ({
    HistoryContainer: ({ children }: any) => (
      <div data-testid="history-container">{children}</div>
    ),
    SearchInput: ({ children, ...props }: any) => (
      <div>
        <input data-testid="search-input" {...props} />
        {children}
      </div>
    ),
  })
);

vi.mock("@mui/material", async () => {
  const actual = await vi.importActual("@mui/material");
  return {
    ...actual,
    useTheme: () => ({
      spacing: (n: number) => `${n * 4}px`,
      palette: {
        contrast: {
          grayscale: {
            level10: "#eee",
            level50: "#333",
            status: { green100: "#0f0", red: "#f00" },
          },
          main: { main100: "#1976d2" },
          status: { green100: "#0f0", red: "#f00" },
        },
        primary: {
          main: "#1976d2",
          contrastText: "#fff",
        },
        contrastText: "#fff",
        action: {
          hover: "#f5f5f5",
        },
      },
    }),
    Box: (props: any) => <div {...props} />,
    Typography: (props: any) => <div {...props} />,
    TextField: (props: any) => <input data-testid="text-field" {...props} />,
    Tooltip: (props: any) => <div {...props} />,
    InputAdornment: (props: any) => <span {...props} />,
    // ---- Add these Dialog mocks ----
    Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
    DialogTitle: (props: any) => <div {...props} />,
    DialogContent: (props: any) => <div {...props} />,
    DialogActions: (props: any) => <div {...props} />,
    Button: (props: any) => <button {...props} />,
    // --------------------------------
  };
});

vi.mock("@phosphor-icons/react", () => ({
  PlusCircleIcon: () => <span data-testid="plus-icon" />,
  PencilSimpleIcon: (props: any) => <span data-testid="edit-icon" {...props} />,
  TrashIcon: (props: any) => <span data-testid="delete-icon" {...props} />,
  CaretRightIcon: (props: any) => <span data-testid="caret-icon" {...props} />,
  CheckCircleIcon: (props: any) => <span data-testid="check-icon" {...props} />,
  XCircleIcon: (props: any) => <span data-testid="x-icon" {...props} />,
  MagnifyingGlassIcon: () => <span data-testid="search-icon" />,
}));

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/HeaderButton",
  () => ({
    HeaderButton: (props: any) => (
      <button data-testid="header-button" {...props} />
    ),
  })
);

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/updateTitleData",
  () => ({
    UpdateTitleData: () => ({ mutate: updateMutateMock }),
  })
);

vi.mock(
  "../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/deleteConversation",
  () => ({
    DeleteConversation: () => ({ mutate: deleteMutateMock }),
  })
);

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ conversationId: "conv1" }),
}));

vi.mock("../../../../../../contexts/UserContext", () => ({
  UserContext: React.createContext({ user: { userId: "user1" } }),
}));

const mockHistoryData = {
  chatHistory: {
    today: [
      {
        conversation_id: "conv1",
        timestamp: "2024-08-01T12:00:00Z",
        title: "Test Conversation",
      },
    ],
  },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mockHistoryData,
    isLoading: false,
    error: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

describe("AgentOptions", () => {
  // let setCurrentConversationId: any;
  // let setConversationTitle: any;

  beforeEach(() => {
    setCurrentConversationId.mockReset();
    setConversationTitle.mockReset();
    invalidateQueriesMock.mockReset();
    deleteMutateMock.mockReset();
    updateMutateMock.mockReset();
  });

  it("renders search input and history container", () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    expect(screen.getByTestId("history-container")).toBeInTheDocument();
    expect(screen.getByTestId("text-field")).toBeInTheDocument();
  });

  it("renders conversation title from chat history", () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    expect(screen.getByText("Test Conversation")).toBeInTheDocument();
  });

  it("calls setConversationTitle on mount", async () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    await waitFor(() => {
      expect(setConversationTitle).toHaveBeenCalledWith("Test Conversation");
    });
  });

  it("filters conversations by search input", () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    fireEvent.change(screen.getByTestId("text-field"), {
      target: { value: "Nonexistent" },
    });
    expect(screen.queryByText("Test Conversation")).not.toBeInTheDocument();
  });

  it("calls delete mutation when delete icon is clicked", async () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    // Expand options for the conversation
    fireEvent.click(screen.getByTestId("caret-icon"));
    // Click the delete icon
    fireEvent.click(screen.getByTestId("delete-icon"));
    // Assert the delete mutation was called
    await waitFor(() => {
      expect(deleteMutateMock).toHaveBeenCalledWith("conv1");
    });
  });

  it("updates conversation title on title edit", async () => {
    render(
      <AgentOptions
        setCurrentConversationId={setCurrentConversationId}
        setConversationTitle={setConversationTitle}
      />
    );
    // Expand options for the first conversation
    fireEvent.click(screen.getAllByTestId("caret-icon")[0]);
    // Click the edit icon for the first conversation
    fireEvent.click(screen.getAllByTestId("edit-icon")[0]);
    // Use the correct test id for the edit input
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "New Title" },
    });
    // Click the save (check) icon for the first conversation
    fireEvent.click(screen.getAllByTestId("check-icon")[0]);
    await waitFor(() => {
      expect(updateMutateMock).toHaveBeenCalledWith(
        {
          conversation_id: "conv1",
          title: "New Title",
        },
        expect.any(Object)
      );
    });
  });
});
