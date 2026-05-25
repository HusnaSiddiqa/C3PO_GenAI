import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from "@mui/material";

function ErrorDialog({
  isErrorDialogOpen,
  error,
  title,
  setIsErrorDialogOpen,
}: {
  title: string;
  isErrorDialogOpen: boolean;
  error: Error | null;
  setIsErrorDialogOpen: (open: boolean) => void;
}) {
  return (
    error &&
    <Dialog open={isErrorDialogOpen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{error.message}</DialogContent>
      <DialogActions>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            return setIsErrorDialogOpen(false);
          }}
          variant="contained"
        >
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ErrorDialog;
