import {
  Dialog,
  Box,
  Typography,
  Button,
  useTheme
} from "@mui/material";
import { Trash } from "phosphor-react";

export const DeleteConfirmationDialog = ({
  open,
  onConfirm,
  onCancel,
  agentName,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  agentName: string;
}) => {
  const theme = useTheme();

  return (
    <Dialog open={open} maxWidth="md" autoFocus data-testid="delete-confirmation-dialog">
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
          <Trash
            style={{ width: "32px", height: "32px", flexShrink: 0, color: theme.palette.error.main }}
          />
          <Box display={"flex"} flexDirection={"column"} gap={theme.spacing(2)}>
            <Typography
              variant="h4"
              color={theme.palette.contrast.grayscale.level100}
            >
              Delete Sub-Agent
            </Typography>
            <Typography
              variant="p2"
              color={theme.palette.contrast.grayscale.level50}
            >
              Are you sure you want to delete <strong>{agentName}</strong>? This action cannot be undone.
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
            onClick={onCancel}
          >
            <Typography
              variant="p3Bold"
              color={theme.palette.contrast.grayscale.level50}
              sx={{
                textTransform: "none",
              }}
            >
              Cancel
            </Typography>
          </Button>
          <Button
            onClick={onConfirm}
            sx={{
              height: "36px",
              px: 2,
              borderRadius: "6px",
              backgroundColor: theme.palette.error.main,
              color: "#fff",
              "&:hover": {
                backgroundColor: theme.palette.error.dark,
              },
            }}
            variant="contained"
          >
            <Typography
              variant="p3Bold"
              sx={{
                textTransform: "none",
              }}
            >
              Delete
            </Typography>
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};
