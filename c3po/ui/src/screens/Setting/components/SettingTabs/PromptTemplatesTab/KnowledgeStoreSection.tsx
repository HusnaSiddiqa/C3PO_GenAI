import {
  Autocomplete,
  Box,
  CircularProgress,
  TextField,
  Typography,
  useTheme
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchKnowledgeStores, isValidS3Url } from "../../../helpers/helpers";
import { KnowledgeStore, KnowledgeStoreMetadata } from "../../../helpers/types";
import ErrorDialog from "../../ErrorDialog";
import { isEmpty } from "lodash";

function getKnowledgeStoreLabel(knowledgeStore: string) {
  switch (knowledgeStore) {
    case 'open_search':
      return 'OpenSearch'
    case 'bedrock':
      return 'BedrockDB'
    default:
      return null
  }
}

function getMainComponent({
  knowledgeStoreMetadata,
  setKnowledgeStoreMetadata,
}: {
  knowledgeStoreMetadata: KnowledgeStoreMetadata,
  setKnowledgeStoreMetadata: (value: KnowledgeStoreMetadata) => void;
}) {
  const { knowledgeStore, s3Url, indices } = knowledgeStoreMetadata

  switch (knowledgeStore) {
    case 'open_search':
      {
        return (
          <Autocomplete
            fullWidth
            size="small"
            multiple
            value={indices}
            freeSolo
            onChange={(event, newValue) => {
              setKnowledgeStoreMetadata({
                knowledgeStore,
                indices: newValue
              })
            }}
            renderInput={(params) =>
              <TextField
                {...params}
                error={isEmpty(indices ?? [])}
                label="OpenSearch Indices"
              />
            }
            options={[]}
          />
        )
      }
    case 'bedrock':
      return (
        <TextField
          fullWidth
          size="small"
          label="S3 URL"
          value={s3Url}
          error={!s3Url || !isValidS3Url(s3Url)}
          onChange={(event) => {
            setKnowledgeStoreMetadata({
              knowledgeStore,
              s3Url: event.target.value
            })
          }}
        />
      )
    default:
      return null
  }
}

export const KnowledgeStoreSection = ({
  knowledgeStoreMetadata,
  setKnowledgeStoreMetadata,
}: {
  knowledgeStoreMetadata: KnowledgeStoreMetadata;
  setKnowledgeStoreMetadata: (value: KnowledgeStoreMetadata) => void;
}) => {
  const theme = useTheme();
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(true);

  const {
    data: knowledgeStores,
    isLoading: isLoadingKnowledgeStores,
    error: knowledgeStoresError,
  } = useQuery<KnowledgeStore[]>({
    queryKey: ["knowledgeStores"],
    queryFn: fetchKnowledgeStores,
    retry: false,
    throwOnError: false,
  });

  if (knowledgeStoresError) {
    return (
      <ErrorDialog
        title={"Error loading knowledge stores"}
        isErrorDialogOpen={isErrorDialogOpen}
        error={knowledgeStoresError}
        setIsErrorDialogOpen={setIsErrorDialogOpen}
      />
    )
  }

  const options = knowledgeStores?.map((availableKnowledgeStore) => ({
    id: availableKnowledgeStore.name,
    label: getKnowledgeStoreLabel(availableKnowledgeStore.name),
  }));

  const { knowledgeStore } = knowledgeStoreMetadata

  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
    >
      <Typography
        variant="p3Bold"
        sx={{ color: theme.palette.contrast.grayscale.level75 }}
      >
        Knowledge Store
      </Typography>
      {
        isLoadingKnowledgeStores ?
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={theme.spacing(3)}
          >
            <CircularProgress color={"inherit"} size={24} />
            <Typography>Fetching knowledge stores...</Typography>
          </Box> :
          <Box
            display={"flex"}
            flexDirection={"row"}
            paddingTop={theme.spacing(4)}
          >
            <Box
              flex={1}
            >
              <Autocomplete
                fullWidth
                size="small"
                renderInput={(params) =>
                  <TextField
                    {...params}
                    label="Knowledge Store"
                    error={!knowledgeStore}
                  />
                }
                options={options || []}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setKnowledgeStoreMetadata({
                      ...knowledgeStoreMetadata,
                      knowledgeStore: newValue.id,
                    })
                  }
                }}
                value={options?.find((availableKnowledgeStore) =>
                  availableKnowledgeStore.id === knowledgeStore) ?? null}
              />
            </Box>
            {
              knowledgeStore &&
              <Box
                flex={2}
                marginLeft={theme.spacing(2)}
              >
                {getMainComponent({
                  knowledgeStoreMetadata,
                  setKnowledgeStoreMetadata,
                })}
              </Box>
            }
          </Box>
      }
    </Box>
  );
}
