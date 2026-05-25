import { Box, IconButton, TableFooter, Typography, useTheme } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { ReactNode, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowCircleLeftIcon, ArrowCircleRightIcon, CloudArrowDownIcon } from '@phosphor-icons/react';
import type { FeedbackTableDataType } from './SettingTabs/FeedbackTab';
import { downloadClickableQuestions } from '../helpers/helpers';
import { useMutation } from '@tanstack/react-query';


function TablePaginationActions(props: { count: number, page: number, rowsPerPage: number, onPageChange }) {
  const theme = useTheme();
  const { count, page, rowsPerPage, onPageChange } = props;

  const handleBackButtonClick = (event: React.MouseEvent) => {
    onPageChange(event, page - 1);
  };

  const handleNextButtonClick = (event: React.MouseEvent) => {
    onPageChange(event, page + 1);

  };

  return (
    <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        onClick={handleBackButtonClick}
        disabled={page === 0}
        aria-label="previous page"
      >
        <ArrowCircleLeftIcon size={32} />
      </IconButton>

      <Typography variant="body2" color={theme.palette.contrast.grayscale.level100}>
        Page {page + 1} of {Math.ceil(count / rowsPerPage)}
      </Typography>

      <IconButton
        onClick={handleNextButtonClick}
        disabled={page >= Math.ceil(count / rowsPerPage) - 1}
        aria-label="next page"
      >
        <ArrowCircleRightIcon size={32} />
      </IconButton>
    </Box>
  );
}


TablePaginationActions.propTypes = {
  onPageChange: PropTypes.func.isRequired,
};

export const TableComponent = (props: { data: FeedbackTableDataType, download?: boolean, disabled?: boolean, benchmarkData?: boolean }) => {
  const theme = useTheme();
  const data = props.data;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(props.benchmarkData ? 5 : 10);

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const { mutate: exportData, isPending: isExportPending } = useMutation({
    mutationFn: downloadClickableQuestions,
  });

  const handleOnClickCloudIcon = () => {
    exportData();
  }

  if (isExportPending) {
    return <Typography>Downloding...</Typography>;
  }

  return (
    <TableContainer sx={{
      width: '100%',
      maxHeight: 500, // limit vertical height
      borderRadius: 0,
      border: `0.5px solid ${theme.palette.contrast.grayscale.level10}`,
    }}>
      <Table stickyHeader aria-label="sticky table" sx={{}}>
        <TableHead>
          <TableRow
          >
            {
              Object.values(data.columns)
                .map((column: { id: string; label: string }) => {
                  if (column.id != "sql_query") {
                    return (
                      <TableCell
                        key={column.id}
                        align="center"
                        sx={{
                          maxWidth: 200,
                          minWidth: 65,
                          padding: "6px 12px",
                          alignItems: "center",
                          backgroundColor: theme.palette.contrast.grayscale.level5,
                          border: `0.5px solid ${theme.palette.contrast.grayscale.level10}`,
                          // color: 'rgba(142, 142, 142, 1)'
                        }}
                      >
                        <Typography variant="p3Bold" color={theme.palette.contrast.grayscale.level100}>
                          {column.id !== "id" ? column.label : ""}
                        </Typography>
                      </TableCell>
                    )
                  }
                })}
          </TableRow>
        </TableHead>

        <TableBody>

          {data.rows
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            .map((row: Record<string, string | object | ReactNode>, rowIndex: number) => (
              <TableRow hover role="checkbox" tabIndex={-1} key={rowIndex}>
                {Object.values(data.columns)
                  .map((column: { id: string; label: string }) => {
                    if (column.id != "sql_query") {
                      const value: string | ReactNode | object | null = row[column.id];
                      return (
                        <TableCell
                          key={JSON.stringify(column.id)}
                          align={'center'}
                          sx={{
                            padding: "6px 12px",
                            maxWidth: 200,
                            minWidth: 65,
                            width: 'auto',
                            border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
                            color: 'rgba(142, 142, 142, 1)',
                            whiteSpace: props.benchmarkData ? 'normal' : 'nowrap',
                            overflow: props.benchmarkData ? 'visible' : 'hidden',
                            textOverflow: props.benchmarkData ? 'clip' : 'ellipsis',
                            overflowWrap: 'break-word',
                          }}
                        >
                          <Typography
                            variant="p3"
                            noWrap={!props.benchmarkData}
                            sx={{
                              overflow: props.benchmarkData ? "visible" : "hidden",
                              textOverflow: props.benchmarkData ? 'clip' : 'ellipsis',
                              color: column.id == "id" ? theme.palette.contrast.grayscale.level50 : theme.palette.contrast.grayscale.level100,
                            }}
                          >
                            {value ? typeof value === "boolean" ? value.toString().toUpperCase() : value : ""}
                          </Typography>
                        </TableCell>
                      );
                    }
                  })}
              </TableRow>
            ))}
        </TableBody>

        <TableFooter>

          {props.download &&
            (<TableRow>
              <TableCell colSpan={data.columns.length}>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', p: 1 }}>
                  <CloudArrowDownIcon
                    color={theme.palette.text.secondary}
                    size={24}
                    onClick={props.disabled ? undefined : handleOnClickCloudIcon}
                    style={{
                      opacity: props.disabled ? 0.5 : 1,
                      pointerEvents: props.disabled ? "none" : "auto",
                      cursor: props.disabled ? "not-allowed" : "pointer",
                    }}
                  />
                </Box>
              </TableCell>
            </TableRow>
            )}

          <TableRow>
            <TablePagination
              sx={{
                position: 'sticky',
                bottom: 0,
                zIndex: 1,
                backgroundColor: theme.palette.contrast.grayscale.level5,
                borderTop: `0.5px solid ${theme.palette.contrast.grayscale.level10}`,
              }}
              colSpan={data.columns.length}
              count={data.rows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[]}
              labelRowsPerPage=""
              labelDisplayedRows={() => ''}
              ActionsComponent={TablePaginationActions}
            />
          </TableRow>
        </TableFooter>
      </Table>
      
    </TableContainer>
  );
}
