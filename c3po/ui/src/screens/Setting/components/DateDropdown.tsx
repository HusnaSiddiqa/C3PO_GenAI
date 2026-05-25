import { Box, ClickAwayListener, Typography, useTheme } from "@mui/material";
import { LocalizationProvider, DatePicker } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import Radio from "@mui/material/Radio";
import React, { useState } from "react";
import dayjs, { Dayjs } from "dayjs";

type Props = {
  onChange: (payload: {
    range: { from: string | null; to: string | null };
    showAllData: boolean;
  }) => void;
};
export const DateDropdown: React.FC<Props> = ({ onChange }) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Dayjs | null>(null);
  const [toDate, setToDate] = useState<Dayjs | null>(null);
  const [showAllData, setShowAllData] = useState<boolean>(true);

  const handleFromChange = (date: Dayjs | null) => {
    setShowAllData(false);
    setFromDate(date);
    onChange({
      range: {
        from: date?.format("YYYY-MM-DD") || null,
        to: toDate?.format("YYYY-MM-DD") || null,
      },
      showAllData: showAllData,
    });
  };

  const handleToChange = (date: Dayjs | null) => {
    setShowAllData(false);
    setToDate(date);
    onChange({
      range: {
        from: fromDate?.format("YYYY-MM-DD") || null,
        to: date?.format("YYYY-MM-DD") || null,
      },
      showAllData: showAllData,
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Box sx={{ width: 140 }}>
          <Box
            onClick={() => setOpen((o) => !o)}
            sx={{
              border: `1px solid ${
                theme.palette.contrast?.grayscale?.level10 || "#ccc"
              }`,
              borderRadius: theme.spacing(1),
              padding: "9.5px 12px",
              background: theme.palette.contrast.grayscale.level0,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              userSelect: "none",
              marginRight: 2,
            }}
          >
            <Typography
              variant="body2"
              color={theme.palette.contrast?.grayscale?.level100 || "#666"}
              sx={{ flex: 1 }}
            >
              {fromDate && toDate
                ? `${fromDate.format("DD/MM/YYYY")} - ${toDate.format(
                    "DD/MM/YYYY"
                  )}`
                : "Date: All"}
            </Typography>
            {open ? (
              <CaretUpIcon
                color={theme.palette.contrast?.grayscale?.level50 || "#999"}
              />
            ) : (
              <CaretDownIcon
                color={theme.palette.contrast?.grayscale?.level50 || "#999"}
              />
            )}
          </Box>
          {open && (
            <Box
              sx={{
                position: "absolute",
                width: "auto",
                bgcolor:
                  theme.palette.mode === "dark"
                    ? theme.palette.background.paper
                    : theme.palette.contrast.fixed.white,
                borderRadius: 1,
                boxShadow: "1px 4px 20px rgba(0,0,0,0.1)",
                zIndex: 10,
                mt: 1,
                display: "flex",
                gap: 2,
                p: 2,
                flexDirection: "column",
                alignItems: "flex-start",
                border:
                  theme.palette.mode === "dark"
                    ? `1px solid ${theme.palette.divider}`
                    : "none",
              }}
            >
              <Box
                onClick={() => {
                  setShowAllData(true);
                  onChange({
                    range: {
                      from: null,
                      to: null,
                    },
                    showAllData: true,
                  });
                  setFromDate(null);
                  setToDate(null);
                  setOpen(false);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <Radio
                  checked={showAllData}
                  sx={{
                    mr: 2,
                    color: showAllData
                      ? theme.palette.mode === "dark"
                        ? "#4caf50" // Clear bright green for dark mode
                        : theme.palette.contrast.status.green100
                      : theme.palette.mode === "dark"
                      ? theme.palette.text.secondary
                      : theme.palette.contrast.grayscale.level10,
                    "&.Mui-checked": {
                      color:
                        theme.palette.mode === "dark"
                          ? "#4caf50" // Clear bright green for dark mode
                          : theme.palette.contrast.status.green100,
                    },
                    "& .MuiSvgIcon-root": {
                      background: showAllData
                        ? theme.palette.mode === "dark"
                          ? "rgba(76, 175, 80, 0.1)" // Light green background for dark mode
                          : theme.palette.contrast.grayscale.level10
                        : "transparent",
                      borderRadius: "50%",
                    },
                    "&.Mui-checked .MuiSvgIcon-root circle": {
                      r: 6.5,
                      fill:
                        theme.palette.mode === "dark"
                          ? "#4caf50" // Ensure the inner circle is bright green
                          : "currentColor",
                    },
                    "&:hover": {
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(76, 175, 80, 0.08)"
                          : "rgba(76, 175, 80, 0.04)",
                    },
                  }}
                />{" "}
                <Typography
                  variant={"p1"}
                  fontSize={"14px"}
                  overflow={"hidden"}
                  textOverflow={"ellipsis"}
                  whiteSpace={"nowrap"}
                  sx={{ flex: 1 }}
                  color={theme.palette.contrast.grayscale.level50}
                >
                  All
                </Typography>
              </Box>
              <Box sx={{ width: 140 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 0.5,
                    color: theme.palette.text.primary,
                  }}
                >
                  From
                </Typography>
                <DatePicker
                  maxDate={dayjs()}
                  value={fromDate}
                  onChange={handleFromChange}
                  sx={{
                    width: "100%",
                    "& .MuiInputBase-root": {
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "white",
                      color: theme.palette.text.primary,
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor:
                        theme.palette.mode === "dark"
                          ? theme.palette.divider
                          : theme.palette.grey[300],
                    },
                    "& .MuiInputBase-input": {
                      color: theme.palette.text.primary,
                    },
                  }}
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: {
                        fontSize: "12px",
                        "& input": {
                          padding: "4px 8px",
                          color: theme.palette.text.primary,
                        },
                      },
                    },
                    popper: {
                      sx: {
                        "& .MuiPaper-root": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? theme.palette.background.paper
                              : "white",
                          color: theme.palette.text.primary,
                        },
                        "& .MuiPickersDay-root": {
                          color: theme.palette.text.primary,
                          "&:hover": {
                            backgroundColor: theme.palette.action.hover,
                          },
                          "&.Mui-selected": {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          },
                        },
                        "& .MuiPickersCalendarHeader-root": {
                          color: theme.palette.text.primary,
                        },
                        "& .MuiPickersArrowSwitcher-button": {
                          color: theme.palette.text.primary,
                        },
                      },
                    },
                  }}
                />
              </Box>
              <Box sx={{ width: 140 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 0.5,
                    color: theme.palette.text.primary,
                  }}
                >
                  To
                </Typography>
                <DatePicker
                  maxDate={dayjs()}
                  value={toDate}
                  onChange={handleToChange}
                  sx={{
                    width: "100%",
                    "& .MuiInputBase-root": {
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? theme.palette.background.default
                          : "white",
                      color: theme.palette.text.primary,
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor:
                        theme.palette.mode === "dark"
                          ? theme.palette.divider
                          : theme.palette.grey[300],
                    },
                    "& .MuiInputBase-input": {
                      color: theme.palette.text.primary,
                    },
                  }}
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: {
                        fontSize: "12px",
                        "& input": {
                          padding: "4px 8px",
                          color: theme.palette.text.primary,
                        },
                      },
                    },
                    popper: {
                      sx: {
                        "& .MuiPaper-root": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? theme.palette.background.paper
                              : "white",
                          color: theme.palette.text.primary,
                        },
                        "& .MuiPickersDay-root": {
                          color: theme.palette.text.primary,
                          "&:hover": {
                            backgroundColor: theme.palette.action.hover,
                          },
                          "&.Mui-selected": {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                          },
                        },
                        "& .MuiPickersCalendarHeader-root": {
                          color: theme.palette.text.primary,
                        },
                        "& .MuiPickersArrowSwitcher-button": {
                          color: theme.palette.text.primary,
                        },
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </ClickAwayListener>
    </LocalizationProvider>
  );
};
