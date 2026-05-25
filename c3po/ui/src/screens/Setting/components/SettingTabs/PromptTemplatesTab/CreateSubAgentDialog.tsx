import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  useTheme
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useContext, useState } from "react";
import { UserContext } from "../../../../../contexts/UserContext";
import { createSubAgent, isRagAgentType, isValidS3Url } from "../../../helpers/helpers";
import { Agent, KnowledgeStoreMetadata, ServerKnowledgeStoreMetadata } from "../../../helpers/types";
import { ErrorTile } from "../../ErrorTile";
import { LabelledInputTextField } from "../../LabelledInputTextField";
import BenchmarkingInputFile from "./BenchmarkingInputFile";
import BYODFile from "./BYODFile";
import { AllSubAgentsContext } from "./context/AllSubAgentsContext";
import { EmbeddingModelSection } from "./EmbeddingModelSection";
import { KnowledgeStoreSection } from "./KnowledgeStoreSection";
import ModelsDropDown from "./ModelsDropDown";
import PromptTemplateField from "./PromptTemplateField";
import TemperatureAutocomplete from "./TemperatureAutocomplete";
import { isUndefined, omitBy } from "lodash";

function CreateSubAgentDialog({ isDialogOpen, closeDialog, agentType }:
  {
    isDialogOpen: boolean;
    closeDialog: () => void;
    agentType: Agent;
  }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<boolean>(false);
  const [reason, setReason] = useState<unknown>(null);
  const { allSubAgents } = useContext(AllSubAgentsContext);
  const { user } = useContext(UserContext);
  const theme = useTheme();
  const [model, setModel] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [relatesTo, setRelatesTo] = useState<string[]>([]);
  const [accuracy, setAccuracy] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedBYODFileData, setUploadedBYODFileData] = useState<{
    file_url: string;
    filename: string;
    file_id: string;
    file_type: string
  } | null>(null);
  const [knowledgeStoreMetadata, setKnowledgeStoreMetadata] =
    useState<KnowledgeStoreMetadata | null>(null);
  const [embeddingModel, setEmbeddingModel] = useState<string | undefined>(undefined);

  const userId = user?.userId ?? "";
  const isRagAgentValue = isRagAgentType(agentType.name);
  const { knowledgeStore, indices, s3Url } = knowledgeStoreMetadata ?? {}

  const isSubmitEnabled = (
    model &&
    temperature &&
    name &&
    description &&
    prompt &&
    (
      !isRagAgentValue || (
        embeddingModel &&
        knowledgeStore &&
        (
          (indices && indices.length > 0) ||
          (s3Url && isValidS3Url(s3Url))
        )
      )
    )
  );

  return (
    <Dialog
      open={isDialogOpen}
      fullWidth
      maxWidth={"lg"}
      disableEscapeKeyDown
    >
      <DialogTitle fontSize={'120%'}>Create new {agentType.name}</DialogTitle>
      <DialogContent>
        <Box
          display={"flex"}
          alignItems={"center"}
          flexDirection={"column"}
          gap={theme.spacing(4)}
          padding={theme.spacing(4)}
        >
          <TextField
            required
            fullWidth
            label="Agent name"
            onChange={(event) => setName(event.target.value)}
            error={!name}
          />
          <LabelledInputTextField
            placeHolderText={"Enter description*"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minRows={2}
            maxRows={5}
            isResizable={false}
            error={!description}
            label={"Description"}
          />
          <PromptTemplateField
            error={!prompt}
            prompt={prompt}
            setPrompt={setPrompt}
            minRows={10}
            maxRows={20}
          />
          <Box
            display={"flex"}
            justifyContent={"start"}
            alignItems={"center"}
            width={'100%'}
          >
            <Box marginRight={theme.spacing(4)}>
              <ModelsDropDown
                model={model}
                setModel={setModel}
                error={!model}
              />
            </Box>
            <TemperatureAutocomplete
              required
              error={!temperature}
              temperature={temperature}
              setTemperature={setTemperature}
            />
          </Box>
          <Autocomplete
            renderInput={(params) => <TextField {...params} label="Relates to" />}
            multiple
            fullWidth
            options={allSubAgents
              .filter((subAgent) => subAgent.agent_type !== agentType.name)
              .map((subAgent) => subAgent.name)}
            onChange={(event, value) => setRelatesTo(value)}
          />
          {
            isRagAgentValue &&
            <Box
              width={'100%'}
            >
              <EmbeddingModelSection
                embeddingModel={embeddingModel}
                setEmbeddingModel={setEmbeddingModel}
                error={!embeddingModel}
              />
              <Box height={theme.spacing(4)} />
              <KnowledgeStoreSection
                knowledgeStoreMetadata={knowledgeStoreMetadata ?? { knowledgeStore: null }}
                setKnowledgeStoreMetadata={setKnowledgeStoreMetadata}
              />
            </Box>
          }
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            gap={theme.spacing(4)}
            width="100%"
          >
            {
              agentType.name !== "BYOD" ?
                <BenchmarkingInputFile
                  agentName={agentType.name ?? ""}
                  accuracy={accuracy}
                  setAccuracy={setAccuracy}
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                /> :
                <BYODFile setUploadedBYODFileData={setUploadedBYODFileData} />
            }

            {
              agentType.name === "BYOD" && uploadedBYODFileData &&
              <BenchmarkingInputFile
                agentName={agentType.name ?? ""}
                uploadedBYODFileData={uploadedBYODFileData}
                accuracy={accuracy}
                setAccuracy={setAccuracy}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
              />
            }
          </Box>
          <ErrorTile
            visible={!!reason}
            message={`${reason}`}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={!isSubmitEnabled}
          loading={loading}
          loadingPosition="start"
          onClick={async () => {
            setLoading(true);

            let knowledgeStoreMetadataWrapper: {
              knowledge_store_metadata?: ServerKnowledgeStoreMetadata
            } = {}

            const { knowledgeStore, indices, s3Url } = knowledgeStoreMetadata ?? {}

            if (knowledgeStore) {
              knowledgeStoreMetadataWrapper = {
                knowledge_store_metadata: {
                  knowledge_store: knowledgeStore,
                  indices,
                  s3_url: s3Url,
                }
              };
            }

            return createSubAgent({
              agent_name: name,
              agent_description: description,
              agent_type: agentType.name,
              relates_to: relatesTo,
              prompt,
              model,
              temperature,
              user_id: userId,
              ...omitBy({ embedding_model: embeddingModel }, isUndefined),
              ...knowledgeStoreMetadataWrapper,
            }).then(() => {
              setLoading(false);

              setAccuracy('');
              setModel('');
              setName('');
              setDescription('');
              setPrompt('');
              setReason(null);
              setRelatesTo([]);
              setTemperature('');
              setSelectedFile(null);
              setEmbeddingModel(undefined);
              setKnowledgeStoreMetadata(null);

              closeDialog();

              queryClient.invalidateQueries({
                queryKey: ['subAgents', agentType.id]
              });
            })
              .catch((reason) => {
                setLoading(false);
                setReason(reason);
              });
          }}
        >
          Create sub-agent
        </Button>
        <Button onClick={closeDialog}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateSubAgentDialog;