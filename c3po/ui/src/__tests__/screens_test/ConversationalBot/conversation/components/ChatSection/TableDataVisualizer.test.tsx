// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TableDataVisualizer from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/TableDataVisualizer";
import { ThemeProvider } from "@mui/material";
import { getTheme } from "../../../../../../ThemeV2";

// Mock GlobalStyles to prevent JSDOM errors
vi.mock("@mui/material/GlobalStyles", () => ({
  default: () => null,
}));

const mockData = [
  { id: "1", name: "John Doe", age: "30" },
  { id: "2", name: "Jane Smith", age: "25" },
  { id: "3", name: "Peter Jones", age: "40" },
  { id: "4", name: "Mary Williams", age: "35" },
  { id: "5", name: "David Brown", age: "50" },
  { id: "6", name: "Susan Davis", age: "45" },
];

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={getTheme("light")}>{ui}</ThemeProvider>);
};

describe("TableDataVisualizer", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock for exportToCSV
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        const a = realCreateElement("a");
        a.setAttribute = vi.fn();
        a.click = vi.fn();
        return a;
      }
      return realCreateElement(tagName);
    });
    global.URL.createObjectURL = vi.fn();
  });

  it("should render the table with correct headers and initial data", () => {
    renderWithProviders(<TableDataVisualizer rawData={mockData} />);
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Susan Davis")).not.toBeInTheDocument(); // Not on the first page
  });

  it("should handle pagination correctly", () => {
    renderWithProviders(<TableDataVisualizer rawData={mockData} />);
    expect(screen.getByText("1–5 of 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText("6–6 of 6")).toBeInTheDocument();
    expect(screen.getByText("Susan Davis")).toBeInTheDocument();
  });

  it("should change rows per page", () => {
    renderWithProviders(<TableDataVisualizer rawData={mockData} />);
    fireEvent.mouseDown(screen.getByLabelText("Rows per page:"));
    fireEvent.click(screen.getByRole("option", { name: "10" }));
    expect(screen.getByText("1–6 of 6")).toBeInTheDocument();
    expect(screen.getByText("Susan Davis")).toBeInTheDocument();
  });

  it("should copy data to clipboard when copy icon is clicked", async () => {
    const { container } = renderWithProviders(<TableDataVisualizer rawData={mockData} />);
    const svgs = container.querySelectorAll("svg");
    const copyIcon = svgs[svgs.length - 1]; // Copy icon is the last svg
    fireEvent.click(copyIcon);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(mockData)
      );
    });
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("should export data to CSV when download icon is clicked", () => {
    const { container } = renderWithProviders(<TableDataVisualizer rawData={mockData} />);
    const svgs = container.querySelectorAll("svg");
    const downloadIcon = svgs[svgs.length - 2]; // Download icon is the second to last svg
    fireEvent.click(downloadIcon);
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it("should handle stringified JSON data", () => {
    const stringData = JSON.stringify(mockData);
    renderWithProviders(<TableDataVisualizer rawData={stringData as any} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });
});
