import {
  Dialog,
  Box,
  Typography,
  Button,
  useTheme
} from "@mui/material";
import { WarningCircle } from "phosphor-react";

export const DirtyChangesWarning = ({
  onClose,
  onStay,
  open,
}: {
  onClose: () => void;
  onStay: () => void;
  open: boolean;
}) => {
  const theme = useTheme();

  return (
    <Dialog open={open} maxWidth="md" autoFocus data-testid="warning-dialog">
      <Box
        sx={{
          backgroundColor: theme.palette.contrast.grayscale.level0,
          padding: "24px",
          width: {
            md: "480px",
            lg: "600px",
          },
        }}
      >
        <Box sx={{ display: "flex", gap: theme.spacing(2) }}>
          <WarningCircle
            style={{ width: "32px", height: "32px", flexShrink: 0 }}
          />
          <Box display={"flex"} flexDirection={"column"} gap={theme.spacing(2)}>
            <Typography
              variant="h4"
              color={theme.palette.contrast.grayscale.level100}
            >
              You have unsaved changes
            </Typography>
            <Typography
              variant="p2"
              color={theme.palette.contrast.grayscale.level50}
            >
              If you leave now, your changes will be lost.
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: theme.spacing(3),
            mt: theme.spacing(8),
          }}
        >
          <Button
            sx={{
              height: "36px",
              px: 2,
              borderRadius: "6px",
              backgroundColor: theme.palette.contrast.fixed.white,
            }}
            variant="outlined"
            onClick={onClose}
          >
            <Typography
              variant="p3Bold"
              color={theme.palette.contrast.grayscale.level50}
              sx={{
                textTransform: "none",
              }}
            >
              Leave without saving
            </Typography>
          </Button>
          <Button
            onClick={onStay}
            sx={{
              height: "36px",
              px: 2,
              borderRadius: "6px",
              backgroundColor: theme.palette.contrast.main.main100,
              color: "#fff",
            }}
            variant="contained"
          >
            <Typography
              variant="p3Bold"
              sx={{
                textTransform: "none",
              }}
            >
              Stay
            </Typography>
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};