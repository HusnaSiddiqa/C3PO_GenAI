import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getTheme } from "../../ThemeV2";
import { FeedbackTabComponent } from "../../screens/Setting/components/SettingTabs/FeedbackTab";
import {
  fetchFeedbackData,
  fetchUserIdsForFeedback,
  searchFeedbackData,
} from "../../screens/Setting/helpers/helpers";
import * as UnsavedTabChangesContext from "../../screens/Setting/context/UnsavedTabChangesContext";

function renderWithProviders(ui: React.ReactElement) {
  const theme = getTheme("light");
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {ui}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

vi.mock("../../screens/Setting/helpers/helpers", async () => {
  const actual = await vi.importActual("../../screens/Setting/helpers/helpers");
  return {
    ...actual,
    fetchFeedbackData: vi.fn(),
    fetchUserIdsForFeedback: vi.fn(),
    searchFeedbackData: vi.fn(),
  };
});

vi.mock("../../screens/Setting/context/UnsavedTabChangesContext");
const mockSetHasUnsavedChanges = vi.fn();
(UnsavedTabChangesContext.useUnsavedChanges as Mock).mockReturnValue({
  setHasUnsavedChanges: mockSetHasUnsavedChanges,
});

const mockFeedbackData = [
  {
    rating: "positive",
    user_id: "user1",
    Agent: "GPT",
    prompt: "Sample prompt",
    response: "Sample response",
    feedback: "Looks good",
    date: "2025-07-20",
    sql_query: "SELECT * FROM table",
    id: "123",
  },
];

const mockUserIds = ["user1", "user2"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FeedbackTabComponent", () => {
  it("shows loading state initially", async () => {
    (fetchFeedbackData as Mock).mockReturnValue(new Promise(() => {}));
    (fetchUserIdsForFeedback as Mock).mockResolvedValue(mockUserIds);
    renderWithProviders(<FeedbackTabComponent />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders feedback table and dropdowns on success", async () => {
    (fetchFeedbackData as Mock).mockResolvedValue(mockFeedbackData);
    (fetchUserIdsForFeedback as Mock).mockResolvedValue(mockUserIds);
    renderWithProviders(<FeedbackTabComponent />);
    await waitFor(() => {
      expect(screen.getByText("Sample prompt")).toBeInTheDocument();
      expect(screen.getByText("User Id: All")).toBeInTheDocument();
      expect(screen.getByText("Rating: All")).toBeInTheDocument();
    });
  });

  it("filters feedback using search", async () => {
    (fetchFeedbackData as Mock).mockResolvedValue(mockFeedbackData);
    (fetchUserIdsForFeedback as Mock).mockResolvedValue(mockUserIds);
    (searchFeedbackData as Mock).mockResolvedValue(mockFeedbackData);

    renderWithProviders(<FeedbackTabComponent />);
    await waitFor(() => screen.getByText("Sample prompt"));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Sample" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(searchFeedbackData).toHaveBeenCalled();
    });
  });

  it("renders no result state when search returns empty", async () => {
    (fetchFeedbackData as Mock).mockResolvedValue(mockFeedbackData);
    (fetchUserIdsForFeedback as Mock).mockResolvedValue(mockUserIds);
    (searchFeedbackData as Mock).mockResolvedValue([]);

    renderWithProviders(<FeedbackTabComponent />);
    await waitFor(() => screen.getByText("Sample prompt"));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "unknown" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("No result found")).toBeInTheDocument();
      expect(screen.getByText("Try a different Keyword")).toBeInTheDocument();
    });
  });
});
