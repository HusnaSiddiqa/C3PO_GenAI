import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useUnsavedChanges } from "../../../context/UnsavedTabChangesContext";
import { fetchLatestAgentVersion, isPromptTemplateDirty, isRagAgent } from "../../../helpers/helpers";
import { WarningTile } from "../../WarningTile";
import BenchmarkingInputFile from "./BenchmarkingInputFile";
import BYODFile from "./BYODFile";
import { useInitialAgentDetails } from "./context/InitialAgentDetailsContext";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { useSelectedAgentDetails } from "./context/SelectedAgentDetailsContext";
import { KnowledgeStoreSection } from "./KnowledgeStoreSection";
import ModelsDropDown from "./ModelsDropDown";
import PromptTemplateField from "./PromptTemplateField";
import SavePromptAgentDetails from "./SavePromptAgentDetails";
import TemperatureAutocomplete from "./TemperatureAutocomplete";
import VersionDropDown from "./VersionDropDown";
import { omit } from "lodash";
import { EmbeddingModelSection } from "./EmbeddingModelSection";

const AgentDetailsSection = () => {
  const theme = useTheme();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [accuracy, setAccuracy] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isBodySectionDisabled, setIsBodySectionDisabled] = useState(false);
  const [uploadedBYODFileData, setUploadedBYODFileData] = useState<{
    file_url: string;
    filename: string;
    file_id: string;
    file_type: string
  } | null>(null);

  const { selectedAgent: currentSelectedAgent } = useSelectedAgent();
  const { setSelectedAgentDetails } = useSelectedAgentDetails();
  const {
    setInitialAgentDetails: setInitialAgentDetailsState,
    initialAgentDetails: initialAgentDetailsState
  } = useInitialAgentDetails();
  const { selectedAgentDetails } = useSelectedAgentDetails();

  const {
    data: agentVersionDetails,
    isLoading: isLoadingAgentVersionDetails,
    error: agentVersionDetailsError,
  } = useQuery({
    queryKey: ["agentVersionDetails", currentSelectedAgent?.id],
    queryFn: () => fetchLatestAgentVersion(currentSelectedAgent?.name ?? ""),
    enabled: Boolean(currentSelectedAgent?.id),
    retry: false,
  });

  useEffect(() => {
    if (agentVersionDetails) {
      setSelectedAgentDetails(omit(agentVersionDetails, ["agentId"]));
      setInitialAgentDetailsState(agentVersionDetails);
    }
  }, [agentVersionDetails, setInitialAgentDetailsState, setSelectedAgentDetails]);

  const isDirty = isPromptTemplateDirty({
    selectedAgentDetails: selectedAgentDetails,
    initialAgentDetails: initialAgentDetailsState,
  })

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [setHasUnsavedChanges, isDirty]);

  if (isLoadingAgentVersionDetails) {
    return (
      <Box
        display="flex"
        height={"100%"}
        alignItems="center"
        justifyContent="center"
        gap={theme.spacing(3)}
      >
        <CircularProgress color={"inherit"} size={24} />
        <Typography>Fetching Agent Details...</Typography>
      </Box>
    );
  }

  if (agentVersionDetailsError) {
    return (
      <Box
        display="flex"
        height={"100%"}
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
      >
        <Typography color="error" variant="body1">
          {agentVersionDetailsError.message}
        </Typography>
      </Box>
    );
  }

  const isRagAgentValue = isRagAgent(currentSelectedAgent);

  const {
    knowledgeStoreMetadata,
    embeddingModel,
  } = selectedAgentDetails

  return (
    <Box
      gap={theme.spacing(8)}
      display={"flex"}
      flexDirection={"column"}
      sx={{
        opacity: isBodySectionDisabled ? 0.5 : 1,
        cursor: isBodySectionDisabled ? "not-allowed" : "auto",
        pointerEvents: isBodySectionDisabled ? "none" : "auto",
      }}
    >
      <Box display={"flex"} alignItems={"center"} gap={theme.spacing(4)}>
        <VersionDropDown
          setIsBodySectionDisabled={setIsBodySectionDisabled}
        />
        <ModelsDropDown
          model={selectedAgentDetails.model}
          setModel={(model) => setSelectedAgentDetails((prev) => ({
            ...prev,
            model,
          }))}
        />
        <TemperatureAutocomplete
          temperature={selectedAgentDetails.temperature}
          setTemperature={(temperature) => setSelectedAgentDetails((prev) => ({
            ...prev,
            temperature,
          }))}
        />
      </Box>
      <Box display={"flex"} flexDirection={"column"} gap={theme.spacing(2)}>
        <WarningTile
          visible={isDirty}
          width="70%"
          message="By editing you'll be creating a new prompt template"
        />

        <PromptTemplateField
          prompt={selectedAgentDetails.prompt}
          setPrompt={(prompt) => setSelectedAgentDetails((prev) => ({
            ...prev,
            prompt,
          }))}
        />
      </Box>
      {
        isRagAgentValue &&
        <EmbeddingModelSection
          embeddingModel={embeddingModel}
          setEmbeddingModel={(value) => setSelectedAgentDetails((prev) => ({
            ...prev,
            embeddingModel: value,
          }))}
          error={!embeddingModel}
        />
      }
      {
        isRagAgentValue &&
        <KnowledgeStoreSection
          knowledgeStoreMetadata={knowledgeStoreMetadata ?? { knowledgeStore: null }}
          setKnowledgeStoreMetadata={(value) => setSelectedAgentDetails((prev) => ({
            ...prev,
            knowledgeStoreMetadata: value,
          }))}
        />
      }
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        gap={theme.spacing(4)}
        width="100%"
      >
        {
          currentSelectedAgent?.name !== "BYOD" ?
            <BenchmarkingInputFile
              agentName={currentSelectedAgent?.name ?? ""}
              accuracy={accuracy}
              setAccuracy={setAccuracy}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
            /> :
            <BYODFile setUploadedBYODFileData={setUploadedBYODFileData} />
        }

        {
          currentSelectedAgent?.name === "BYOD" && uploadedBYODFileData &&
          <BenchmarkingInputFile
            agentName={currentSelectedAgent?.name ?? ""}
            uploadedBYODFileData={uploadedBYODFileData}
            accuracy={accuracy}
            setAccuracy={setAccuracy}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
          />
        }
      </Box>
      <SavePromptAgentDetails
        isButtonDisabled={!isDirty}
      />
    </Box>
  );
};

export default AgentDetailsSection;