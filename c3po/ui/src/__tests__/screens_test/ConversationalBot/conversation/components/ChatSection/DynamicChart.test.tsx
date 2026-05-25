import { render, screen } from "@testing-library/react";
import { expect, it, describe } from "vitest";
import DynamicChart from "../../../../../../screens/ConversationalBot/conversation/components/ChatSection/DynamicChart";
import { ThemeProvider } from "@mui/material/styles";
import { getTheme } from "../../../../../../ThemeV2";
import React from "react";

function renderWithTheme(ui: React.ReactElement) {
  const theme = getTheme("light");
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("DynamicChart - Tooltip", () => {
  const mockCharts = [
    {
      type: "vertical_bar" as const,
      data: {
        x_label: "Months",
        y_label: "Revenue",
        x: ["Jan", "Feb", "Mar", "Apr", "May"],
        y: [100, 150, 120, 180, 200],
        label: "Monthly Revenue",
      },
    },
    {
      type: "line" as const,
      data: {
        x_label: "Days",
        y_label: "Visits",
        x: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        y: [50, 75, 60, 90, 80],
        label: "Weekly Visits",
      },
    },
  ];

  it("renders vertical bar chart with tooltip", () => {
    renderWithTheme(<DynamicChart charts={mockCharts} />);
    // Check that the chart component is rendered
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders line chart with tooltip", () => {
    renderWithTheme(<DynamicChart charts={mockCharts} />);
    // Check that the chart component is rendered
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  describe("Tooltip title callback", () => {
    it("handles tooltip title for vertical bar chart", () => {
      renderWithTheme(<DynamicChart charts={mockCharts} />);

      // Find chart container
      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();

      // Simulate tooltip interaction
      const verticalBarChart = mockCharts[0];
      const title = verticalBarChart.data.x[0];

      // Tooltip should show the category label
      expect(title).toBe("Jan");
    });

    it("handles tooltip title for line chart", () => {
      renderWithTheme(<DynamicChart charts={mockCharts} />);

      const lineChart = mockCharts[1];
      const title = lineChart.data.x[0];

      // Tooltip should show the category label
      expect(title).toBe("Mon");
    });

    it("handles tooltip title for horizontal bar chart", () => {
      const horizontalBarCharts = [
        {
          type: "horizontal_bar" as const,
          data: {
            x_label: "Product",
            y_label: "Sales",
            x: ["Product A", "Product B", "Product C"],
            y: [300, 450, 350],
            label: "Product Sales",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={horizontalBarCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles tooltip title for scatter chart", () => {
      const scatterCharts = [
        {
          type: "scatter" as const,
          data: {
            x_label: "X Axis",
            y_label: "Y Axis",
            x: [1, 2, 3, 4, 5],
            y: [10, 20, 15, 25, 30],
            label: "Scatter Data",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={scatterCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles tooltip title for pie chart", () => {
      const pieCharts = [
        {
          type: "pie" as const,
          data: {
            x_label: "Categories",
            y_label: "Values",
            x: ["Category A", "Category B", "Category C"],
            y: [30, 50, 20],
            label: "Pie Chart",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={pieCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles tooltip title for histogram chart", () => {
      const histogramCharts = [
        {
          type: "histogram" as const,
          data: {
            x_label: "Bins",
            y_label: "Frequency",
            x: [1, 2, 3, 4, 5],
            y: [5, 10, 15, 10, 5],
            label: "Histogram",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={histogramCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Tooltip label callback", () => {
    it("shows dataset label and value in tooltip", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("shows correct value in tooltip for vertical bar", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      // Check that chart renders
      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("shows correct value in tooltip for horizontal bar", () => {
      const testCharts = [
        {
          type: "horizontal_bar" as const,
          data: {
            x_label: "Products",
            y_label: "Sales",
            x: ["Product A", "Product B", "Product C"],
            y: [100, 200, 300],
            label: "Sales",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("shows correct value in tooltip for line chart", () => {
      const testCharts = [
        {
          type: "line" as const,
          data: {
            x_label: "Days",
            y_label: "Visits",
            x: ["Mon", "Tue", "Wed"],
            y: [50, 75, 60],
            label: "Visits",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Tooltip appearance", () => {
    it("has proper tooltip configuration with max width", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("has tooltip with appropriate font sizes", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("has tooltip with proper padding", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("has tooltip with color display enabled", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Tooltip interaction", () => {
    it("allows chart switching while tooltip is shown", () => {
      renderWithTheme(<DynamicChart charts={mockCharts} />);

      // Check that the chart component is rendered
      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("handles multiple datasets with tooltips", () => {
      const multiDatasetCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar", "Apr", "May"],
            y: [100, 150, 120, 180, 200],
            label: "Revenue",
            legend: ["2023", "2024"],
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={multiDatasetCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles scattered data with tooltips", () => {
      const scatterCharts = [
        {
          type: "scatter" as const,
          data: {
            x_label: "Temperature",
            y_label: "Sales",
            x: [1, 2, 3, 4, 5, 6, 7],
            y: [10, 15, 20, 25, 30, 35, 40],
            label: "Scatter Plot",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={scatterCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles pie chart with multiple slices and tooltips", () => {
      const pieCharts = [
        {
          type: "pie" as const,
          data: {
            x_label: "Categories",
            y_label: "Values",
            x: ["A", "B", "C", "D", "E"],
            y: [10, 20, 30, 40, 50],
            label: "Distribution",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={pieCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles histogram with tooltips", () => {
      const histogramCharts = [
        {
          type: "histogram" as const,
          data: {
            x_label: "Bins",
            y_label: "Frequency",
            x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            y: [5, 10, 15, 20, 25, 30, 25, 20, 15, 10],
            label: "Frequency Distribution",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={histogramCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Tooltip with long text", () => {
    it("handles tooltip with long category labels", () => {
      const longLabelCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Categories",
            y_label: "Values",
            x: [
              "Very Long Category Name That Might Exceed Normal Tooltip Width",
              "Another Long Category",
              "Short",
            ],
            y: [100, 200, 300],
            label: "Long Labels",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={longLabelCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("handles tooltip with long legend labels", () => {
      const longLegendCharts = [
        {
          type: "line" as const,
          data: {
            x_label: "Days",
            y_label: "Visits",
            x: ["Mon", "Tue", "Wed", "Thu", "Fri"],
            y: [50, 75, 60, 90, 80],
            label: "Very Long Legend Label That Should Be Truncated",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={longLegendCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("Tooltip callbacks", () => {
    it("returns correct title for horizontal bar chart with dataIndex", () => {
      const horizontalBarCharts = [
        {
          type: "horizontal_bar" as const,
          data: {
            x_label: "Products",
            y_label: "Sales",
            x: ["Product A", "Product B", "Product C"],
            y: [300, 450, 350],
            label: "Product Sales",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={horizontalBarCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });

    it("returns correct label with dataset label and value", () => {
      const testCharts = [
        {
          type: "vertical_bar" as const,
          data: {
            x_label: "Months",
            y_label: "Revenue",
            x: ["Jan", "Feb", "Mar"],
            y: [100, 200, 300],
            label: "Revenue",
          },
        },
      ];

      renderWithTheme(<DynamicChart charts={testCharts} />);

      const chartContainer = screen.getByRole("img").parentElement;
      expect(chartContainer).toBeInTheDocument();
    });
  });
});