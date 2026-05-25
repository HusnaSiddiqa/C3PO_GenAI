export type Instruction = {
  instructionId: string;
  category: InstructionCategory;
  description: string;
  updatedBy: string;
  updatedAt: string;
};

export type InstructionFormState = {
  generalInstructions: Instruction;
  businessRules: Instruction;
  dataHandlingRules: Instruction;
};

export type OnboardingDetails = {
  onboardingId: string;
  agentName: string;
  agentDescription: string;
  updatedAt: string;
  updatedBy: string;
};

export type SyncMetadataResponse = {
  status: "success" | "error";
  message: string;
  details: {
    databricksTablesSynced?: number;
    glueTablesSynced?: number;
    databricksColumnsSynced?: number;
    glueColumnsSynced?: number;
    totalTablesProcessed?: number;
    totalColumnsProcessed?: number;
    errors?: number;
    durationSeconds?: number;
    timestamp: string;
  };
};

export type SchemaTable = {
  name: string;
};

export type SchemaDatabase = {
  name: string;
  catalog: string;
  tables: SchemaTable[];
};

export type SchemaDatasource = {
  datasource: string;
  databases: SchemaDatabase[];
};

export interface TableMetadata {
  pk: string;
  sk: string;
  itemType: string;
  datasource: string;
  catalog: string;
  dbName: string;
  tableName: string;
  columnName: string;
  columnType: string;
  status: MetadataStatus;
  metadataDescription: string;
  metadataType: string;
  syncTimestamp: string;
  updatedAt: string;
}

export type TableMetadataRow = {
  id: string;
  tableName: string;
  columnName: string;
  columnType: string;
  metadataType: string;
  metadataDescription: string;
  status: MetadataStatus;
  updatedAt: string;
};

export type MetadataStatus = "added" | "active" | "deleted";

// Payload type sent from FE to BE
export interface UpdateTableMetadataPayload {
  dbName: string;
  tableName: string;
  columnName?: string;
  metadataDescription?: string;
  metadataType?: string;
  datasource: string;
  catalog: string;
}

// Response type returned from BE
export interface UpdateTableMetadataResponse {
  status: MetadataStatus;
  details?: {
    pk: string;
    sk: string;
    updatedFields?: {
      metadataDescription?: string;
      metadataType?: string;
      updatedAt: string;
    };
    error?: string;
  };
}

export type KnowledgeStoreMetadata = {
  knowledgeStore: string | null;
  s3Url?: string;
  indices?: string[];
}

export type ServerKnowledgeStoreMetadata = {
  knowledge_store: string;
  s3_url?: string;
  indices?: string[];
}

export interface KnowledgeStore {
  id: string;
  name: string;
}

export interface KnowledgeStoresResponse {
  knowledge_stores: KnowledgeStore[]
}

export interface EmbeddingModel {
  id: string;
  name: string;
}

export interface EmbeddingModelsResponse {
  embedding_models: EmbeddingModel[]
}

export interface Agent {
  id: string;
  name: string;
}

export interface SubAgent extends Agent {
  agent_type: string;
  description: string;
  relates_to: string[];
}

export interface AgentsResponse {
  agents: Agent[];
}

export interface SubAgentsResponse {
  sub_agents: SubAgent[];
}

export interface AgentVersionDetailsResponse {
  agentId: string;
  versionAlias: string;
  prompt: string;
  model: string;
  temperature: string;
  versions: string[];
}
export type AgentPromptDetails = {
  agent: string;
  versionAlias: string;
  prompt: string;
  model: string;
  temperature: string;
  knowledgeStoreMetadata?: KnowledgeStoreMetadata;
  embeddingModel?: string;
};

export interface SaveAgentPromptRequest {
  agentId: string;
  prompt: string;
  model: string;
  temperature: string;
  user_id: string;
  benchmarkFile?: string;
  accuracy?: number;
  knowledgeStoreMetadata?: KnowledgeStoreMetadata;
  embeddingModel?: string;
}

export interface CreateSubAgentRequest {
  agent_name: string;
  agent_description: string;
  agent_type: string;
  relates_to: string[];
  prompt: string;
  model: string;
  temperature: string;
  user_id: string;
  benchmark_file?: string;
  accuracy?: number;
  knowledge_store_metadata?: ServerKnowledgeStoreMetadata;
  embedding_model?: string;
}

export interface DeletePromptResponse {
  success: boolean;
  agent_id: string;
  message: string;
  agent_name: string;
}

export interface SaveAgentPromptResponse {
  agentId: string;
  versionAlias: string;
  prompt: string;
  model: string;
  temperature: string;
  benchmarkFile: string;
  accuracy: number;
  knowledgeStoreMetadata?: KnowledgeStoreMetadata;
  embeddingModel?: string;
}

export type InstructionCategory =
  | "general_instructions"
  | "business_rules"
  | "data_handling_rules";

export type ConfigData = {
    admin_ad_group: string;
    admin_secret: string;
    app_default_user_id: string;
    app_title: string;
    chat_mgr_secret: string;
    okta_auth_url: string;
    okta_client_id: string;
    okta_redirect_uri: string;
    support_email: string;
    enable_source_selector: string;
};

export type FeedbackDetailsType = {
  rating: string;
  user_id: string;
  Agent: string;
  prompt: string;
  response: string;
  feedback: string;
  date: string;
  sql_query: string;
  id: string;
};

export type ClickableQuestionsDetails = {
  PK: string,
  SK: string,
  question_id: string,
  question: string,
  expected_sql: string,
  expected_answer: string,
  enabled: boolean,
  category: string,
  agent_type: string | null,
  scorer?: boolean | null | undefined;
}

export type FeedbackSearchFilter = {
  search: string;
  user_id: string;
  rating: string;
  date_from: string;
  date_to: string;
};

export type AgentDetails = {
  model: string;
  temperature: string;
  versionAlias: string;
  prompt: string;
  versions: string[];
  knowledgeStoreMetadata?: KnowledgeStoreMetadata;
  embeddingModel?: string;
};

export type BYODFileData = {
  file_url: string;
  filename: string;
  file_id: string;
  file_type: string;
};

export type BenchmarkRequest = {
  user_id: string;
  agent_name?: string;
  BYOD_data?: BYODFileData;
};

export type GetBenchmarkDetailsParams = {
  benchmark_file: File;
  user_id: string;
  agent_name?: string;
  BYOD_file_data?: BYODFileData | null;
};
