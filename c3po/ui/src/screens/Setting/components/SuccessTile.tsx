import { Box, Typography, useTheme } from "@mui/material";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export const SuccessTile = ({
  visible,
  message
}: {
  visible: boolean;
  message?: string
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
      sx={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s",
        bgcolor: theme.palette.contrast.status.green10,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(4),
        paddingX: theme.spacing(4),
        paddingY: theme.spacing(2),
        marginX: theme.spacing(-8),
      }}
    >
      <CheckCircleIcon
        size={theme.spacing(8)}
        color={theme.palette.contrast.status.green100}
      />
      <Typography
        color={theme.palette.contrast.status.green100}
        variant="p3Bold"
      >
        {message ? message : "Save successfully"}
      </Typography>
    </Box>
  );
};
