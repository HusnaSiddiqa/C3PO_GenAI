import {
  Box,
  Button,
  CircularProgress,
  Typography,
  useTheme,
} from "@mui/material";
import { DropDown } from "../DropDown";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import AccordionMenu, { type AccordionItem } from "../AccordionTile";
import EditableTable, { type ColumnConfig } from "../CustomEditableTable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  callSynMetadata,
  exportSchemaConfig,
  getSchemaConfig,
  getTableMetadata,
  updateTableMetadata,
} from "../../helpers/helpers";
import { format } from "date-fns";
import type {
  SchemaDatasource,
  TableMetadata,
  TableMetadataRow,
} from "../../helpers/types";
import { useUnsavedChanges } from "../../context/UnsavedTabChangesContext";
import { SuccessTile } from "../SuccessTile";

interface SelectedTabInfo {
  datasource: string;
  dbName: string;
  tableName: string;
  catalog: string;
}

export const SchemaConfigTab = () => {
  const theme = useTheme();
  const [currentSelectedDataSource, setCurrentSelectedDataSource] = useState<
    string | number
  >("");
  const [resetAccordion, setResetAccordion] = useState(false);
  const [showSuccessTile, setShowSuccessTile] = useState(false);
  const [selectedTabInfo, setSelectedTabInfo] =
    useState<SelectedTabInfo | null>(null);

  const {
    data: schemaConfigData,
    isLoading,
    error,
  } = useQuery<SchemaDatasource[]>({
    queryKey: ["schemaConfigData"],
    queryFn: getSchemaConfig,
    retry: false,
    throwOnError: true,
  });

  const params = useMemo(
    () => ({
      dbName: selectedTabInfo?.dbName ?? "",
      tableName: selectedTabInfo?.tableName ?? "",
      datasource: selectedTabInfo?.datasource ?? "",
      catalog: selectedTabInfo?.catalog ?? "",
    }),
    [selectedTabInfo]
  );

  const {
    data: tableMetadata,
    isLoading: isTableMetadataLoading,
    error: tableMetadataError,
  } = useQuery<TableMetadata[]>({
    queryKey: ["table-metadata", { params }],
    queryFn: () => getTableMetadata(params),
    enabled: Boolean(params.dbName && params.tableName && params.datasource),
    retry: false,
    throwOnError: true,
  });

  useEffect(() => {
    //TODO: Remove this hardcoded value once the API for fetch DB_Source is ready
    if (schemaConfigData) {
      setCurrentSelectedDataSource("databricks");
    }
  }, [schemaConfigData]);

  useEffect(() => {
    if (showSuccessTile) {
      setTimeout(() => setShowSuccessTile(false), 1000); // removing the tile after 1 second
    }
  }, [showSuccessTile]);

  const selectedSourceData = useMemo(() => {
    return schemaConfigData?.filter(
      (item) => item.datasource === currentSelectedDataSource
    );
  }, [schemaConfigData, currentSelectedDataSource]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap={theme.spacing(3)}
      >
        <CircularProgress color={"inherit"} size={24} />
        <Typography>Loading data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Typography color="error" variant="body1">
          Failed to load schema config data.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <SuccessTile visible={showSuccessTile} />
      <SchemaConfigTabHeaderSection
        schemaConfigData={schemaConfigData}
        currentSelectedDataSource={currentSelectedDataSource}
        setCurrentSelectedDataSource={setCurrentSelectedDataSource}
        setSelectedTabInfo={setSelectedTabInfo}
        setResetAccordion={setResetAccordion}
      />
      <Box
        display={"flex"}
        gap={theme.spacing(4)}
        borderTop={`1px solid ${theme.palette.contrast.grayscale.level10}`}
      >
        <Box flex={1}>
          {schemaConfigData && (
            <AccordionMenu
              reset={resetAccordion}
              disabled={isTableMetadataLoading}
              data={
                transformSchemaConfigToAccordionItems(selectedSourceData) ?? []
              }
              onSubItemClick={(item) => {
                if (item?.metadata) {
                  const parsed = JSON.parse(JSON.stringify(item.metadata));
                  const datasource = parsed?.datasource ?? null;
                  const dbName = parsed?.dbName ?? null;
                  const tableName = parsed?.tableName ?? null;
                  const catalog = parsed?.catalog ?? null;

                  setSelectedTabInfo({
                    datasource,
                    dbName,
                    tableName,
                    catalog,
                  });
                }
              }}
            />
          )}
        </Box>
        <Box
          flex={3}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {" "}
          {tableMetadata && (
            <MetadataTableSection
              key={selectedTabInfo?.tableName ?? "default"}
              selectedTabInfo={selectedTabInfo}
              isTableMetadataLoading={isTableMetadataLoading}
              tableMetadataError={tableMetadataError}
              tableMetadata={tableMetadata}
              setShowSuccessTile={setShowSuccessTile}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

const MetadataTableSection = ({
  selectedTabInfo,
  isTableMetadataLoading,
  tableMetadataError,
  tableMetadata,
  setShowSuccessTile,
}: {
  selectedTabInfo: SelectedTabInfo | null;
  tableMetadata: TableMetadata[] | undefined;
  isTableMetadataLoading: boolean;
  tableMetadataError: Error | null;
  setShowSuccessTile: Dispatch<SetStateAction<boolean>>;
}) => {
  const theme = useTheme();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [modifiedRows, setModifiedRows] = useState<TableMetadataRow[]>([]);

  useEffect(() => {
    setHasUnsavedChanges(modifiedRows.length > 0);
  }, [modifiedRows, setHasUnsavedChanges]);

  if (isTableMetadataLoading && !tableMetadataError) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap={theme.spacing(3)}
      >
        <CircularProgress color={"inherit"} size={24} />
        <Typography>Fetching Table Metadata...</Typography>
      </Box>
    );
  }

  if (tableMetadataError) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Typography color="error" variant="body1">
          Unable to fetch the Table Metadata
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      paddingTop={theme.spacing(3)}
      display={"flex"}
      flexDirection={"column"}
      gap={theme.spacing(2)}
    >
      {tableMetadata && (
        <>
          <TableHeaderSection
            modifiedRows={modifiedRows}
            selectedTabInfo={selectedTabInfo}
            setShowSuccessTile={setShowSuccessTile}
            setModifiedRows={setModifiedRows}
          />
          <TableMetadataSection
            key={selectedTabInfo?.tableName ?? "default"}
            tableMetadata={tableMetadata}
            selectedTabInfo={selectedTabInfo}
            setModifiedRows={setModifiedRows}
          />
        </>
      )}
    </Box>
  );
};

function transformSchemaConfigToAccordionItems(
  schemaData: SchemaDatasource[] | undefined
):
  | AccordionItem<{
      dbName: string;
      tableName: string;
      datasource: string;
      catalog?: string;
    }>[]
  | undefined {
  if (!schemaData) return undefined;

  return schemaData.flatMap((source) =>
    source.databases.map((db) => ({
      title: db.name,
      items: db.tables.map((table) => ({
        id: `${source.datasource}.${db.name}.${table.name}`,
        label: table.name,
        metadata: {
          dbName: db.name,
          tableName: table.name,
          datasource: source.datasource,
          catalog: db.catalog,
        },
      })),
    }))
  );
}

const SchemaConfigTabHeaderSection = ({
  currentSelectedDataSource,
  schemaConfigData,
  setCurrentSelectedDataSource,
  setSelectedTabInfo,
  setResetAccordion,
}: {
  currentSelectedDataSource: string | number;
  schemaConfigData: SchemaDatasource[] | undefined;
  setCurrentSelectedDataSource: Dispatch<SetStateAction<string | number>>;
  setSelectedTabInfo: Dispatch<SetStateAction<SelectedTabInfo | null>>;
  setResetAccordion: Dispatch<SetStateAction<boolean>>;
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const {
    mutate: refreshMetadata,
    data: syncMetadata,
    isPending: isRefreshing,
  } = useMutation({
    mutationFn: callSynMetadata,
    onSuccess: async () => {
      setSelectedTabInfo(null);
      setResetAccordion(true);
      await queryClient.refetchQueries({ queryKey: ["schemaConfigData"] });
      requestAnimationFrame(() => {
        setResetAccordion(false);
      });
    },
  });

  const formattedDate = syncMetadata?.details.timestamp
    ? format(new Date(syncMetadata?.details.timestamp), "dd/MM/yyyy HH:mm")
    : "";

  const dataSourceOptions = schemaConfigData?.map((source) => ({
    label: source.datasource,
    value: source.datasource,
  }));

  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      paddingY={theme.spacing(6.7)}
      paddingX={theme.spacing(5.3)}
      gap={theme.spacing(2)}
    >
      <Typography
        variant="p3Bold"
        sx={{ color: theme.palette.contrast.grayscale.level75 }}
      >
        Data source*
      </Typography>

      <Box display={"flex"} justifyContent={"space-between"} width={"100%"}>
        <DropDown
          placeholder=""
          value={currentSelectedDataSource}
          width={theme.spacing(111)}
          options={dataSourceOptions ?? []}
          onChange={(value) =>
            setCurrentSelectedDataSource(value ? value.toString() : "")
          }
          padding="9.5px 12px"
          feedbackScreen={false}
        />

        <Box display={"flex"} flexDirection={"column"} gap={theme.spacing(1)}>
          <Button
            variant="outlined"
            disabled={isRefreshing}
            onClick={() => refreshMetadata()}
            sx={{
              height: "fit-content",
              alignSelf: "end",
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(3),
              ...theme.typography.p3Bold,
              color: theme.palette.contrast.grayscale.level50,
              textTransform: "none",
            }}
          >
            Refresh
          </Button>
          {formattedDate && (
            <Typography
              color={theme.palette.contrast.grayscale.level50}
              variant="p3"
            >
              {`Last synced.on ${formattedDate}`}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const TableHeaderSection = ({
  modifiedRows,
  setModifiedRows,
  selectedTabInfo,
  setShowSuccessTile,
}: {
  modifiedRows: TableMetadataRow[];
  setModifiedRows: Dispatch<SetStateAction<TableMetadataRow[]>>;
  setShowSuccessTile: Dispatch<SetStateAction<boolean>>;
  selectedTabInfo: SelectedTabInfo | null;
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const {
    mutate: updateMetadataMutate,
    isPending,
    // error,
    data: updateTableMetadataResponseData,
  } = useMutation({
    mutationFn: updateTableMetadata,
    onSuccess: () => {
      setShowSuccessTile(true);
    },
  });

  const handleSave = async () => {
    await Promise.all(
      modifiedRows.map((row) =>
        updateMetadataMutate({
          dbName: selectedTabInfo?.dbName ?? "",
          tableName: row.tableName,
          columnName: row.columnName,
          metadataDescription: row.metadataDescription,
          metadataType: row.metadataType,
          datasource: selectedTabInfo?.datasource ?? "",
          catalog: selectedTabInfo?.catalog ?? "",
        })
      )
    );

    // Optionally clear the modified state
    setModifiedRows([]);

    //TODO:after this lets call the fetch again
    queryClient.invalidateQueries({
      queryKey: [
        "table-metadata",
        {
          params: {
            dbName: selectedTabInfo?.dbName ?? "",
            tableName: selectedTabInfo?.tableName ?? "",
            datasource: selectedTabInfo?.datasource ?? "",
          },
        },
      ],
    });
  };

  const formattedDate = updateTableMetadataResponseData?.details?.updatedFields
    ?.updatedAt
    ? format(
        new Date(
          updateTableMetadataResponseData?.details?.updatedFields?.updatedAt ??
            ""
        ),
        "dd/MM/yyyy HH:mm"
      )
    : "";

  return (
    <Box
      display={"flex"}
      width={"100%"}
      justifyContent={"space-between"}
      alignItems={"center"}
    >
      <Box display={"flex"} gap={theme.spacing(2)} alignItems={"center"}>
        <Typography
          color={theme.palette.contrast.grayscale.level75}
          variant="p2Bold"
        >
          {"Edit Metadata"}
        </Typography>
        {formattedDate && (
          <Typography
            color={theme.palette.contrast.grayscale.level50}
            variant="p3"
          >
            {`Last Edited on ${formattedDate}`}
          </Typography>
        )}
      </Box>

      <Button
        variant="contained"
        disabled={modifiedRows.length <= 0 || isPending}
        onClick={handleSave}
        sx={{
          ...theme.typography.p3Bold,
          paddingX: theme.spacing(4),
          paddingY: theme.spacing(3),
          textTransform: "none",
        }}
      >
        {"Save"}
      </Button>
    </Box>
  );
};

const TableMetadataSection = ({
  tableMetadata,
  selectedTabInfo,
  setModifiedRows,
}: {
  tableMetadata: TableMetadata[] | undefined;
  selectedTabInfo: SelectedTabInfo | null;
  setModifiedRows: Dispatch<SetStateAction<TableMetadataRow[]>>;
}) => {
  const { mutate: exportMutation, isPending: isExportPending } = useMutation({
    mutationFn: exportSchemaConfig,
  });

  const columns = useMemo<ColumnConfig<TableMetadataRow>[]>(
    () => [
      { field: "tableName", headerName: "Table Name", editable: false },
      { field: "columnName", headerName: "Column Name", editable: false },
      { field: "columnType", headerName: "Data Type", editable: false },
      { field: "metadataType", headerName: "Metadata Type", editable: true },
      {
        field: "metadataDescription",
        headerName: "Metadata Description",
        editable: true,
      },
      {
        field: "updatedAt",
        headerName: "Time Stamp",
        editable: false,
        isTimestamp: true,
      },
      { field: "status", headerName: "Tags", editable: false },
    ],
    []
  );
  const rows = useMemo(() => {
    if (!tableMetadata) return [];
    return tableMetadata.map((item) => ({
      id: item.sk,
      tableName: item.tableName,
      columnName: item.columnName,
      columnType: item.columnType,
      metadataDescription: item.metadataDescription,
      metadataType: item.metadataType,
      status: item.status,
      updatedAt: item.updatedAt,
    }));
  }, [tableMetadata]);

  return (
    <>
      {" "}
      {rows && columns.length > 0 && (
        <Box>
          <EditableTable<TableMetadataRow>
            key={
              selectedTabInfo?.tableName
                ? `${selectedTabInfo.tableName}_${JSON.stringify(
                    tableMetadata
                  )}`
                : "default"
            }
            columns={columns}
            rows={rows}
            rowIdKey="id"
            onChange={(updatedRows) => {
              const changed = updatedRows.filter((row) => {
                const original = tableMetadata?.find((r) => r.sk === row.id);
                return (
                  original &&
                  (original.metadataDescription !== row.metadataDescription ||
                    original.metadataType !== row.metadataType)
                );
              });

              setModifiedRows((prev) => {
                const unique = [
                  ...prev.filter((p) => !changed.some((c) => c.id === p.id)),
                  ...changed,
                ];
                return unique;
              });
            }}
            onClickCloudIcon={() =>
              exportMutation({
                datasource: selectedTabInfo?.datasource ?? "",
                dbName: selectedTabInfo?.dbName ?? "",
                tableName: selectedTabInfo?.tableName,
                catalog: selectedTabInfo?.catalog,
              })
            }
            disableCloudIcon={isExportPending}
          />
        </Box>
      )}
    </>
  );
};
