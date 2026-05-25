import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { format } from "date-fns";
import type { Instruction, InstructionFormState } from "../../helpers/types";
import { fetchInstructions, updateInstruction } from "../../helpers/helpers";
import { SuccessTile } from "../SuccessTile";
import { LabelledInputTextField } from "../LabelledInputTextField";
import { useUnsavedChanges } from "../../context/UnsavedTabChangesContext";

const initialFormState: InstructionFormState = {
  generalInstructions: {
    instructionId: "",
    category: "general_instructions",
    description: "",
    updatedBy: "",
    updatedAt: "",
  },
  businessRules: {
    instructionId: "",
    category: "business_rules",
    description: "",
    updatedBy: "",
    updatedAt: "",
  },
  dataHandlingRules: {
    instructionId: "",
    category: "data_handling_rules",
    description: "",
    updatedBy: "",
    updatedAt: "",
  },
};

export const InstructionsTab = () => {
  const theme = useTheme();
  const [showSuccess, setShowSuccess] = useState(false);
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const queryClient = useQueryClient();
  const [formData, setFormData] =
    useState<InstructionFormState>(initialFormState);

  const [initialFormDataState, setInitialFormDataState] =
    useState<InstructionFormState>(initialFormState);

  const {
    data: instructions,
    isLoading,
    error,
  } = useQuery<Instruction[]>({
    queryKey: ["instructions"],
    queryFn: fetchInstructions,
    throwOnError: true,
  });

  const {
    mutate: saveInstruction,
    isPending: isSavingInstruction,
    isSuccess: isSaveSuccessInstruction,
  } = useMutation({
    mutationFn: updateInstruction,
    onSuccess: (updated) => {
      queryClient.setQueryData<Instruction[]>(["instructions"], (prev) => {
        if (!prev) return [updated];
        return prev.map((item) =>
          item.instructionId === updated.instruction_id
            ? {
                ...item,
                description: updated.description,
                updatedBy: updated.updated_by,
                updatedAt: updated.updated_at,
              }
            : item
        );
      });
    },
  });

  useEffect(() => {
    if (instructions) {
      const mapped: InstructionFormState = { ...initialFormState };
      instructions.forEach((item) => {
        switch (item.category) {
          case "general_instructions":
            mapped.generalInstructions = item;
            break;
          case "business_rules":
            mapped.businessRules = item;
            break;
          case "data_handling_rules":
            mapped.dataHandlingRules = item;
            break;
        }
      });
      setFormData(mapped);
      setInitialFormDataState(mapped);
    }
    if (isSaveSuccessInstruction) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [instructions, isSaveSuccessInstruction]);

  const isFormStateChanged = useCallback(
    (category: keyof InstructionFormState): boolean => {
      switch (category) {
        case "generalInstructions":
          return (
            formData.generalInstructions.description !==
            initialFormDataState.generalInstructions.description
          );

        case "businessRules":
          return (
            formData.businessRules.description !==
            initialFormDataState.businessRules.description
          );

        case "dataHandlingRules":
          return (
            formData.dataHandlingRules.description !==
            initialFormDataState.dataHandlingRules.description
          );
      }
    },
    [formData, initialFormDataState]
  );

  useEffect(() => {
    setHasUnsavedChanges(
      isFormStateChanged("generalInstructions") ||
        isFormStateChanged("businessRules") ||
        isFormStateChanged("dataHandlingRules")
    );
  }, [setHasUnsavedChanges, isFormStateChanged]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error.message}</Typography>;
  }

  const handleChange =
    (field: keyof InstructionFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: {
          ...prev[field],
          description: e.target.value,
        },
      }));
    };

  const handleSaveInstruction = (category: keyof InstructionFormState) => {
    const instruction = formData[category];
    saveInstruction({
      instruction_id: instruction.instructionId,
      category: instruction.category,
      description: instruction.description,
      updated_by: "admin", //TODO: Replace with actual user
    });
  };

  const formattedDate =
    instructions && instructions[0]?.updatedAt
      ? format(new Date(instructions[0]?.updatedAt), "dd/MM/yyyy HH:mm")
      : "";

  const updatedByText = `Last updated . ${formattedDate}`;

  return (
    <Box display={"flex"} flexDirection={"column"}>
      {showSuccess && <SuccessTile visible={showSuccess} />}
      <Box
        sx={{
          paddingX: theme.spacing(8),
          paddingY: theme.spacing(9),
          marginX: theme.spacing(-8),
          borderBottomLeftRadius: theme.spacing(4),
          borderBottomRightRadius: theme.spacing(4),
          boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.03)",
          borderBottom: (theme) =>
            `1px solid ${theme.palette.contrast.grayscale.level10}`,
        }}
      >
        <Box display={"flex"} alignItems="center" gap={theme.spacing(5)}>
          <Typography variant="h4">Instruction</Typography>
          {formattedDate && (
            <Typography
              color={theme.palette.contrast.grayscale.level50}
              variant="p3"
            >
              {updatedByText}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={theme.spacing(8)}
        sx={{
          marginTop: theme.spacing(8),
        }}
      >
        <LabelledInputTextField
          label="General Instructions*"
          maxLine={4}
          minRows={3}
          multiline
          value={formData.generalInstructions.description}
          onChange={handleChange("generalInstructions")}
        />
        <Button
          variant="contained"
          disabled={
            isSavingInstruction || !isFormStateChanged("generalInstructions")
          }
          onClick={() => handleSaveInstruction("generalInstructions")}
          sx={{
            height: "fit-content",
            alignSelf: "center",
            marginTop: theme.spacing(8),
            paddingX: theme.spacing(4),
            paddingY: theme.spacing(3),
            ...theme.typography.p3Bold,
            textTransform: "none",
          }}
        >
          Save
        </Button>
      </Box>

      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={theme.spacing(8)}
        sx={{
          marginTop: theme.spacing(8),
        }}
      >
        <LabelledInputTextField
          label="Business Rules *"
          maxLine={4}
          minRows={3}
          multiline
          value={formData.businessRules.description}
          onChange={handleChange("businessRules")}
        />
        <Button
          variant="contained"
          disabled={isSavingInstruction || !isFormStateChanged("businessRules")}
          onClick={() => handleSaveInstruction("businessRules")}
          sx={{
            height: "fit-content",
            alignSelf: "center",
            marginTop: theme.spacing(8),
            paddingX: theme.spacing(4),
            paddingY: theme.spacing(3),
            ...theme.typography.p3Bold,
            textTransform: "none",
          }}
        >
          Save
        </Button>
      </Box>

      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={theme.spacing(8)}
        sx={{
          marginTop: theme.spacing(8),
        }}
      >
        <LabelledInputTextField
          label="Data Handling Rules* "
          maxLine={4}
          minRows={3}
          multiline
          value={formData.dataHandlingRules.description}
          onChange={handleChange("dataHandlingRules")}
        />
        <Button
          variant="contained"
          disabled={
            isSavingInstruction || !isFormStateChanged("dataHandlingRules")
          }
          onClick={() => handleSaveInstruction("dataHandlingRules")}
          sx={{
            height: "fit-content",
            alignSelf: "center",
            marginTop: theme.spacing(8),
            paddingX: theme.spacing(4),
            paddingY: theme.spacing(3),
            ...theme.typography.p3Bold,
            textTransform: "none",
          }}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};
