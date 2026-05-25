import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { SearchInput } from "../../../../../../screens/ConversationalBot/conversation/components/SearchInput/SearchInput";
import "@testing-library/jest-dom";
import { vi } from "vitest";

const mockOnSearch = vi.fn();
const mockResetDefault = vi.fn();
const mockOnFileUploaded = vi.fn();
const mockOnStreamStopButtonClick = vi.fn();

const renderWithProviders = (props = {}) => {
  const queryClient = new QueryClient();
  const theme = createTheme({
    palette: {
      contrast: {
        grayscale: {
          level10: "#f0f0f0",
          level50: "#888888",
        },
        status: {
          redOff10: "#ffcccc",
          redOff100: "#ff0000",
        },
        main: { main100: "#1976d2" },
      },
      background: {
        paper: "#fff",
      },
      text: {
        primary: "#000",
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <SearchInput
          onSearch={mockOnSearch}
          loading={false}
          disabled={false}
          streamError=""
          onFileUploaded={mockOnFileUploaded}
          onStreamStopButtonClick={mockOnStreamStopButtonClick}
          defaultInput=""
          resetDefault={mockResetDefault}
          {...props}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe("SearchInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders input and submit button", () => {
    renderWithProviders();
    expect(
      screen.getByPlaceholderText("Ask me anything...")
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("calls onSearch with input text on submit", () => {
    renderWithProviders();
    const input = screen.getByPlaceholderText("Ask me anything...");
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.click(screen.getAllByRole("button")[0]); // or the correct index for your submit button
    expect(mockOnSearch).toHaveBeenCalledWith("hello world");
  });

  it("disables input and button when loading", () => {
    renderWithProviders({ loading: true });
    // The input should be disabled
    expect(
      screen.getByPlaceholderText("Processing your query...")
    ).toBeDisabled();
    // The stop button should NOT be disabled (it should be clickable)
    expect(screen.getAllByRole("button")[0]).not.toBeDisabled();
  });

  it("shows error message when streamError is present", () => {
    renderWithProviders({ streamError: "Something went wrong" });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows error for unsupported file format", async () => {
    renderWithProviders();
    const file = new File(["dummy"], "test.txt", { type: "text/plain" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(
        screen.getByText(/Failed to upload the file/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error for file size exceeding limit", async () => {
    renderWithProviders();
    const file = new File(["a".repeat(11 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/File size exceeds/i)).toBeInTheDocument();
    });
  });

  it("calls onFileUploaded on successful upload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ file_id: "abc", filename: "file.pdf" }),
    } as Response);

    renderWithProviders();
    const file = new File(["dummy"], "file.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnFileUploaded).toHaveBeenCalledWith("abc", "file.pdf");
    });
  });

  it("shows error on failed upload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Upload failed" }),
    } as Response);

    renderWithProviders();
    const file = new File(["dummy"], "file.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          (content) =>
            content.includes("Upload failed") ||
            content.includes("Failed to upload the file")
        )
      ).toBeInTheDocument();
    });
  });

  it("calls onStreamStopButtonClick when stop button is clicked", () => {
    renderWithProviders({ loading: true });
    const stopButton = screen.getAllByRole("button")[0]; // or the correct index
    fireEvent.click(stopButton);
    expect(mockOnStreamStopButtonClick).toHaveBeenCalled();
  });
});
