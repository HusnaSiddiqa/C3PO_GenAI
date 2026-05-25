import React, { useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie, Scatter } from "react-chartjs-2";
import {
  Paper,
  useTheme,
  MenuItem,
  Select,
  SelectChangeEvent,
  GlobalStyles,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { CloudArrowDownIcon } from "@phosphor-icons/react";
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type ChartType =
  | "bar"
  | "line"
  | "scatter"
  | "pie"
  | "histogram";

interface ChartDataInput {
  type: ChartType;
  data: {
    x_label: string;
    y_label: string;
    x: (string | number)[];
    y: number[];
    label: string;
    priority?: number;
    legend?: string[];
  };
}

interface Props {
  charts: ChartDataInput[];
}

const DynamicChart: React.FC<Props> = ({ charts }) => {
  const theme = useTheme();

  const seriesColors = Array.from(
    new Set([
      theme.palette.contrast.main.main100,
      theme.palette.contrast.status.green100,
      theme.palette.contrast.status.orange,
      theme.palette.contrast.status.yellow,
      theme.palette.contrast.status.red,
      theme.palette.contrast.status.blue,
      theme.palette.contrast.status.blue10,
      theme.palette.contrast.status.green10,
      theme.palette.contrast.status.greenOff20,
      theme.palette.contrast.status.redLight,
      theme.palette.contrast.status.purple,
      theme.palette.contrast.status.pink,
      theme.palette.contrast.status.redOff10,
      theme.palette.contrast.status.redOff100,
    ])
  );
  const getSeriesColor = (i: number) => seriesColors[i % seriesColors.length];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  const [activeChartIndex, setActiveChartIndex] = useState(0);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [isStacked, setIsStacked] = useState(false);

  const activeChart = charts[activeChartIndex];
  if (!activeChart || !activeChart.data) {
    return null;
  }
  const { x, y, x_label, y_label, label, legend } = activeChart.data;
  const chartType = activeChart.type;

  const handleChartChange = (e: SelectChangeEvent) => {
    setActiveChartIndex(Number(e.target.value));
    // Reset chart orientation when switching charts
    setIsHorizontal(false);
    // Reset stacking when switching charts
    setIsStacked(false);
  };

  // Check if this is a bar chart type that supports orientation change
  const isBarChart = chartType === "bar";
  
  // Check if there are multiple Y values (grouped data)
  const isMultiY = Array.isArray(y[0]);

  const legendLabels: string[] = Array.isArray(legend)
    ? legend
    : legend
    ? [legend]
    : [];


  const chartData = (() => {
  const isMultiY = Array.isArray(y[0]);
  const isMultiX = Array.isArray(x[0]);

  const getLegend = (seriesIdx: number) => {
    if (legendLabels.length > seriesIdx) return legendLabels[seriesIdx];
    if (legendLabels.length === 1) return legendLabels[0];
  };

  switch (chartType) {
    case "line":
    case "bar": {
      if (isMultiX || isMultiY) {
        const seriesCount = isMultiY
          ? (y[0] as unknown as number[]).length
          : isMultiX
          ? (x[0] as unknown as (string | number)[]).length
          : 1;

        const labelsForChart = (x as (string | number)[]);

        const chartDataValues = (y as unknown[]).map((row, i) => {
          if (isMultiX && isMultiY) {
            return (y as unknown as unknown[][])[i];
          } else if (isMultiY) {
            return row as number[];
          }
          return (y as number[])[i];
        });

        return {
          labels: labelsForChart,
          datasets: Array.from({ length: seriesCount }).map((_, seriesIdx) => ({
            label: getLegend(seriesIdx),
            backgroundColor: getSeriesColor(seriesIdx),
            borderColor: getSeriesColor(seriesIdx),
            tension: 0.4,
            fill: false,
            data: chartDataValues.map((val) => (Array.isArray(val) ? val[seriesIdx] : val)),
            borderWidth: 1,
          })),
        };
      } else {
        return {
          labels: (x as (string | number)[]),
          datasets: [
            {
              label: getLegend(0),
              data: (y as number[]),
              backgroundColor: theme.palette.contrast.main.main100,
              borderColor: theme.palette.contrast.main.main100,
              tension: 0.4,
              fill: false,
            },
          ],
        };
      }
    }

    case "scatter": {
      const isMultiSeries = isMultiX || isMultiY;
      if (isMultiSeries) {
        const seriesCount = isMultiY
          ? (y[0] as unknown as number[]).length
          : (x[0] as unknown as number[]).length;

        return {
          datasets: Array.from({ length: seriesCount }).map((_, seriesIdx) => ({
            label: getLegend(seriesIdx),
            data: (x as unknown[]).map((row, i) => {
              if (isMultiX && isMultiY) {
                return { x: (x as unknown as number[][])[i][seriesIdx], y: (y as unknown as number[][])[i][seriesIdx] };
              } else if (isMultiY) {
                return { x: (x as number[])[i], y: (y as unknown as number[][])[i][seriesIdx] };
              } else {
                return { x: (x as unknown as number[][])[i][seriesIdx], y: (y as number[])[i] };
              }
            }),
            backgroundColor: getSeriesColor(seriesIdx),
          })),
        };
      } else {
        return {
          datasets: [
            {
              label: getLegend(0),
              data: (x as number[]).map((xVal, i) => ({ x: xVal, y: (y as number[])[i] })),
              backgroundColor: theme.palette.contrast.main.main100,
            },
          ],
        };
      }
    }

    case "pie": {
      if (isMultiY) {
        const seriesCount = (y[0] as unknown as number[]).length;
        return {
          labels: x as (string | number)[],
          datasets: Array.from({ length: seriesCount }).map((_, seriesIdx) => ({
            label: getLegend(seriesIdx),
            data: (y as unknown as number[][]).map((row) => row[seriesIdx]),
            backgroundColor: (x as (string | number)[]).map(
              (_, i) => getSeriesColor(i)
            ),
          })),
        };
      } else {
        return {
          labels: x as (string | number)[],
          datasets: [
            {
              label:getLegend(0),
              data: y as number[],
              backgroundColor: (x as (string | number)[]).map(
                (_, i) => getSeriesColor(i)
              ),
            },
          ],
        };
      }
    }

    case "histogram": {
      if (isMultiY) {
        const seriesCount = (y[0] as unknown as number[]).length;
        return {
          labels: x as (string | number)[],
          datasets: Array.from({ length: seriesCount }).map((_, seriesIdx) => ({
            label: getLegend(seriesIdx),
            data: (y as unknown as number[][]).map((row) => row[seriesIdx]),
            backgroundColor: getSeriesColor(seriesIdx),
            barPercentage: 1.0,
            categoryPercentage: 1.0,
          })),
        };
      } else {
        return {
          labels: x as (string | number)[],
          datasets: [
            {
              label: getLegend(0),
              data: y as number[],
              backgroundColor: theme.palette.contrast.main.main100,
              barPercentage: 0.95,
              categoryPercentage: 1.0,
            },
          ],
        };
      }
    }

    default:
      return { labels: [], datasets: [] };
  }
})();


  const trimLabel = (label: string | number | undefined, maxLength: number = 30): string => {
    if (label === undefined || label === null) return "";
    const str = String(label);
    return str.length > maxLength ? str.substring(0, maxLength) + "..." : str;
  };

  const chartOptions: Record<string, unknown> = {
  responsive: true,
  indexAxis: isBarChart ? (isHorizontal ? ("y" as const) : ("x" as const)) : ("x" as const),
  interaction: {
    mode: 'index',
    intersect: isHorizontal ? true : false
  },
  plugins: {
    legend: { position: "top" as const,
      labels: {
        color: theme.palette.text.primary,
      },
     },
    title: {
      display: true,
      text: label,
      color: theme.palette.text.primary,
    },
    tooltip: {
      maxWidth: 300,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      padding: 12,
      displayColors: true,
      callbacks: {
        title: (context: { dataIndex?: number; label?: string }[]): string | string[] => {
          const titleText = String(context[0]?.label || "");
          // Break long text into multiple lines (approximately every 40 characters)
          const lines: string[] = [];
          let currentLine = "";
          const words = titleText.split(" ");
          for (const word of words) {
            // If a single word exceeds the limit, put it on its own line
            if (word.length > 40) {
              if (currentLine) {
                lines.push(currentLine.trim());
                currentLine = "";
              }
              lines.push(word);
              continue;
            }
            const tentativeLine = (currentLine ? currentLine + " " : "") + word;
            if (tentativeLine.length > 40) {
              if (currentLine) {
                lines.push(currentLine.trim());
              }
              currentLine = word;
            } else {
              currentLine = tentativeLine;
            }
          }
          if (currentLine) lines.push(currentLine.trim());
          return lines;
        },
        label: (context: any): string => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const datasetLabel = context.dataset.label || "";
          // For horizontal bar, use parsed.x (value axis); for vertical, use parsed.y (value axis)
          const value = isHorizontal ? context.parsed.x : context.parsed.y;
          return `${datasetLabel}: ${value}`;
        },
      },
    },
  },
  scales: ["pie"].includes(chartType)
    ? {}
    : {
        x: {
          stacked: isStacked,
          title: {
            display: true,
            text: isHorizontal ? y_label : x_label,
            color: theme.palette.text.primary,
          },
          ticks: {
            color: theme.palette.text.secondary,
            callback: function(value: string | number): string {
              // For horizontal bar, show numeric values; for vertical, show category labels
              if (!isHorizontal) {
                const label = chartData.labels?.[value as number];
                return trimLabel(label);
              }
              return trimLabel(value);
            },
          },
        },
        y: {
          stacked: isStacked,
          title: {
            display: true,
            text: isHorizontal ? x_label : y_label,
            color: theme.palette.text.primary,
          },
          ticks: {
            color: theme.palette.text.secondary,
            callback: function(value: string | number): string {
              // For horizontal bar, show category labels; for vertical, show numeric values
              if (isHorizontal) {
                const label = chartData.labels?.[value as number];
                return trimLabel(label);
              }
              return trimLabel(value);
            },
          },
        },
      },
};

  const exportToPng = () => {
    const chart = chartRef.current;
    if (chart && chart.toBase64Image()) {
      // Create a temporary canvas to add background color based on theme
      const originalCanvas = chart.canvas;
      const tempCanvas = document.createElement("canvas");
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return;

      tempCanvas.width = originalCanvas.width;
      tempCanvas.height = originalCanvas.height;

      // Set background color based on theme mode
      ctx.fillStyle =  theme.palette.background.default;
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original chart on top
      ctx.drawImage(originalCanvas, 0, 0);

      // Convert to data URL and trigger download
      const url = tempCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${label.replace(/\s+/g, "_")}.png`;
      link.click();
    }
  };

  const ChartComponent = (() => {
    switch (chartType) {
      case "bar":
        return Bar;
      case "line":
        return Line;
      case "scatter":
        return Scatter;
      case "pie":
        return Pie;
      case "histogram":
        return Bar;
      default:
        return Bar;
    }
  })();

  return (
    <Paper sx={{ p: 2, mt: 4 }}>


      <GlobalStyles
        styles={{
          ".MuiBackdrop-root, .MuiBackdrop-invisible, .MuiModal-backdrop": {
            opacity: "0 !important",
            backgroundColor: "transparent !important",
            pointerEvents: "auto !important",
          },
        }}
      />

      <div style={{ width: "100%", minWidth: 250, maxHeight: 400 }}>
        <ChartComponent
          ref={chartRef}
          data={chartData}
          options={chartOptions}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: theme.spacing(2),
        }}
      >
        <Select
          value={String(activeChartIndex)}
          onChange={handleChartChange}
          size="small"
          sx={{ minWidth: 250 }}
        >
          {charts.map((c, i) => (
            <MenuItem key={i} value={i}>
              {c.type === "bar" ? "Bar" : c.type.replace("_", " ")}{c.data ? ` - ${c.data.label}` : ""}
            </MenuItem>
          ))}
        </Select>

        {isBarChart && (
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing(2) }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isHorizontal}
                  onChange={(e) => setIsHorizontal(e.target.checked)}
                  size="small"
                />
              }
              label="Horizontal"
            />
            
            {isMultiY && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isStacked}
                    onChange={(e) => setIsStacked(e.target.checked)}
                    size="small"
                  />
                }
                label="Stacked"
              />
            )}
          </div>
        )}

        <CloudArrowDownIcon
          color={theme.palette.text.secondary}
          size={theme.spacing(7)}
          onClick={exportToPng}
          style={{
            cursor: "pointer",
            marginTop: theme.spacing(2),
            marginBottom: theme.spacing(2),
            marginLeft: theme.spacing(10),
          }}
        />
      </div>
    </Paper>
  );
};

export default DynamicChart;
