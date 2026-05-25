import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { Mock } from "vitest";
import { getTheme } from "../../ThemeV2";
import * as UnsavedTabChangesContext from "../../screens/Setting/context/UnsavedTabChangesContext";
import {
  callSynMetadata,
  exportSchemaConfig,
  getSchemaConfig,
  getTableMetadata,
  updateTableMetadata,
} from "../../screens/Setting/helpers/helpers";
import { SchemaConfigTab } from "../../screens/Setting/components/SettingTabs/SchemaConfigTab";

function renderWithProviders(
  ui: React.ReactElement,
  themeMode: "light" | "dark" = "light"
) {
  const theme = getTheme(themeMode);
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
    getSchemaConfig: vi.fn(),
    callSynMetadata: vi.fn(),
    getTableMetadata: vi.fn(),
    updateTableMetadata: vi.fn(),
    exportSchemaConfig: vi.fn(),
  };
});

vi.mock("../../screens/Setting/context/UnsavedTabChangesContext");
const mockSetHasUnsavedChanges = vi.fn();
(UnsavedTabChangesContext.useUnsavedChanges as Mock).mockReturnValue({
  setHasUnsavedChanges: mockSetHasUnsavedChanges,
});

const mockDatasources = [
  {
    datasource: "databricks",
    databases: [
      {
        catalog: "hive_metastore",
        name: "sales_db",
        tables: [{ name: "orders" }],
      },
    ],
  },
];

const mockTableMetadata = [
  {
    pk: "databricks#sales_db#orders#id",
    sk: "COLUMN",
    itemType: "column",
    datasource: "databricks",
    catalog: "hive_metastore",
    dbName: "sales_db",
    tableName: "orders",
    columnName: "id",
    columnType: "int",
    status: "active",
    metadataDescription: "Order ID",
    metadataType: "primary_key",
    syncTimestamp: "2025-08-01T12:00:00Z",
    updatedAt: "2025-08-01T12:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SchemaConfigTab", () => {
  it("renders loading state initially", async () => {
    (getSchemaConfig as Mock).mockReturnValueOnce(new Promise(() => {}));
    renderWithProviders(<SchemaConfigTab />);
    expect(screen.getByText("Loading data...")).toBeInTheDocument();
  });

  // it("renders error state when schema config fails", async () => {
  //   (getSchemaConfig as Mock).mockRejectedValueOnce(new Error("Fetch failed"));
  //   renderWithProviders(<SchemaConfigTab />);
  //   await waitFor(() => {
  //     expect(screen.getByText("Failed to load schema config data.")).toBeInTheDocument();
  //   });
  // });

  it("renders dropdown, refresh button and accordion on success", async () => {
    (getSchemaConfig as Mock).mockResolvedValueOnce(mockDatasources);
    renderWithProviders(<SchemaConfigTab />);
    await waitFor(() => {
      expect(screen.getByText("Data source*")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /refresh/i })
      ).toBeInTheDocument();
    });
  });

  it("triggers refresh API and refetches data", async () => {
    (getSchemaConfig as Mock).mockResolvedValue(mockDatasources);
    (callSynMetadata as Mock).mockResolvedValue({
      details: { timestamp: "2025-08-01T12:00:00Z" },
    });
    renderWithProviders(<SchemaConfigTab />);
    await waitFor(() => screen.getByRole("button", { name: /refresh/i }));
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => {
      expect(callSynMetadata).toHaveBeenCalled();
    });
  });

  it("renders table metadata section after selecting table", async () => {
    (getSchemaConfig as Mock).mockResolvedValue(mockDatasources);
    (getTableMetadata as Mock).mockResolvedValue(mockTableMetadata);
    renderWithProviders(<SchemaConfigTab />);

    const tableButton = await screen.findByText("orders");
    fireEvent.click(tableButton);

    await waitFor(() => {
      expect(screen.getByText("Edit Metadata")).toBeInTheDocument();
    });
  });

  it("disables Save button initially and enables on change", async () => {
    (getSchemaConfig as Mock).mockResolvedValue(mockDatasources);
    (getTableMetadata as Mock).mockResolvedValue(mockTableMetadata);
    renderWithProviders(<SchemaConfigTab />);

    const tableButton = await screen.findByText("orders");
    fireEvent.click(tableButton);
    await waitFor(() => screen.getByText("Edit Metadata"));

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled();

    const input = screen.getByDisplayValue("Order ID");
    fireEvent.change(input, { target: { value: "Updated Order ID" } });

    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it("calls updateTableMetadata when Save is clicked", async () => {
    (getSchemaConfig as Mock).mockResolvedValue(mockDatasources);
    (getTableMetadata as Mock).mockResolvedValue(mockTableMetadata);
    (updateTableMetadata as Mock).mockResolvedValue({
      details: {
        updatedFields: {
          metadataDescription: "Updated Order ID",
          updatedAt: "2025-08-01T12:05:00Z",
        },
      },
    });

    renderWithProviders(<SchemaConfigTab />);

    const tableButton = await screen.findByText("orders");
    fireEvent.click(tableButton);
    await waitFor(() => screen.getByText("Edit Metadata"));

    const input = screen.getByDisplayValue("Order ID");
    fireEvent.change(input, { target: { value: "Updated Order ID" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateTableMetadata).toHaveBeenCalled();
    });
  });

  it("calls exportSchemaConfig when cloud icon clicked", async () => {
    (getSchemaConfig as Mock).mockResolvedValue(mockDatasources);
    (getTableMetadata as Mock).mockResolvedValue(mockTableMetadata);
    (exportSchemaConfig as Mock).mockResolvedValue({ status: "success" });

    renderWithProviders(<SchemaConfigTab />);
    const tableButton = await screen.findByText("orders");
    fireEvent.click(tableButton);

    await waitFor(() => screen.getByText("Edit Metadata"));
    const cloudButton = screen.getByTestId("cloud-icon");
    fireEvent.click(cloudButton);

    await waitFor(() => {
      expect(exportSchemaConfig).toHaveBeenCalled();
    });
  });
});
