import { Box, Typography, useTheme } from "@mui/material";
import { LabelledInputTextField } from "../../LabelledInputTextField";

function PromptTemplateField({
  prompt,
  setPrompt,
  error,
  minRows,
  maxRows,
}: {
  prompt: string,
  setPrompt: (value: string) => void,
  error?: boolean,
  minRows?: number,
  maxRows?: number
}) {
  const theme = useTheme();

  return (
    <LabelledInputTextField
      error={error}
      minRows={minRows}
      label={
        <Box display={"flex"} alignItems={"center"} gap={theme.spacing(2)}>
          <Typography
            color={theme.palette.contrast.grayscale.level75}
            variant="h5"
          >
            Prompt Template
          </Typography>
        </Box>
      }
      onChange={(e) => setPrompt(e.target.value)}
      value={prompt}
      isFullWidth
      maxRows={maxRows}
      multiline
      placeHolderText="Enter your prompt template here*"
    />
  )
}

export default PromptTemplateField;
