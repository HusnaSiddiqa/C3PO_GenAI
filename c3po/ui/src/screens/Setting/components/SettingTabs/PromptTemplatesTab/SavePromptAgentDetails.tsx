import { Button, useTheme } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { UserContext } from "../../../../../contexts/UserContext";
import { saveAgentPrompt } from "../../../helpers/helpers";
import { AgentVersionDetailsResponse, KnowledgeStoreMetadata, SaveAgentPromptRequest } from "../../../helpers/types";
import { useInitialAgentDetails } from "./context/InitialAgentDetailsContext";
import { useSelectedAgent } from "./context/SelectedAgentContext";
import { useSelectedAgentDetails } from "./context/SelectedAgentDetailsContext";
import { useShowSuccess } from "./context/ShowSuccessContext";
import { isUndefined, omitBy } from "lodash";

const SavePromptAgentDetails = ({
  isButtonDisabled,
}: {
  isButtonDisabled: boolean;
}) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useContext(UserContext)?.user?.userId ?? "";
  const {
    selectedAgentDetails,
    setSelectedAgentDetails: setAgentDetails,
  } = useSelectedAgentDetails();
  const {
    setInitialAgentDetails: setInitialAgentDetailsState,
  } = useInitialAgentDetails();
  const { selectedAgent } = useSelectedAgent();
  const { setShowSuccess } = useShowSuccess();

  const { mutate: savePrompt, isPending: isSavingAgentDetails } = useMutation({
    mutationFn: (payload: SaveAgentPromptRequest) =>
      saveAgentPrompt(payload.agentId, payload),
    onSuccess: (newData) => {
      setShowSuccess(true);

      let knowledgeStoreMetadataWrapper: {
        knowledgeStoreMetadata?: KnowledgeStoreMetadata
      } = {};

      const {
        knowledgeStoreMetadata,
        embeddingModel,
      } = newData

      const embeddingModelWrapper: {
        embeddingModel?: string;
      } = omitBy({ embeddingModel }, isUndefined)

      if (knowledgeStoreMetadata) {
        const { knowledgeStore, indices, s3Url } = knowledgeStoreMetadata

        knowledgeStoreMetadataWrapper = {
          knowledgeStoreMetadata: {
            knowledgeStore,
            ...omitBy({
              indices,
              s3Url
            }, isUndefined),
          }
        }
      }

      setAgentDetails((prev) => {
        const existingVersions = prev?.versions ?? [];
        const newVersions = existingVersions.includes(newData.versionAlias)
          ? existingVersions
          : [newData.versionAlias, ...existingVersions];

        return {
          model: newData.model,
          temperature: newData.temperature,
          prompt: newData.prompt,
          versionAlias: newData.versionAlias,
          versions: newVersions,
          ...knowledgeStoreMetadataWrapper,
          ...embeddingModelWrapper,
        };
      });

      setInitialAgentDetailsState((prev) => {
        const existingVersions = prev?.versions ?? [];
        const newVersions = existingVersions.includes(newData.versionAlias)
          ? existingVersions
          : [newData.versionAlias, ...existingVersions];

        return {
          model: newData.model,
          temperature: newData.temperature,
          prompt: newData.prompt,
          versionAlias: newData.versionAlias,
          versions: newVersions,
          ...knowledgeStoreMetadataWrapper,
          ...embeddingModelWrapper,
        };
      });

      queryClient.setQueryData(
        ["agentVersionDetails", newData.agentId],
        (prev: AgentVersionDetailsResponse | undefined) => {
          const updatedVersions = prev?.versions ?? [];
          const isNew = !updatedVersions.includes(newData.versionAlias);
          return {
            agentId: newData.agentId,
            model: newData.model,
            temperature: newData.temperature,
            prompt: newData.prompt,
            versionAlias: newData.versionAlias,
            versions: isNew
              ? [newData.versionAlias, ...updatedVersions]
              : updatedVersions,
            ...knowledgeStoreMetadataWrapper,
            ...embeddingModelWrapper,
          };
        }
      );
    },
  });

  return (
    <Button
      variant="contained"
      disabled={isButtonDisabled || isSavingAgentDetails}
      onClick={() => {
        let knowledgeStoreMetadataWrapper: {
          knowledgeStoreMetadata?: KnowledgeStoreMetadata
        } = {}

        const { knowledgeStoreMetadata, embeddingModel } = selectedAgentDetails

        const embeddingModelWrapper: {
          embeddingModel?: string;
        } = omitBy({ embeddingModel }, isUndefined)

        if (knowledgeStoreMetadata) {
          const { knowledgeStore, indices, s3Url } = knowledgeStoreMetadata

          knowledgeStoreMetadataWrapper = {
            knowledgeStoreMetadata: {
              knowledgeStore,
              ...omitBy({
                indices,
                s3Url,
              }, isUndefined)
            },
          }
        }

        savePrompt({
          agentId: selectedAgent?.id ?? "",
          model: selectedAgentDetails.model,
          prompt: selectedAgentDetails.prompt,
          temperature: selectedAgentDetails.temperature,
          user_id: userId,
          ...knowledgeStoreMetadataWrapper,
          ...embeddingModelWrapper,
        });
      }}
      sx={{
        height: "fit-content",
        alignSelf: "end",
        paddingX: theme.spacing(4),
        paddingY: theme.spacing(3),
        ...theme.typography.p3Bold,
        textTransform: "none",
      }}
    >
      Save
    </Button>
  );
};

export default SavePromptAgentDetails;
