import { useTheme } from "@mui/material";
import { ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";

export const PositiveIcon = ({ values }) => {
  const theme = useTheme();
  return (
    <ThumbsUpIcon
      weight="fill"
      color={
        theme.palette.mode === "dark"
          ? theme.palette.success.light
          : theme.palette.contrast.status.green100
      }
      values={values || "positive"}
      style={{ width: "12px", height: "12px", flexShrink: 0 }}
    />
  );
};

export const NegativeIcon = ({ values }) => {
  const theme = useTheme();
  return (
    <ThumbsDownIcon
      weight="fill"
      color={
        theme.palette.mode === "dark"
          ? theme.palette.error.light
          : theme.palette.contrast.status.redOff100
      }
      values={values || "negative"}
      style={{ width: "12px", height: "15px", flexShrink: 0 }}
    />
  );
};
