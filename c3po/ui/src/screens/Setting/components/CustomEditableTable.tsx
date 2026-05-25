import React, { useState } from "react";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  type TablePaginationActionsProps,
} from "@mui/material";
import {
  ArrowCircleLeftIcon,
  ArrowCircleRightIcon,
  CloudArrowDownIcon,
} from "@phosphor-icons/react";
import { format } from "date-fns";

export interface ColumnConfig<T> {
  field: keyof T;
  headerName: string;
  editable: boolean;
  isTimestamp?: boolean;
}

interface CustomTableProps<T> {
  columns: ColumnConfig<T>[];
  rows: T[];
  rowIdKey: keyof T;
  disableCloudIcon?: boolean;
  onChange?: (updatedRows: T[]) => void;
  onClickCloudIcon: () => void;
}

export default function CustomEditableTable<T extends { [key: string]: any }>({
  columns,
  rows: initialRows,
  rowIdKey,
  disableCloudIcon = false,
  onChange,
  onClickCloudIcon,
}: CustomTableProps<T>) {
  const theme = useTheme();
  const [rows, setRows] = useState<T[]>(initialRows);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowId: T[typeof rowIdKey],
    field: keyof T
  ) => {
    const value = e.target.value;

    const updatedRows = rows.map((row) =>
      row[rowIdKey] === rowId
        ? {
            ...row,
            [field]: typeof row[field] === "number" ? Number(value) : value,
          }
        : row
    );

    const updatedRow = updatedRows.find((row) => row[rowIdKey] === rowId)!;

    setRows(updatedRows);
    onChange?.([updatedRow]); // Only pass the updated row as an array
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      <TableContainer
        sx={{
          borderRadius: theme.spacing(2),
          border: `0.5px solid ${theme.palette.contrast.grayscale.level10}`,
        }}
      >
        <Table sx={{ tableLayout: "fixed", width: "100%" }}>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={String(col.field)}
                  sx={{
                    paddingX: theme.spacing(4),
                    paddingY: theme.spacing(1.5),
                    borderTop: theme.spacing(2),
                    backgroundColor: theme.palette.contrast.grayscale.level5,
                    border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                  }}
                >
                  <Typography
                    variant="p3Bold"
                    color={theme.palette.contrast.grayscale.level100}
                  >
                    {col.headerName}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {rows
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow
                  key={row[rowIdKey]}
                  sx={{
                    ...(row.status === "deleted" && {
                      opacity: 0.5,
                      pointerEvents: "none",
                    }),
                  }}
                >
                  {columns.map((col, index) => (
                    <TableCell
                      key={String(col.field)}
                      sx={{
                        maxWidth: 50,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingX: theme.spacing(4),
                        paddingY: theme.spacing(1.5),
                        borderRadius: theme.spacing(2),
                        border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                        ...(index === 0 && {
                          borderTopLeftRadius: theme.spacing(2),
                        }),
                        ...(index === columns.length - 1 && {
                          borderTopRightRadius: theme.spacing(2),
                        }),
                      }}
                    >
                      {col.editable ? (
                        <TextField
                          variant="outlined"
                          value={row[col.field]}
                          size="small"
                          onChange={(e) =>
                            handleChange(e, row[rowIdKey], col.field)
                          }
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor:
                                  theme.palette.contrast.grayscale.level10,
                              },
                              "&.Mui-focused fieldset": {
                                border: "1px solid",
                                borderColor:
                                  theme.palette.contrast.grayscale.level10,
                              },
                              "& .MuiInputBase-input": {
                                ...theme.typography.p3,
                                color: theme.palette.contrast.grayscale.level100,
                                paddingY: theme.spacing(1),
                                paddingX: theme.spacing(1.4),
                              },
                              borderRadius: theme.spacing(1.3),
                            },
                          }}
                        />
                      ) : col.field === "status" ? (
                        row[col.field] === "added" && 
                        (
                          <Box
                            // width={"44px"}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: theme.spacing(4),
                              backgroundColor: theme.palette.contrast.status.green10,
                              paddingX: theme.spacing(4),
                              paddingY: theme.spacing(1),
                              border: `1px solid ${theme.palette.contrast.status.green100}`,
                            }}
                          >
                            <Typography
                              variant="f2"
                              sx={{
                                color: theme.palette.contrast.status.green100,
                              }}
                            >
                              New
                            </Typography>
                          </Box>
                        )
                      ) : (
                        <Tooltip
                          title={
                            col.isTimestamp && row[col.field]
                              ? format(
                                  new Date(row[col.field]),
                                  "dd/MM/yyyy HH:mm"
                                )
                              : row[col.field] || ""
                          }
                        >
                          <Box
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              cursor: "default",
                            }}
                          >
                            <Typography
                              variant="p3"
                              color={theme.palette.contrast.grayscale.level100}
                              noWrap
                            >
                              {col.isTimestamp && row[col.field]
                                ? format(
                                    new Date(row[col.field]),
                                    "dd/MM/yyyy HH:mm"
                                  )
                                : row[col.field]}
                            </Typography>
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            <TableRow>
              <TableCell
                colSpan={columns.length}
                sx={{
                  paddingX: theme.spacing(4),
                  paddingY: theme.spacing(2),
                  textAlign: "right",
                  borderLeft: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                  borderRight: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                  borderBottom: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                  borderBottomLeftRadius: theme.spacing(2),
                  borderBottomRightRadius: theme.spacing(2),
                }}
              >
                <CloudArrowDownIcon
                  data-testid="cloud-icon"
                  color={theme.palette.contrast.grayscale.level50}
                  size={theme.spacing(7)}
                  onClick={disableCloudIcon ? undefined : onClickCloudIcon}
                  style={{
                    opacity: disableCloudIcon ? 0.5 : 1,
                    pointerEvents: disableCloudIcon ? "none" : "auto",
                    cursor: disableCloudIcon ? "not-allowed" : "pointer",
                  }}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5]}
          labelRowsPerPage=""
          labelDisplayedRows={() => ""}
          ActionsComponent={TablePaginationActions}
        />
      </TableContainer>
    </Box>
  );
}

function TablePaginationActions(props: TablePaginationActionsProps) {
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleBackButtonClick = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null
  ) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null
  ) => {
    onPageChange(event, page + 1);
  };

  return (
    <Box
      sx={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(3),
        paddingRight: theme.spacing(2),
      }}
    >
      <IconButton
        sx={{
          padding: 0,
          border: "none",
        }}
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <ArrowCircleLeftIcon size={24} />
      </IconButton>

      <Typography variant="p3" color={theme.palette.contrast.grayscale.level100}>
        Page {page + 1} of {Math.ceil(count / rowsPerPage)}
      </Typography>

      <IconButton
        sx={{ padding: 0, border: "none" }}
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        <ArrowCircleRightIcon size={24} />
      </IconButton>
    </Box>
  );
}
