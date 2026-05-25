import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, vi, beforeEach, expect } from "vitest";
import { ThemeProvider } from "@mui/material/styles";
import { useMutation } from "@tanstack/react-query";

import "@testing-library/jest-dom";
import type { Mock } from "vitest";
import { getTheme } from "../../ThemeV2";
import { BenchmarkingTab } from "../../screens/Setting/components/SettingTabs/BenchmarkingTab";
import { act } from "react";

// Helper
function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(
    <ThemeProvider theme={theme}>
      {/* <UserContext.Provider value={{ user: "test-user" }}> */}
      {ui}
      {/* </UserContext.Provider> */}
    </ThemeProvider>
  );
}

// Mocks
vi.mock("@tanstack/react-query");

const mockUpload = vi.fn();
const mockGetQuestions = vi.fn();
const mockUpdateQuestions = vi.fn();
const mockGetScores = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (useMutation as unknown as Mock).mockImplementation(({ mutationFn }) => {
    switch (mutationFn.name) {
      case "uploadClickableFile":
        return { mutate: mockUpload };
      case "getClickableQuestions":
        return { mutate: mockGetQuestions };
      case "updateClickableQuestions":
        return { mutate: mockUpdateQuestions };
      case "fetchBenchmarkingMatchScores":
        return { mutate: mockGetScores };
      default:
        return {};
    }
  });
});

describe("BenchmarkingTab", () => {
  it("renders title and buttons", () => {
    renderWithTheme(<BenchmarkingTab />);
    expect(screen.getByText(/benchmarking/i)).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
  });

  it("opens info box when info icon is clicked", () => {
    renderWithTheme(<BenchmarkingTab />);
    const infoIcon = screen.getByLabelText("info");
    fireEvent.click(infoIcon);
    expect(screen.getByText(/file format guidelines/i)).toBeInTheDocument();
  });

  it("calls uploadFile on file selection", async () => {
    renderWithTheme(<BenchmarkingTab />);
    const input = screen.getByPlaceholderText("No file selected");
    const file = new File(["question,answer"], "test.csv", {
      type: "text/csv",
    });

    // Find the actual hidden input inside the button
    const fileInput = screen
      .getByRole("textbox")
      .parentElement?.querySelector("input[type=file]");
    expect(fileInput).toBeTruthy();

    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalled();
      });
    }
  });

  // it("calls getMatchScores on Run", () => {
  //   renderWithTheme(<BenchmarkingTab />);
  //   fireEvent.click(screen.getByText("Run"));
  //   expect(mockGetScores).toHaveBeenCalled();
  // });

  it.skip("renders success tile when updateClickableQuestions succeeds", async () => {
    let updateQuestionsMutate: () => void;
    let getQuestionsMutate: () => void;

    (useMutation as unknown as Mock).mockImplementation(
      ({ mutationFn, onSuccess }) => {
        if (mutationFn.name === "getClickableQuestions") {
          getQuestionsMutate = () => {
            onSuccess?.([
              {
                PK: "1",
                SK: "1",
                question_id: "q1",
                question: "What is your name?",
                expected_answer: "John",
                sql_query: "SELECT name FROM users;",
                enabled: true,
                category: "Personal",
                order: "1",
              },
            ]);
          };
          return { mutate: getQuestionsMutate };
        }

        if (mutationFn.name === "updateClickableQuestions") {
          updateQuestionsMutate = () => {
            onSuccess?.({
              updated_items: [{ updated_at: new Date().toISOString() }],
            });
          };
          return { mutate: updateQuestionsMutate };
        }

        if (mutationFn.name === "uploadClickableFile") {
          return {
            mutate: () => {
              getQuestionsMutate?.(); // simulate refetch after file upload
            },
          };
        }

        return { mutate: vi.fn() };
      }
    );

    // Act
    renderWithTheme(<BenchmarkingTab />);

    // Simulate file upload
    const fileInput = screen.getByPlaceholderText(
      "No file selected"
    ) as HTMLInputElement;
    const file = new File(["csv content"], "test.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    act(() => {
      updateQuestionsMutate?.();
    });

    await waitFor(() => {
      expect(screen.getByText(/save/i)).toBeInTheDocument(); // adjust this if your success message is different
    });
  });

  it("renders error tile when updateClickableQuestions fails", async () => {
    const mockError = new Error("Mutation failed");

    (useMutation as unknown as Mock).mockImplementation(
      ({ mutationFn, onError }) => {
        if (mutationFn.name === "updateClickableQuestions") {
          return {
            mutate: () => {
              onError?.(mockError);
            },
          };
        }

        return { mutate: vi.fn() };
      }
    );

    renderWithTheme(<BenchmarkingTab />);

    const updateCall = (useMutation as Mock).mock.calls.find(
      ([args]) => args.mutationFn.name === "updateClickableQuestions"
    );

    if (!updateCall) {
      throw new Error("updateClickableQuestions mutation not found");
    }

    const updateArgs = updateCall[0];

    act(() => {
      updateArgs.onError?.(mockError);
    });

    await waitFor(() => {
      expect(screen.getByText("Mutation failed")).toBeInTheDocument();
    });
  });

  // it("allows toggling the clickable switch", async () => {
  //   const sampleQuestions = [
  //     {
  //       PK: "1",
  //       SK: "1",
  //       question: "Q1",
  //       expected_answer: "A1",
  //       expected_sql: "SELECT *",
  //       enabled: false,
  //       category: "Test",
  //     },
  //   ];

  //   (useMutation as unknown as Mock).mockImplementation(
  //     ({ mutationFn, onSuccess }) => {
  //       if (mutationFn.name === "getClickableQuestions") {
  //         return {
  //           mutate: () => {
  //             onSuccess?.(sampleQuestions);
  //           },
  //         };
  //       }
  //       return { mutate: vi.fn() };
  //     }
  //   );

  //   renderWithTheme(<BenchmarkingTab />);
  //   await waitFor(() => {
  //     expect(screen.getByText("Q1")).toBeInTheDocument();
  //   });

  //   const toggleIcon = screen.getByRole("img", { hidden: true });
  //   fireEvent.click(toggleIcon);

  //   // You can check internal state or visual feedback here if needed
  // });
});
