import { Box, Button, Typography, useTheme } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import type { OnboardingDetails } from "../../helpers/types";
import {
  fetchOnboardingDetails,
  updateOnboardingDetails,
} from "../../helpers/helpers";
import { SuccessTile } from "../SuccessTile";
import { LabelledInputTextField } from "../LabelledInputTextField";
import { useUnsavedChanges } from "../../context/UnsavedTabChangesContext";

export const OnboardingTab = () => {
  const theme = useTheme();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  // Fetch onboarding details
  const { data, isLoading, isError } = useQuery<OnboardingDetails>({
    queryKey: ["onboardingDetails"],
    queryFn: fetchOnboardingDetails,
    retry: false,
    throwOnError: true,
  });

  const queryClient = useQueryClient();

  const {
    mutate: saveOnboarding,
    isPending: isSaving,
    isSuccess: isSaveSuccess,
  } = useMutation({
    mutationFn: updateOnboardingDetails,
    //   queryClient.invalidateQueries({ queryKey: ["onboardingDetails"] });
    // },
    onSuccess: (updated) => {
      queryClient.setQueryData<OnboardingDetails>(
        ["onboardingDetails"],
        (prev) => ({
          ...(prev || {}),
          onboardingId: updated.onboarding_id,
          agentName: updated.agent_name,
          agentDescription: updated.agent_description,
          updatedBy: updated.updated_by,
          updatedAt: updated.updated_at,
        })
      );
    },
  });

  const [initialFormDataState, setInitialFormDataState] = useState({
    name: "",
    description: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Populate form when data is fetched
  useEffect(() => {
    if (data) {
      setFormData({
        name: data.agentName || "",
        description: data.agentDescription || "",
      });
      setInitialFormDataState({
        name: data.agentName || "",
        description: data.agentDescription || "",
      });
    }
    if (isSaveSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [data, isSaveSuccess]);

  const isFormStateChanged = useCallback(() => {
    return (
      formData.name !== initialFormDataState.name ||
      formData.description !== initialFormDataState.description
    );
  }, [formData, initialFormDataState]);

  useEffect(() => {
    setHasUnsavedChanges(isFormStateChanged());
  }, [isFormStateChanged, setHasUnsavedChanges]);

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (isError) {
    return (
      <Typography color="error">Failed to load onboarding details</Typography>
    );
  }

  // const isFieldValid = (value: string) => {
  //   const trimmed = value.trim()
  //   const regex = /^\s*$/;
  // .replace(/\u2018|\u2019/g, "'")
  // .replace(/\u201C|\u201D/g, '"').trim()

  // Allow letters, numbers, spaces, and broader punctuation including brackets
  // const allowedCharsRegex =
  //   /^[a-zA-Z0-9\s.,()[\]{}\-'"!?@#$%^&*_+=:;\\/|<>`~]+$/;
  // allowedCharsRegex.test(trimmed)
  // const hasLetterRegex = /[a-zA-Z]/;
  //   return regex.test(trimmed)
  // };
  const isFormValid = formData.name && formData.description.trim();

  const handleChange =
    (field: "name" | "description") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData({ ...formData, [field]: e.target.value });
    };

  const formattedDate = data?.updatedAt
    ? format(new Date(data.updatedAt), "dd/MM/yyyy HH:mm")
    : "";

  const updatedByText = `Last updated . ${formattedDate}`;
  const handleSave = () => {
    saveOnboarding({
      onboarding_id: data?.onboardingId || "",
      agent_name: formData.name,
      agent_description: formData.description,
      updated_by: "",
    });
  };

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
          boxShadow: `0px 4px 6px ${theme.palette.contrast.grayscale.level10}`,
          borderBottom: (theme) =>
            `1px solid ${theme.palette.contrast.grayscale.level10}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box display={"flex"} alignItems="center" gap={theme.spacing(5)}>
            <Typography variant="h4">Onboarding Details</Typography>
            <Typography
              color={theme.palette.contrast.grayscale.level50}
              variant="p3"
            >
              {updatedByText}
            </Typography>
          </Box>

          <Button
            variant="contained"
            disabled={!isFormValid || isSaving || !isFormStateChanged()}
            onClick={handleSave}
            sx={{
              paddingX: theme.spacing(4),
              paddingY: theme.spacing(3),
              ...theme.typography.p3Bold,
              textTransform: "none",
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Box>
      <Box
        display={"flex"}
        flexDirection={"column"}
        gap={theme.spacing(8)}
        marginTop={theme.spacing(8)}
      >
        <LabelledInputTextField
          label="Agent Name*"
          isFullWidth={false}
          minRows={2}
          isResizable={false}
          value={formData.name}
          onChange={handleChange("name")}
          // error={!!formState.errors.name}
          // errorMessage={formState.errors.name}
        />

        <LabelledInputTextField
          label="Agent Description*"
          maxLine={30}
          multiline
          minRows={10}
          value={formData.description}
          onChange={handleChange("description")}
          // error={!!formState.errors.description}
          // errorMessage={formState.errors.description}
        />
      </Box>
    </Box>
  );
};
