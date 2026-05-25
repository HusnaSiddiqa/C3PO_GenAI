# Precanned Deck Refresh Agent

The Precanned Deck Refresh Agent is a specialized agent that automatically refreshes the content of PowerPoint presentations by interpreting natural language queries and triggering appropriate Databricks jobs to generate updated decks.

## Overview

This agent provides the capability to:
- Interpret natural language requests for deck generation/refresh
- Identify and trigger appropriate Databricks jobs for deck creation
- Manage the lifecycle of deck generation processes
- Provide real-time status updates on deck generation progress

## Environment Variables

The following environment variables are required for the agent to function properly:

### Required Variables
- `PROVIDER`: Model provider (e.g., "mosaic")
- `MODEL`: Model name for LLM operations
- `MODEL_BASE_URL`: Base URL for the model API
- `SECRET_NAME`: AWS Secrets Manager secret name containing API tokens
- `DATABRICKS_SERVER_HOSTNAME`: Databricks workspace hostname
- `DATABRICKS_TOKEN`: Databricks personal access token
- `WORKSPACE_NAME`: Name of the workspace
- `WORKSPACE_BUCKET_NAME`: S3 bucket name for workspace storage
- `SERVICE_TYPE`: Should be set to "precanned_deck"

## Running the Agent

To start the Precanned Deck Refresh Agent:

```bash
python deck_refresh_agent.py
```

By default, the agent starts on port 8000 and serves at the endpoint `/v2/agents/precanned_deck`.

## Deployment and Service Configuration

### Helm Chart Configuration

The agent is deployed using Helm charts with environment-specific values:

- **Development**: Uses [`values_dev.yaml`](../../../helm/values/values_dev.yaml)
- **Testing**: Uses `values_tst.yaml`
- **Production**: Uses `values_prd.yaml`

### Service Access

The Helm chart exposes the agent as a Kubernetes service that can be accessed internally within the EKS cluster:

```
http://commercial-us-sbx-iidd-genai-precanned-deck:8001/v2/agents/precanned_deck
```

The external port (8001) is configured via the `AGENT_BASE_PORT` setting in the values.yaml files, while the agent internally runs on port 8000.

### Ingress Configuration

The agent is accessible externally via the ingress path:
```
/v2/agents/precanned_deck
```

Health checks are configured at:
```
/v2/agents/precanned_deck/v2/agents/precanned_deck/.well-known/agent.json
```

## Agent Configuration

### System Prompts

The agent's behavior is controlled by a system prompt stored in S3:

**Location**: `s3://{WORKSPACE_BUCKET_NAME}/system_prompts/precanned_deck_agent_prompt.txt`

**Important Notes**:
- System prompts are loaded during deployment time only
- Any changes to the prompt must be uploaded to the S3 location
- The agent will use the prompt to format responses and guide interaction behavior

### Databricks Jobs Configuration

The agent maintains a list of available Databricks jobs that can generate precanned PowerPoint decks. This configuration is managed by the application administrator.

#### Configuration File Location

The job list configuration file location is defined in [`constants.py`](../../../utils/constants.py):

```python
PRECANNED_JOB_FILE = "precanned_deck_agent/job_list.json"
```

#### Job List Format

The configuration file should follow this JSON structure:

```json
{
  "job_list": [
    {"job_name": "c3po_claims_deck_refresh"},
    {"job_name": "c3po_sales_deck_refresh"}
  ]
}
```

#### Databricks Job Requirements

When creating Databricks jobs for deck generation, ensure they meet these requirements:

1. **Parameter Configuration**: Each job must include a parameter named `output_folder` that accepts an S3 path where the generated deck should be saved.

2. **Output Format**: Jobs should generate PowerPoint files named `deck.pptx` in the specified output folder.

3. **Job Naming**: Use descriptive names that clearly indicate the purpose and type of deck being generated.

#### Adding New Jobs

To add new Databricks jobs for deck generation:

1. Create the Databricks job with the required `output_folder` parameter
2. Update the job list configuration file in S3
3. Ensure the job name in the configuration matches exactly with the Databricks job name
4. The agent will automatically discover new jobs from the updated configuration

## Agent Capabilities

### Available Tools

The agent has access to two primary tools:

1. **Job List Tool** ([`get_list_of_jobs`](databricks_job_tool.py)): Retrieves available Databricks jobs for deck generation
2. **Job Trigger Tool** ([`trigger_deck_job`](databricks_job_tool.py)): Triggers specific jobs and monitors their execution

### Response Format

The agent returns structured responses in the following format:

```python
{
    "message": "Status message about the operation",
    "file_url": "S3 path to the generated deck"
}
```

## Integration with Other Components

### Memory Store

The agent uses [`MemoryStore`](../../core/memory/memory_store.py) to persist conversation history and state across interactions.

### Model Provider

LLM operations are handled through the [`ModelFactory`](../../core/model_provider/factory.py) for consistent model management.

### Agent Framework

Built on the [`AgentBase`](../../core/agent/Agent.py) framework with [`ConversationState`](../../core/agent/ConversationState.py) for state management.

## Monitoring and Debugging

### Logging

The agent includes comprehensive logging for:
- Job discovery and selection
- Job execution status
- Error conditions and recovery
- User interaction tracking

### Health Checks

Kubernetes health checks are configured to monitor agent availability and responsiveness.

## Security Considerations

- All API tokens are managed through AWS Secrets Manager
- S3 access is controlled via IAM roles and policies
- Databricks authentication uses secure token-based access
- Internal service communication within the EKS cluster uses service mesh security