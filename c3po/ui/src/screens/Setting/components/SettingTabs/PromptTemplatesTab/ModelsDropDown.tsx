import { Autocomplete, Box, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchModelsList } from "../../../helpers/helpers";
import ErrorDialog from "../../ErrorDialog";

const ModelsDropDown = ({
  model,
  setModel,
  error,
}: {
  model: string;
  setModel: (model: string) => void,
  error?: boolean,
}) => {
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(true);

  const {
    data: models,
    isLoading: isLoadingModels,
    error: modelsError,
  } = useQuery({
    queryKey: ["modelsList"],
    queryFn: () => fetchModelsList(),
    throwOnError: false,
    retry: true,
  });

  if (modelsError) {
    return (
      <ErrorDialog
        title="Error fetching models"
        isErrorDialogOpen={isErrorDialogOpen}
        error={modelsError}
        setIsErrorDialogOpen={setIsErrorDialogOpen}
      />
    )
  }

  return (
    <Box
      sx={{
        opacity: isLoadingModels ? 0.5 : 1,
        cursor: isLoadingModels ? "not-allowed" : "auto",
        pointerEvents: isLoadingModels ? "none" : "auto",
      }}
    >
      <Autocomplete
        options={models ?? []}
        onChange={(e, v) => v && setModel(v)}
        value={model}
        size="small"
        renderInput={(params) =>
          <TextField {...params}
            label="Model"
            sx={{
              width: '300px'
            }}
            error={error}
          />
        }
      />
    </Box>
  );
};

export default ModelsDropDown;