import { Input, styled } from "@mui/material";
import { customScrollbar } from "../../../commonStyles";

export const HistoryContainer = styled("div")<{ $empty: boolean }>(
  ({ theme, $empty }) => ({
    overflow: "hidden",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    ...customScrollbar(theme),
    [theme.breakpoints.down("md")]: {
      height: "69vh",
    },
    [theme.breakpoints.down("lg")]: {
      height: "65vh",
    },
    [theme.breakpoints.up("lg")]: {
      height: "70vh",
    },

    ".history-container-group": {
      width: "100%",
      ...($empty
        ? {
            display: "flex",
            alignItems: "center",
            height: "inherit",
          }
        : {}),
    },
  })
);

export const SearchInput = styled(Input)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  gap: theme.spacing(2),
  height: theme.spacing(12),
  padding: `${theme.spacing(2)} ${theme.spacing(4)}`,
  border: `1px solid ${theme.palette.contrast.grayscale.level10}`,
  borderRadius: theme.spacing(2),
  background: "#fff",
  "&&&:before": {
    borderBottom: "none",
  },
  "&&:after": {
    borderBottom: "none",
  },
  "& .MuiInputBase-input": {
    ...theme.typography.p3,
    color: "#000",
  },
  "& .MuiInputBase-input::placeholder": {
    ...theme.typography.p3,
    color: "#000",
  },
}));
