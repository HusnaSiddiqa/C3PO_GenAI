import { Autocomplete, Box, CircularProgress, TextField, Typography, useTheme } from "@mui/material";
import { useState } from "react";
import { EmbeddingModel } from "../../../helpers/types";
import { useQuery } from "@tanstack/react-query";
import { fetchEmbeddingModels } from "../../../helpers/helpers";
import ErrorDialog from "../../ErrorDialog";

export const EmbeddingModelSection = ({
  embeddingModel,
  setEmbeddingModel,
  error,
}: {
  embeddingModel?: string;
  setEmbeddingModel: (value: string) => void;
  error: boolean;
}) => {
  const theme = useTheme();
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(true);

  const {
    data: embeddingModels,
    isLoading: isLoadingEmbeddingModels,
    error: embeddingModelsError,
  } = useQuery<EmbeddingModel[]>({
    queryKey: ["embeddingModels"],
    queryFn: fetchEmbeddingModels,
    retry: false,
    throwOnError: false,
  });

  if (embeddingModelsError) {
    return (
      <ErrorDialog
        title={"Error loading embedding models"}
        isErrorDialogOpen={isErrorDialogOpen}
        error={embeddingModelsError}
        setIsErrorDialogOpen={setIsErrorDialogOpen}
      />
    )
  }

  const options = embeddingModels?.map((availableEmbeddingModel) =>
    availableEmbeddingModel.name,
  );

  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
    >
      <Typography
        variant="p3Bold"
        sx={{ color: theme.palette.contrast.grayscale.level75 }}
      >
        Embedding Model
      </Typography>
      {
        isLoadingEmbeddingModels ?
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={theme.spacing(3)}
          >
            <CircularProgress color={"inherit"} size={24} />
            <Typography>Fetching embedding models...</Typography>
          </Box> :
          <Box
            marginTop={theme.spacing(4)}
            width={'50%'}
          >
            <Autocomplete
              size="small"
              renderInput={(params) =>
                <TextField
                  {...params}
                  error={error}
                  label="Embedding Model"
                />
              }
              options={options || []}
              onChange={(event, newValue) => {
                if (newValue) {
                  setEmbeddingModel(newValue);
                }
              }}
              value={options?.find((availableEmbeddingModel) =>
                availableEmbeddingModel === embeddingModel) ?? null}
            />
          </Box>
      }
    </Box>
  );
};