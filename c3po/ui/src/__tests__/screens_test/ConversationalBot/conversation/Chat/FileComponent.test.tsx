import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, Mock } from "vitest";
import { FileComponent } from "../../../../../screens/ConversationalBot/conversation/Chat/FileComponent";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../../../../ThemeV2";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const theme = getTheme("light");
const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
};

global.fetch = vi.fn();

describe("FileComponent", () => {
  const defaultProps = {
    filename: "test.pdf",
    fileId: "12345",
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the filename and icon", () => {
    renderWithProviders(<FileComponent {...defaultProps} />);
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the correct icon for PDF", () => {
    renderWithProviders(<FileComponent {...defaultProps} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the correct icon for CSV", () => {
    renderWithProviders(<FileComponent filename="data.csv" fileId="id" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the correct icon for PPTX", () => {
    renderWithProviders(<FileComponent filename="slides.pptx" fileId="id" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the correct icon for image", () => {
    renderWithProviders(<FileComponent filename="img.png" fileId="id" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders the default icon for unknown extension", () => {
    renderWithProviders(<FileComponent filename="file.unknown" fileId="id" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles missing filename gracefully", () => {
    renderWithProviders(<FileComponent fileId="id" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("handles missing fileId gracefully", () => {
    renderWithProviders(<FileComponent filename="nofile.pdf" />);
    expect(screen.getByText("nofile.pdf")).toBeInTheDocument();
    const downloadButton = screen.getByRole("button");
    fireEvent.click(downloadButton);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls download and triggers anchor click on success", async () => {
    const mockBlob = new Blob(["test"], { type: "application/pdf" });
    (fetch as Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    // Ensure createObjectURL exists
    if (!("createObjectURL" in URL)) {
      // @ts-ignore
      URL.createObjectURL = vi.fn(() => "blob:url");
    }
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:url");
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement;
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "a") {
          const a = originalCreateElement.call(document, "a");
          a.click = clickSpy;
          a.setAttribute = vi.fn();
          return a;
        }
        return originalCreateElement.call(document, tagName);
      }
    );

    renderWithProviders(<FileComponent {...defaultProps} />);
    const downloadButton = screen.getByRole("button");
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
    });

    createObjectURLSpy.mockRestore();
    (document.createElement as any).mockRestore?.();
  });

  it("shows error message on download failure", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
    });
    renderWithProviders(<FileComponent {...defaultProps} />);
    const downloadButton = screen.getByRole("button");
    fireEvent.click(downloadButton);
    expect(await screen.findByText("Download failed")).toBeInTheDocument();
  });

  it("dismisses error message when clicking outside", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
    });
    renderWithProviders(<FileComponent {...defaultProps} />);
    const downloadButton = screen.getByRole("button");
    fireEvent.click(downloadButton);
    expect(await screen.findByText("Download failed")).toBeInTheDocument();

    // Simulate clicking outside
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText("Download failed")).not.toBeInTheDocument();
    });
  });
});
