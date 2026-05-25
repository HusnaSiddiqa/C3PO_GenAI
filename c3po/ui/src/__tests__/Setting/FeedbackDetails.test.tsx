import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../ThemeV2";
import { FeedbackDetails } from "../../screens/Setting/components/SettingTabs/feedbackDetails";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mocks
vi.mock("../../helpers/helpers", () => ({
  updateFeedbackDetails: vi.fn().mockResolvedValue({
    sql_query: "SELECT * FROM updated",
  }),
}));
vi.mock("../../context/UnsavedTabChangesContext", () => ({
  useUnsavedChanges: () => ({ setHasUnsavedChanges: vi.fn() }),
}));
vi.mock("../../../../../src/contexts/UserContext", () => ({
  UserContext: { Provider: ({ children }) => children },
  useContext: () => ({ userName: "test-user@gilead.com" }),
}));

const selectedRowData = {
  user_id: "user123",
  rating: { props: { values: "positive" } },
  sql_query: "SELECT * FROM feedback",
  prompt: "Prompt example",
  response: "Response text for popup",
  Agent: "AgentGPT",
  feedback: "Some feedback",
  id: { props: { values: "abc-123" } },
};

function renderComponent(props = {}) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme("light")}>
        <FeedbackDetails
          selectedRowData={selectedRowData}
          showFeedbackDetailsFlag={true}
          onBackButtonClick={vi.fn()}
          {...props}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("FeedbackDetails Component", () => {
  it("renders with provided row data", () => {
    renderComponent();
    expect(screen.getByText("User ID:")).toBeInTheDocument();
    expect(screen.getByText("Prompt example")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("SELECT * FROM feedback")
    ).toBeInTheDocument();
  });

  it("enables Save button when SQL query changes", () => {
    renderComponent();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "SELECT * FROM changed" } });
    const saveButton = screen.getByText("Save");
    expect(saveButton).toBeEnabled();
  });

  it("calls onBackButtonClick if no unsaved changes", () => {
    const onBackMock = vi.fn();
    renderComponent({ onBackButtonClick: onBackMock });
    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);
    expect(onBackMock).toHaveBeenCalled();
  });

  it("opens popup on 'View All' click", () => {
    renderComponent();
    fireEvent.click(screen.getByText("View All"));
    expect(screen.getByText("AgentGPT")).toBeInTheDocument();
  });
});
