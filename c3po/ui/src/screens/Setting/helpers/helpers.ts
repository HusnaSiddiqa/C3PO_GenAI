import { authFetch } from "../../../helpers/authFetch";
import { isEqual, isUndefined, omitBy } from "lodash";
import type {
  Agent,
  AgentPromptDetails,
  AgentsResponse,
  AgentVersionDetailsResponse,
  SaveAgentPromptRequest,
  SaveAgentPromptResponse,
  Instruction,
  InstructionCategory,
  MetadataStatus,
  OnboardingDetails,
  SchemaDatasource,
  SyncMetadataResponse,
  TableMetadata,
  UpdateTableMetadataPayload,
  UpdateTableMetadataResponse,
  FeedbackDetailsType,
  ClickableQuestionsDetails,
  GetBenchmarkDetailsParams,
  BenchmarkRequest,
  ConfigData,
  CreateSubAgentRequest,
  SubAgentsResponse,
  SubAgent,
  DeletePromptResponse,
  KnowledgeStore,
  KnowledgeStoresResponse,
  AgentDetails,
  KnowledgeStoreMetadata,
  EmbeddingModel,
  EmbeddingModelsResponse,
  ServerKnowledgeStoreMetadata,
} from "./types";

export const fetchInstructions = async (): Promise<Instruction[]> => {
  const res = await authFetch("/v2/admin/settings/instructions");
  if (!res.ok) throw new Error("Failed to authFetch instructions");

  const json = await res.json();

  return json.map((item: Record<string, unknown>) => ({
    instructionId: item.instruction_id,
    category: item.category,
    description: item.description,
    updatedBy: item.updated_by,
    updatedAt: item.updated_at,
  }));
};

export async function updateInstruction(payload: {
  instruction_id: string;
  category: InstructionCategory;
  description: string;
  updated_by: string;
}) {
  const res = await authFetch("/v2/admin/settings/instructions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update instruction");
  return res.json();
}

export async function fetchOnboardingDetails(): Promise<OnboardingDetails> {
  const res = await authFetch("/v2/admin/settings/onboarding");
  if (!res.ok) throw new Error("Failed to authFetch onboarding details");
  const json = await res.json();
  return {
    onboardingId: json.onboarding_id,
    agentName: json.agent_name,
    agentDescription: json.agent_description,
    updatedAt: json.updated_at,
    updatedBy: json.updated_by,
  };
}

// Update onboarding details
export async function updateOnboardingDetails(payload: {
  onboarding_id: string;
  agent_name: string;
  agent_description: string;
  updated_by: string;
}) {
  const res = await authFetch("/v2/admin/settings/onboarding", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update onboarding details");
  return res.json();
}

export async function callSynMetadata(): Promise<SyncMetadataResponse> {
  const response = await authFetch("/v2/admin/schema/sync-metadata", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 'Authorization': `Bearer ${token}`
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Sync failed");
  }
  const data = await response.json();

  return {
    status: data.status,
    message: data.message,
    details: {
      databricksTablesSynced: data.details.databricks_tables_synced,
      glueTablesSynced: data.details.glue_tables_synced,
      databricksColumnsSynced: data.details.databricks_columns_synced,
      glueColumnsSynced: data.details.glue_columns_synced,
      totalTablesProcessed: data.details.total_tables_processed,
      totalColumnsProcessed: data.details.total_columns_processed,
      errors: data.details.errors,
      durationSeconds: data.details.duration_seconds,
      timestamp: data.details.timestamp,
    },
  };
}

export async function getSchemaConfig(): Promise<SchemaDatasource[]> {
  const response = await authFetch("/v2/admin/schema/schema-config");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to authFetch schema config");
  }

  const data = await response.json(); // Read it only once
  console.log("Schema Config:", data);

  return data;
}

export async function getTableMetadata(params: {
  dbName: string;
  tableName: string;
  datasource: string;
  catalog: string;
}): Promise<TableMetadata[]> {
  const { dbName, tableName, datasource, catalog } = params;

  const searchParams = new URLSearchParams({
    db_name: dbName,
    table_name: tableName,
    datasource,
  });

  if (catalog) {
    searchParams.append("catalog", catalog);
  }

  const response = await authFetch(
    `/v2/admin/schema/schema-metadata?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to authFetch table metadata");
  }

  const rawData = await response.json();

  return rawData.map(
    (item: Record<string, string>): TableMetadata => ({
      pk: item.PK,
      sk: item.SK,
      itemType: item.item_type,
      datasource: item.datasource,
      catalog: item.catalog,
      dbName: item.db_name,
      tableName: item.table_name,
      columnName: item.column_name,
      columnType: item.column_type,
      status: item.status as MetadataStatus,
      metadataDescription: item.metadata_description,
      metadataType: item.metadata_type,
      syncTimestamp: item.sync_timestamp,
      updatedAt: item.updated_at,
    })
  );
}

export const updateTableMetadata = async (
  payload: UpdateTableMetadataPayload
): Promise<UpdateTableMetadataResponse> => {
  const response = await authFetch("/v2/admin/schema/schema-metadata", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      db_name: payload.dbName,
      table_name: payload.tableName,
      column_name: payload.columnName,
      metadata_description: payload.metadataDescription,
      metadata_type: payload.metadataType,
      datasource: payload.datasource,
      catalog: payload.catalog,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update metadata: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    status: data.status,
    details: data.details && {
      pk: data.details.PK,
      sk: data.details.SK,
      updatedFields: data.details.updated_fields && {
        metadataDescription: data.details.updated_fields.metadata_description,
        metadataType: data.details.updated_fields.metadata_type,
        updatedAt: data.details.updated_fields.updated_at,
      },
      error: data.details.error,
    },
  };
};

export async function exportSchemaConfig({
  datasource,
  dbName,
  tableName,
  catalog,
}: {
  datasource: string;
  dbName: string;
  tableName?: string;
  catalog?: string;
}) {
  const params = new URLSearchParams();
  params.append("datasource", datasource);
  params.append("db_name", dbName);
  if (tableName) params.append("table_name", tableName);
  if (catalog) params.append("catalog", catalog);

  const res = await authFetch(
    `/v2/admin/schema/export-schema-config?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to export schema config");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `schema_export_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function fetchAgents(): Promise<Agent[]> {
  const res = await authFetch("/v2/admin/settings/prompt-template/agents");
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch agents: ${err}`);
  }
  const data: AgentsResponse = await res.json();
  return data.agents;
}

export async function fetchSubAgents(
  agentType: string,
): Promise<SubAgent[]> {
  const res = await authFetch(`/v2/admin/settings/prompt-template/sub-agent/${encodeURIComponent(
    agentType
  )}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch sub-agents: ${err}`);
  }
  const data: SubAgentsResponse = await res.json();
  return data.sub_agents;
}

export async function fetchAgentTypes(): Promise<Agent[]> {
  const res = await authFetch(`/v2/admin/settings/prompt-template/agent_types`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch agent-types: ${err}`);
  }
  const data: AgentsResponse = await res.json();
  return data.agents;
}

export async function fetchKnowledgeStores(): Promise<KnowledgeStore[]> {
  const res = await authFetch(`/v2/admin/settings/prompt-template/knowledge-stores`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch knowledge-stores: ${err}`);
  }
  const data: KnowledgeStoresResponse = await res.json();

  const { knowledge_stores: knowledgeStores } = data;
  return knowledgeStores ?? [];
}

export async function fetchEmbeddingModels(): Promise<EmbeddingModel[]> {
  const res = await authFetch(`/v2/admin/settings/prompt-template/embedding-models`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch embedding-models: ${err}`);
  }
  const data: EmbeddingModelsResponse = await res.json();

  const { embedding_models: embeddingModels } = data;
  return embeddingModels ?? [];
}

export async function fetchAllSubAgents(): Promise<SubAgent[]> {
  const res = await authFetch(`/v2/admin/settings/prompt-template/sub-agents`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to authFetch all sub-agents: ${err}`);
  }
  const data: SubAgentsResponse = await res.json();
  return data.sub_agents;
}

export async function deleteSubAgent(
  agentName: string
): Promise<DeletePromptResponse> {
  const response = await authFetch(
    `/v2/admin/settings/prompt-template/sub-agent/${encodeURIComponent(agentName)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete sub-agent ${agentName}: ${errorText}`);
  }

  const data = await response.json();

  return data;
}

export async function createSubAgent(
  payload: CreateSubAgentRequest
): Promise<SaveAgentPromptResponse> {
  const response = await authFetch(
    "/v2/admin/settings/prompt-template/sub-agent",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create sub-agent: ${errorText}`);
  }

  const data = await response.json();

  return {
    agentId: data.agent_id,
    versionAlias: data.version_alias,
    prompt: data.prompt,
    model: data.model,
    temperature: data.temperature,
    benchmarkFile: data.benchmark_file,
    accuracy: data.accuracy,
    ...extractEmbeddingModel(data),
    ...extractKnowledgeStoreMetadata(data),
  };
}

export async function fetchLatestAgentVersion(
  agent: string
): Promise<AgentVersionDetailsResponse> {
  const res = await authFetch(
    `/v2/admin/settings/prompt-template/agent-versions/latest/${encodeURIComponent(
      agent
    )}`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error fetching version for ${agent}: ${text}`);
  }
  const data = await res.json();
  return {
    agentId: data.agent_id,
    versionAlias: data.version_alias,
    prompt: data.prompt,
    model: data.model,
    temperature: data.temperature,
    versions: data.versions,
    ...extractKnowledgeStoreMetadata(data),
    ...extractEmbeddingModel(data),
  };
}

export async function fetchPromptDetails(
  agent: string,
  version: string
): Promise<AgentPromptDetails> {
  const response = await authFetch(
    `/v2/admin/settings/prompt-template/${agent}/${version}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to authFetch prompt details");
  }

  const data = await response.json();

  return {
    agent: data.agent,
    versionAlias: data.version_alias,
    prompt: data.prompt,
    model: data.model,
    temperature: data.temperature,
    ...extractKnowledgeStoreMetadata(data),
    ...extractEmbeddingModel(data),
  };
}

export async function fetchModelsList(): Promise<string[]> {
  const response = await authFetch("/v2/admin/settings/prompt-template/models");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to authFetch models list");
  }

  return response.json();
}

export async function fetchConfig(): Promise<ConfigData> {
  const response = await fetch("/v2/admin/ui/config");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch ui config");
  }

  return response.json();
}

export async function saveAgentPrompt(
  agentId: string,
  payload: SaveAgentPromptRequest
): Promise<SaveAgentPromptResponse> {
  let knowledgeStoreMetadataWrapper: {
    knowledge_store_metadata?: ServerKnowledgeStoreMetadata
  } = {}

  const { knowledgeStoreMetadata, embeddingModel } = payload

  const embeddingModelWrapper: {
    embedding_model?: string;
  } = omitBy({ embedding_model: embeddingModel }, isUndefined)

  const { knowledgeStore, indices, s3Url } = knowledgeStoreMetadata ?? {}

  if (knowledgeStore) {
    knowledgeStoreMetadataWrapper = {
      knowledge_store_metadata: {
        knowledge_store: knowledgeStore,
        ...omitBy({
          indices,
          s3_url: s3Url,
        }, isUndefined),
      }
    }
  }

  const response = await authFetch(
    `/v2/admin/settings/prompt-template/${encodeURIComponent(agentId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: payload.agentId,
        prompt: payload.prompt,
        model: payload.model,
        temperature: payload.temperature,
        benchmark_file: payload.benchmarkFile,
        accuracy: payload.accuracy,
        user_id: payload.user_id,
        ...knowledgeStoreMetadataWrapper,
        ...embeddingModelWrapper,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save agent prompt: ${errorText}`);
  }

  const data = await response.json();

  return {
    agentId: data.agent_id,
    versionAlias: data.version_alias,
    prompt: data.prompt,
    model: data.model,
    temperature: data.temperature,
    benchmarkFile: data.benchmark_file,
    accuracy: data.accuracy,
    ...extractKnowledgeStoreMetadata(data),
    ...extractEmbeddingModel(data),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEmbeddingModel(data: any) {
  const { embedding_model } = data

  const embeddingModelWrapper: {
    embeddingModel?: string;
  } = omitBy({ embeddingModel: embedding_model }, isUndefined)

  return embeddingModelWrapper;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractKnowledgeStoreMetadata(data: any) {
  let knowledgeStoreMetadataWrapper: {
    knowledgeStoreMetadata?: KnowledgeStoreMetadata;
  } = {};

  const {
    knowledge_store_metadata: knowledgeStoreMetadata
  } = data;

  if (knowledgeStoreMetadata) {
    const {
      knowledge_store: knowledgeStore, indices, s3_url: s3Url
    } = knowledgeStoreMetadata;

    knowledgeStoreMetadataWrapper = {
      knowledgeStoreMetadata: {
        knowledgeStore,
        ...omitBy({
          indices,
          s3Url
        }, isUndefined),
      }
    };
  }
  return knowledgeStoreMetadataWrapper;
}

// authFetch feedback details
export async function fetchFeedbackData(): Promise<FeedbackDetailsType[]> {
  const res = await authFetch("/v2/admin/feedback/admin/feedback");
  if (!res.ok) throw new Error("Failed to authFetch feedback details");
  const data = await res.json();
  return data;
}

export async function searchFeedbackData(
  filters: string
): Promise<FeedbackDetailsType[]> {
  const res = await authFetch(`/v2/admin/feedback/admin/feedback${filters}`);
  if (!res.ok) throw new Error("Failed to serach feedback details");
  const data = await res.json();
  return data;
}

export async function fetchUserIdsForFeedback(): Promise<string[]> {
  const res = await authFetch("/v2/admin/feedback/admin/feedback/user");
  if (!res.ok) throw new Error("Failed to authFetch user ids");
  const userIds = await res.json();
  return userIds;
}

export async function updateFeedbackDetails(feedbackData: {
  id: string;
  sql_query: string;
  user_id: string;
  conversation_id: string;
}): Promise<FeedbackDetailsType> {
  const payload: { feedback_id: string; sql_query: string; user_id: string; conversation_id: string } = {
    feedback_id: feedbackData.id,
    sql_query: feedbackData.sql_query,
    user_id: feedbackData.user_id,
    conversation_id: feedbackData.conversation_id,
  };
  const res = await authFetch(
    `/v2/admin/feedback/admin/feedback/${payload.feedback_id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error("Failed to update feedback details");
  const data = await res.json();
  if (data?.status == "error")
    throw new Error("Failed to update feedback details");
  else return data;
}

// clickable questions api
export async function uploadClickableFile({
  file,
  user_id,
}: {
  file: File;
  user_id: string;
}): Promise<ClickableQuestionsDetails> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", user_id);
  const response = await authFetch(
    `/v2/admin/clickable/clickable-questions/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  if (response.status !== 200) {
    throw new Error((await response.text()) || "File upload failed");
  }
  return response.json();
}

export async function getClickableQuestions(): Promise<
  ClickableQuestionsDetails[]
> {
  const res = await authFetch(`/v2/admin/clickable/clickable-questions`);
  if (!res.ok) throw new Error("Failed to authFetch clickable questions");
  const data = await res.json();
  if (data?.status == "error")
    throw new Error("Failed to authFetch clickable questions");
  else return data;
}

export async function updateClickableQuestions(
  payload: { PK: string; SK: string; category: string; enabled: boolean }[]
): Promise<{ updated_items: { updated_at: string }[] }> {
  const requestBody = { questions: payload };
  const response = await authFetch(
    `/v2/admin/clickable/clickable-questions/update`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );
  if (!response.ok) throw new Error("Failed to update clickable question");
  const data = await response.json();
  if (data?.status == "error")
    throw new Error("Failed to update clickable question");
  else return data;
}

export async function downloadClickableQuestions(): Promise<void> {
  const response = await authFetch(
    `/v2/admin/clickable/clickable-questions/download`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to download clickable questions");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ground_truth.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// BYOD file upload
export async function uploadByodFile({
  file,
  user_id,
}: {
  file: File;
  user_id: string;
}): Promise<{ file_url: string; filename: string, file_id: string, file_type: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", user_id);
  const response = await authFetch(`/v2/chat-manager/conversation/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload BYOD file");
  return response.json();
}

export async function getBenchmarkDetails({
  benchmark_file,
  user_id,
  agent_name,
  BYOD_file_data,
}: GetBenchmarkDetailsParams): Promise<{ accuracy: string; status: string }> { // Updated return type
  const formData = new FormData();
  formData.append("benchmark_file", benchmark_file);

  const requestObj: BenchmarkRequest = {
    user_id,
    agent_name,
  };

  if (BYOD_file_data) {
    requestObj.BYOD_data = BYOD_file_data;
  }
  formData.append("request_json", JSON.stringify(requestObj));

  const response = await authFetch(`/v2/admin/benchmark`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(errorText || "Benchmarking request failed: Invalid response from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      throw new Error("Stream ended unexpectedly without a final result.");
    }

    const chunk = decoder.decode(value);
    const events = chunk.split("\n\n").filter(Boolean);

    for (const eventString of events) {
      if (eventString.includes("event: completed")) {
        const dataLine = eventString.split("\n").find(line => line.startsWith("data:"));
        if (dataLine) {
          const jsonData = dataLine.substring(5).trim();
          return JSON.parse(jsonData);
        }
      }

      if (eventString.includes("event: error")) {
        const dataLine = eventString.split("\n").find(line => line.startsWith("data:"));
        if (dataLine) {
          const jsonData = dataLine.substring(5).trim();
          const errorPayload = JSON.parse(jsonData);
          throw new Error(errorPayload.detail || "Benchmarking failed on the server.");
        }
      }
    }
  }
}

export async function onBenchmarkingRunCall({
  benchmark_file,
  user_id,
}: {
  benchmark_file: File;
  user_id: string;
}): Promise<{ status: string }> {
  const formData = new FormData();
  formData.append("benchmark_file", benchmark_file);

  const response = await authFetch(
    `/v2/admin/benchmarking/run?user_id=${encodeURIComponent(user_id)}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok || !response.body) {
    throw new Error("Failed to get match scores: Invalid response from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      throw new Error("Stream ended unexpectedly without a result.");
    }
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n\n");
    for (const line of lines) {
      if (line.includes("event: completed")) {
        const dataString = line.split("data: ")[1];
        return JSON.parse(dataString);
      }
      if (line.includes("event: error")) {
        const dataString = line.split("data: ")[1];
        const errorData = JSON.parse(dataString);
        throw new Error(errorData.detail || "Benchmarking run failed");
      }
    }
  }
}

export function isPromptTemplateDirty({
  selectedAgentDetails,
  initialAgentDetails,
}: {
  selectedAgentDetails: AgentDetails;
  initialAgentDetails: AgentDetails;
}) {
  return selectedAgentDetails.model !== initialAgentDetails.model ||
    selectedAgentDetails.temperature !== initialAgentDetails.temperature ||
    selectedAgentDetails.prompt !== initialAgentDetails.prompt ||
    selectedAgentDetails.embeddingModel !== initialAgentDetails.embeddingModel ||
    !isEqual(selectedAgentDetails.knowledgeStoreMetadata, initialAgentDetails.knowledgeStoreMetadata)
}

export const isRagAgentType = (agentType: string) => agentType === 'RAG_Agent'

export const isRagAgent = (agent: Agent | null) => {
  if (agent && 'agent_type' in agent) {
    const { agent_type } = agent ?? {};
    return isRagAgentType((agent_type ?? '') as string);
  }
  return false
}

export const isValidS3Url = (url: string) =>
  /s3:\/\/([^/]+)\/(.*?([^/]+)\/?)$/.test(url)

export async function fetchAvailableSources(): Promise<{ sources: string[] }> {
  const res = await authFetch("/v2/chat-manager/chat/sources");
  if (!res.ok) throw new Error("Failed to fetch available sources");
  return res.json();
}