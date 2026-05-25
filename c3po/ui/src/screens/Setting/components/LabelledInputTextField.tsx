import { Box, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";
import ThemedTextarea from "./ThemedTextarea";

interface LabeledInputTextFieldProps {
  label: React.ReactNode;
  placeHolderText?: string;
  maxRows?: number;
  multiline?: boolean;
  isFullWidth?: boolean;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  error?: boolean;
  minRows?: number;
  errorMessage?: string;
  isResizable?: boolean;
}

export const LabelledInputTextField = ({
  label,
  placeHolderText = "",
  maxRows,
  isFullWidth = true,
  value,
  onChange,
  error = false,
  minRows = 3,
  errorMessage = "",
  isResizable = true,
}: LabeledInputTextFieldProps) => {
  const theme = useTheme();

  const renderLabel = useMemo(() => {
    if (typeof label === "string") {
      return (
        <Typography
          variant="p3Bold"
          sx={{ color: theme.palette.contrast.grayscale.level75 }}
        >
          {label}
        </Typography>
      );
    }
    return label;
  }, [label, theme]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
        width: isFullWidth ? "100%" : "50%",
        maxHeight: '50vh',
        overflowY: 'auto',
      }}
    >
      {renderLabel}
      <ThemedTextarea
        minRows={minRows}
        isResizable={isResizable}
        placeHolderText={placeHolderText}
        value={value}
        onChange={onChange}
        maxRows={maxRows}
        error={error}
      />
      {error && (
        <Typography variant="p3" sx={{ color: theme.palette.error.main }}>
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
};
