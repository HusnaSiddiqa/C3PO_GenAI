import { Box, Typography, useTheme } from "@mui/material";
import { InfoIcon } from "@phosphor-icons/react";
import { useState, useEffect } from "react";

export const WarningTile = ({
  visible,
  message,
  width = "100%",
}: {
  visible: boolean;
  message: string;
  width?: string;
}) => {
  const theme = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      // Wait for fade-out before unmounting
      const timer = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Only render when show is true (prevents unmount before fade-out)
  if (!show && !visible) return null;

  return (
    <Box
      width={width}
      sx={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s",
        bgcolor: theme.palette.contrast.main.main10,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(4),
        paddingX: theme.spacing(4),
        paddingY: theme.spacing(2),
        borderRadius: theme.spacing(2),
      }}
    >
      <InfoIcon
        size={theme.spacing(8)}
        color={theme.palette.contrast.main.main100}
      />
      <Typography color={theme.palette.contrast.main.main100} variant="p3Bold">
        {message}
      </Typography>
    </Box>
  );
};