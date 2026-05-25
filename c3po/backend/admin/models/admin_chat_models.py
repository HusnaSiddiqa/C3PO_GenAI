from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_serializer
from pydantic_extra_types.s3 import S3Path


class OnboardingResponse(BaseModel):
    onboarding_id: str
    agent_name: str
    agent_description: str
    updated_by: str
    updated_at: str


class OnboardingUpdateRequest(BaseModel):
    onboarding_id: str = None
    agent_name: str
    agent_description: str
    updated_by: str


class InstructionsResponse(BaseModel):
    instruction_id: str
    category: str
    description: str
    updated_by: str
    updated_at: str


class InstructionsUpdateRequest(BaseModel):
    instruction_id: str
    category: str
    description: str
    updated_by: str


class AgentListItem(BaseModel):
    id: str
    name: str

class SubAgentListItem(BaseModel):
    id: str
    name: str
    agent_type: str
    description: str
    relates_to: List[str]

class SubAgentsListResponse(BaseModel):
    sub_agents: List[SubAgentListItem]

class AgentsListResponse(BaseModel):
    agents: List[AgentListItem]


class KnowledgeStore(BaseModel):
    id: str
    name: str


class KnowledgeStoresResponse(BaseModel):
    knowledge_stores: List[KnowledgeStore]


class EmbeddingModel(BaseModel):
    id: str
    name: str


class EmbeddingModelsResponse(BaseModel):
    embedding_models: List[EmbeddingModel]


class OpenSearchMetadata(BaseModel):
    knowledge_store: Literal["open_search"] = "open_search"
    indices: List[str] = Field(min_length=1)


class OpenSearchMetadataWithSerialization(BaseModel):
    knowledge_store: Literal["open_search"] = "open_search"
    indices: List[str] = Field(min_length=1)
    
    @field_serializer('indices')
    def join_indices(self, indices: List[str]):
        return ",".join(indices)


class BedrockMetadata(BaseModel):
    knowledge_store: Literal["bedrock"] = "bedrock"
    s3_url: S3Path

KnowledgeStoreMetadataWithSerialization = \
    Union[OpenSearchMetadataWithSerialization, BedrockMetadata]

KnowledgeStoreMetadata = Union[OpenSearchMetadata, BedrockMetadata]

class CreatePromptRequest(BaseModel):
    agent_id: str
    prompt: str
    model: str
    temperature: str
    user_id: str
    benchmark_file: Optional[str] = None
    accuracy: Optional[float] = None
    knowledge_store_metadata: Optional[KnowledgeStoreMetadataWithSerialization] = \
        Field(discriminator="knowledge_store", default=None)
    embedding_model: Optional[str] = None


class CreateSubAgentRequest(BaseModel):
    agent_name: str
    agent_description: str
    agent_type: str
    relates_to: List[str]
    prompt: str
    model: str
    temperature: str
    user_id: str
    benchmark_file: Optional[str] = None
    accuracy: Optional[float] = None
    knowledge_store_metadata: Optional[KnowledgeStoreMetadata] = \
        Field(discriminator="knowledge_store", default=None)
    embedding_model: Optional[str] = None


class SerializedOpenSearchMetadata(BaseModel):
    knowledge_store: Literal["open_search"] = "open_search"
    indices: str
    
    @field_serializer('indices')
    def parse_indices(self, indices: str):
        return indices.split(',')


SerializedKnowledgeStoreMetadata = Union[SerializedOpenSearchMetadata, BedrockMetadata]


class CreatePromptResponse(BaseModel):
    agent_id: str
    agent_name: str
    version_alias: str
    prompt: str
    model: str
    temperature: str
    benchmark_file: Optional[str] = None
    accuracy: Optional[float] = None
    knowledge_store_metadata: Optional[SerializedKnowledgeStoreMetadata] = \
        Field(discriminator="knowledge_store", default=None)
    embedding_model: Optional[str] = None


class DeletePromptResponse(BaseModel):
    success: bool
    agent_id: str
    message: str
    agent_name: str


class GetPromptResponse(BaseModel):
    agent: str
    version_alias: str
    prompt: str
    model: str
    temperature: str
    knowledge_store_metadata: Optional[SerializedKnowledgeStoreMetadata] = \
        Field(discriminator="knowledge_store", default=None)
    embedding_model: Optional[str] = None


class LatestPromptResponse(BaseModel):
    agent_id: str
    version_alias: str
    prompt: str
    model: str
    temperature: str
    versions: List[str]
    knowledge_store_metadata: Optional[SerializedKnowledgeStoreMetadata] = \
        Field(discriminator="knowledge_store", default=None)
    embedding_model: Optional[str] = None
