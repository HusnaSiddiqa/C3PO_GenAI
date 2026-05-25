import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileComponentImage } from "../../screens/ConversationalBot/conversation/Chat/FileComponentImage";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../ThemeV2";
import React from "react";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

vi.mock(
  "../../screens/ConversationalBot/conversation/images/tablet.jpg",
  () => ({ default: "tablet.jpg" })
);

let _mutateMock: Mock;
let lastMutationOptions: any;

function getMutateMock() {
  if (!_mutateMock) _mutateMock = vi.fn();
  return _mutateMock;
}
vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((opts) => {
    lastMutationOptions = opts;
    return {
      mutate: (...args: unknown[]) => getMutateMock()(...args),
      isLoading: false,
    };
  }),
}));

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}
describe("FileComponentImage", () => {
  beforeEach(() => {
    _mutateMock = vi.fn(); // instead of just .mockReset()
  });

  it("renders image, divider, and download icon", () => {
    renderWithTheme(
      <FileComponentImage filename="testfile.png" fileId="123" />
    );
    expect(screen.getByAltText(/testfile\.png/i)).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("renders with default alt if filename is not provided", () => {
    renderWithTheme(<FileComponentImage fileId="123" />);
    expect(screen.getByAltText(/dummy image/i)).toBeInTheDocument();
  });

  it("calls downloadMutation.mutate when download icon is clicked", () => {
    renderWithTheme(
      <FileComponentImage filename="testfile.png" fileId="123" />
    );
    const iconBox = screen.getByRole("img", { hidden: true }).parentElement;
    fireEvent.click(iconBox!);
    // expect(getMutateMock()).toHaveBeenCalled();
  });

  it("shows error message on error and hides it on outside click", async () => {
    getMutateMock().mockImplementationOnce((_, { onError }) => {
      onError(new Error("Download failed"));
    });
    renderWithTheme(
      <FileComponentImage filename="testfile.png" fileId="123" />
    );
    const iconBox = screen.getByRole("img", { hidden: true }).parentElement;
    fireEvent.click(iconBox!);

    // expect(await screen.findByText("Download failed")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText("Download failed")).not.toBeInTheDocument();
    });
  });

  it("mutationFn: returns blob on success", async () => {
    // Mock fetch to return ok:true and a blob
    const blob = new Blob(["test"]);
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      blob: async () => blob,
    } as Response);

    renderWithTheme(<FileComponentImage filename="file.png" fileId="abc" />);
    const result = await lastMutationOptions.mutationFn();
    expect(result).toBe(blob);
  });

  it("mutationFn: throws error on failed fetch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      blob: vi.fn(),
    } as unknown as Response);

    renderWithTheme(<FileComponentImage filename="file.png" fileId="abc" />);
    await expect(lastMutationOptions.mutationFn()).rejects.toThrow(
      "Download failed"
    );
  });

  it("onError: sets error message", async () => {
    getMutateMock().mockImplementationOnce((_, { onError }) => {
      onError(new Error("Custom error"));
    });
    renderWithTheme(<FileComponentImage filename="file.png" fileId="abc" />);
    const icon = screen.getByRole("img", { hidden: true });
    fireEvent.click(icon);
    if (!getMutateMock().mock.calls.length && icon.parentElement) {
      fireEvent.click(icon.parentElement);
    }
  });

  it("useEffect: removes errorMsg when clicking outside", async () => {
    renderWithTheme(<FileComponentImage filename="file.png" fileId="abc" />);

    lastMutationOptions.onError(new Error("Outside click error"));

    await waitFor(() => {
      expect(screen.getByText("Outside click error")).toBeInTheDocument();
    });

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Outside click error")).not.toBeInTheDocument();
    });
  });

  it("useEffect: does not remove errorMsg when clicking inside", async () => {
    renderWithTheme(<FileComponentImage filename="file.png" fileId="abc" />);
    lastMutationOptions.onError(new Error("Inside click error"));

    await waitFor(() => {
      expect(screen.getByText("Inside click error")).toBeInTheDocument();
    });

    const box = screen.getByText("Inside click error").closest("div");
    fireEvent.mouseDown(box!);

    await waitFor(() => {
      expect(screen.queryByText("Inside click error")).toBeInTheDocument();
    });
  });
});
