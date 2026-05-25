import { Button, CircularProgress, Dialog, DialogContent, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import MarkdownRenderer from "../../../../../components/MarkdownRenderer/MarkdownRenderer";
import { fetchReadme } from "../../../../../helpers/api";
import ErrorDialog from "../../../../Setting/components/ErrorDialog";

export const Readme = () => {
  const [isReadmeDialogOpen, setIsReadmeDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const theme = useTheme();

  const {
    data: readmeContent,
    isLoading: isLoadingReadme,
    error: readmeError,
  } = useQuery({
    queryKey: ["readme"],
    queryFn: async () => {
      const readmeContentsFromBackend = await fetchReadme();
      setIsErrorDialogOpen(true);
      return readmeContentsFromBackend;
    },
    throwOnError: false,
    retry: false,
  });

  return (
    <>
      {
        readmeError &&
        <ErrorDialog
          title="Error fetching Readme"
          isErrorDialogOpen={isErrorDialogOpen}
          error={readmeError}
          setIsErrorDialogOpen={setIsErrorDialogOpen}
        />
      }
      <Button
        variant="contained"
        color="primary"
        onClick={() => setIsReadmeDialogOpen(true)}
      >
        Readme
      </Button>
      <Dialog
        fullWidth
        maxWidth="md"
        open={isReadmeDialogOpen}
        onClose={() => setIsReadmeDialogOpen(false)}
      >
        <DialogContent sx={{ paddingX: theme.spacing(12) }}>
          {
            isLoadingReadme ?
              <CircularProgress /> :
              <MarkdownRenderer>{String(readmeContent)}</MarkdownRenderer>
          }
        </DialogContent>
      </Dialog>
    </>
  )
}