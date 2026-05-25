import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  TablePagination,
  useTheme,
  GlobalStyles,
  Box,
} from "@mui/material";
import { toTitleCase } from "../../../../../utils";
import { CloudArrowDownIcon, CopyIcon } from "@phosphor-icons/react";
import styled from "styled-components";

interface TableDataVisualizerProps {
  rawData: Array<Record<string, string>>;
  dataLimitExceeded: boolean;
  userId: string;
  conversationId: string;
  csvFileName: string;
}

const CopyMessage = styled.div`
  font-size: 12px;
  color: green;
  padding-left: 8px;
`;

const TableDataVisualizer: React.FC<TableDataVisualizerProps> = ({
  rawData,
  dataLimitExceeded,
  conversationId,
  csvFileName,
  userId,
}) => {
  const theme = useTheme();
  const [data, setData] = useState<Array<Record<string, string>>>([{}]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [copied, setCopied] = useState(false);

  // useEffect(() => {
  //   try {
  //     // const parsed = JSON.parse(rawData);
  //     setData(rawData);
  //   } catch (err) {
  //     console.error("Invalid JSON data", err);
  //   }
  // }, [rawData]);

  useEffect(() => {
    let formattedData: Array<Record<string, any>> = [];

    try {
      if (typeof rawData === "string") {
        // Try parsing the JSON string
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed)) {
          formattedData = parsed;
        } else {
          console.error("Parsed data is not an array");
        }
      } else if (Array.isArray(rawData)) {
        // Already parsed data
        formattedData = rawData;
      } else {
        console.error("Invalid data format");
      }

      setData(formattedData);
    } catch (err) {
      console.error("Failed to parse rawData:", err);
    }
  }, [rawData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(rawData)).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  const exportToCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = dataLimitExceeded ?
      `/v2/chat-manager/conversation/download/${userId}/${conversationId}/${csvFileName}` :
      URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_data.csv");
    link.click();
  };

  // const columns = Object.keys(rawData[0]);
  const columns = Object.keys(data[0] || {});

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
      <GlobalStyles
        styles={{
          ".MuiBackdrop-root, .MuiBackdrop-invisible, .MuiModal-backdrop": {
            opacity: "0 !important",
            backgroundColor: "transparent !important",
            pointerEvents: "auto !important",
          },
        }}
      />
      <TableContainer
        component={Paper}
        sx={{
          maxWidth: 900,
          mx: "auto",
          mt: 4,
          maxHeight: 300,
          overflow: "auto",
          // Add border radius and shadow for visual separation
          borderRadius: 2,
          boxShadow: 2,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead sx={{ backgroundColor: theme.palette.background.main }}>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column + 1}
                  align="center"
                  sx={{
                    maxWidth: 200,
                    minWidth: 65,
                    padding: "6px 12px",
                    alignItems: "center",
                    border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                    backgroundColor: theme.palette.background.main,
                    color: theme.palette.contrast.grayscale.level50,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "inherit", fontWeight: 600 }}
                  >
                    {toTitleCase(column)}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row, rowIndex) => (
                <TableRow
                  key={rowIndex + page * rowsPerPage}
                  sx={{
                    backgroundColor: theme.palette.background.default, // Use a single color for all rows
                    borderBottom: `2px solid ${theme.palette.divider}`,
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      align={"center"}
                      sx={{
                        padding: "6px 12px",
                        maxWidth: 200,
                        minWidth: 65,
                        width: "auto",
                        backgroundColor:
                          theme.palette.mode === "dark" ? "" : "#fff",
                        border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                        color: theme.palette.background.main,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: theme.palette.contrast.grayscale.level50,
                          fontFeatureSettings: "'liga' off, 'clig' off",
                          fontFamily: "Proxima Nova",
                          fontSize: "14px",
                          fontStyle: "normal",
                          fontWeight: 400,
                          lineHeight: "20px",
                        }}
                      >
                        {typeof row[col] === "object"
                          ? JSON.stringify(row[col])
                          : row[col]}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {/* Add a divider between table and pagination */}
        <div
          style={{
            borderTop: `2px solid ${theme.palette.divider}`,
            width: "100%",
          }}
        />
        <TablePagination
          rowsPerPageOptions={[5, 10, 15, 25, 50]}
          component="div"
          count={data.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          style={{
            color: "gray",
            position: "static",
            bottom: 0,
            background: theme.palette.background.paper,
          }}
        />
      </TableContainer>
      {
        <div
          style={{
            display: "flex",
            justifyContent: "end",
            alignItems: "center",
            marginTop: theme.spacing(2),
          }}
        >
          {
            dataLimitExceeded &&
            <Box flex={1}>
              <Typography variant="body2">
                Only a small representation of the data is displayed here.
                Please download the full dataset for a complete view.
              </Typography>
            </Box>
          }
          <CloudArrowDownIcon
            color={theme.palette.grey[700]}
            size={theme.spacing(7)}
            onClick={exportToCSV}
            style={{
              cursor: "pointer",
              marginTop: theme.spacing(2),
              marginBottom: theme.spacing(2),
            }}
          />
          <CopyIcon
            size={25}
            onClick={handleCopy}
            style={{
              cursor: "pointer",
              marginTop: theme.spacing(2),
              marginBottom: theme.spacing(2),
            }}
          />
        </div>
      }
      {copied && <CopyMessage>Copied!</CopyMessage>}
    </>
  );
};

export default TableDataVisualizer;
