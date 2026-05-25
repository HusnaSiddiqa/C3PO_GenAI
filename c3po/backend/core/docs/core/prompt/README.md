# Prompt Module Documentation

The prompt module provides a structured approach to managing system prompts, templates, and prompt compositions across the C3PO framework. It supports dynamic prompt loading from various sources including AWS S3 storage.

## Overview

The prompt module enables centralized prompt management, version control, and template-based prompt composition. It supports both static prompt maps and dynamic prompt loading from external storage systems.

## Architecture

```
Prompt System
├── Prompt (Main orchestrator)
├── SystemPrompt (S3-based system prompts)
├── AdminPrompt (Static admin prompts)
└── StaticPromptMap (In-memory prompt storage)
```

## Components

### 1. Prompt Class

The main orchestrator class that combines system prompts, admin prompts, and templates.

#### Constructor
```python
def __init__(
    self, 
    s3_bucket: str, 
    system_prompt_prefix: str, 
    admin_prompt_name: str, 
    template_prefix: str, 
    region: str = "us-west-2"
)
```

#### Methods

**get_prompt(prompt_name, admin_prompt_version)**
- Retrieves and combines system prompt, admin prompt, and template
- Returns fully composed prompt string
- Handles version management for admin prompts

```python
def get_prompt(self, prompt_name: str, admin_prompt_version: int = 1) -> Optional[str]
```

### 2. SystemPrompt Class

Manages system prompts stored in AWS S3.

#### Features:
- S3-based prompt storage
- Automatic prompt loading and caching
- Error handling for missing prompts

### 3. AdminPrompt Class

Handles static admin prompts with version control.

#### Features:
- Version-based prompt management
- Static prompt definitions
- Fallback handling

### 4. StaticPromptMap

A comprehensive collection of predefined prompts for various agent functionalities.

#### Key Prompts:
- `revised_query_prompt`: For query revision and context enhancement
- `get_data_source`: For data source selection and field identification
- `generate_sql`: For SQL generation from natural language

## Usage Examples

### Basic Prompt Management

```python
from core.prompt.Prompt import Prompt

# Initialize prompt manager
prompt_manager = Prompt(
    s3_bucket="my-prompts-bucket",
    system_prompt_prefix="system_prompts/",
    admin_prompt_name="admin_v1",
    template_prefix="templates/main_template.txt",
    region="us-west-2"
)

# Get composed prompt
final_prompt = prompt_manager.get_prompt(
    prompt_name="nlq_agent",
    admin_prompt_version=1
)

if final_prompt:
    print(f"Composed prompt: {final_prompt}")
else:
    print("Failed to load prompt")
```

### Using StaticPromptMap

```python
from core.prompt.StaticPromptMap import prompt_map

# Access predefined prompts
query_revision_prompt = prompt_map["revised_query_prompt"]
data_source_prompt = prompt_map["get_data_source"]

# Use in agent configuration
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(
    model=llm,
    tools=tools,
    prompt=prompt_map["generate_sql"]
)
```

### Integration with Agents

```python
from core.agent.Agent import AgentBase
from core.prompt.StaticPromptMap import prompt_map
from core.prompt.Prompt import Prompt

class PromptEnabledAgent(AgentBase):
    def __init__(self, llm):
        super().__init__(llm)
        
        # Initialize prompt manager
        self.prompt_manager = Prompt(
            s3_bucket="agent-prompts",
            system_prompt_prefix="system/",
            admin_prompt_name="admin_default",
            template_prefix="templates/agent_template.txt"
        )
    
    def get_system_prompt(self, prompt_name: str):
        return self.prompt_manager.get_prompt(prompt_name)
    
    def _build_graph(self):
        # Use prompts in graph construction
        system_prompt = self.get_system_prompt("main_agent")
        
        return create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=system_prompt or prompt_map["default_agent"]
        )
```

### Dynamic Prompt Composition

```python
from core.prompt.Prompt import Prompt

class DynamicPromptManager:
    def __init__(self, config):
        self.prompt_manager = Prompt(**config)
    
    def create_contextual_prompt(self, base_prompt: str, context: dict):
        """Create a contextual prompt with dynamic content"""
        system_prompt = self.prompt_manager.get_prompt(base_prompt)
        
        if system_prompt and context:
            # Inject context into prompt
            contextual_prompt = system_prompt.format(**context)
            return contextual_prompt
        
        return system_prompt
    
    def get_versioned_prompt(self, prompt_name: str, version: int):
        """Get a specific version of a prompt"""
        return self.prompt_manager.get_prompt(
            prompt_name=prompt_name,
            admin_prompt_version=version
        )
```

## Static Prompt Examples

### Query Revision Prompt

The `revised_query_prompt` helps process user queries and add necessary context:

```python
revised_query_prompt = """
You are an assistant (Bot 1) responsible for processing user queries before passing them to another assistant (Bot 2).

**Task**:
   - Assess if the query relies on context from earlier interactions.
   - If so, provide sufficient details to Bot 2 so it can respond accurately without assuming access to previously generated files, charts, or intermediate results.

2. **Actions Based on the Assessment**:
   - **If the Query IS a Follow-up Question**:
     - Here is the query:'{query}' which you need to revise.
     - Revise the query to include all relevant context from `{message_history}`.
     - Ensure the revised query is **self-contained** and explicitly instruct Bot 2 to recreate or reprocess any data required to answer the query.
     - Do not reference previously generated files, charts, or results, as those are deleted and unavailable.
     - Output the revised query in the same JSON format: {{"revised_query": "revised_query"}}  
     - Provide only the final response in JSON format, without any explanations and assumptions about the data, just follow the context from 'message_history'.  

**Goal**: Ensure Bot 2 receives queries that are self-contained, context-rich, and actionable, enabling accurate responses without reliance on prior outputs.
"""

# Usage
from core.prompt.StaticPromptMap import prompt_map
query_prompt = prompt_map["revised_query_prompt"]
```

### Data Source Selection Prompt

The `get_data_source` prompt helps identify relevant datasets:

```python
data_source_prompt = """
You are a Data Analyst skilled in interpreting user queries only for selecting the right data sources, and identifying relevant columns without giving any explanations, return only the response in the given JSON format. 

Your Task:
a. Identify all relevant datasets based on the query.
b. If multiple datasets are needed, determine how to merge them.
c. Break the user's question into sub-tasks and specify the required columns for each step.
d. Provide the final response in JSON format, listing the source and selected fields without explanations.

Guidelines for picking up the data source: 
a. Determine the relevant data sources from:
"DataSource_Sales_867", "DataSource_Sales_DDD", "DataSource_Claims","DeckSource_Sales", "DeckSource_Claims".
b.For any query related to patient or prescriber information (such as new patients, prescribers, regimen group details, drugs prescribed per patient, etc.), always retrieve the information exclusively from the DataSource_Claims dataset.
c.STRICTLY AVOID using the 'DataSource_Claims' data unless the query specifically specifies a particular indication (e.g., TNBC, HR+/HER2-), patient data, new patient data, or prescriber data.
...
"""
```

## Prompt Template Structure

### Template Format

Templates use Python string formatting for dynamic content injection:

```python
template = """
{admin_prompt}

{system_prompt}

Additional instructions:
- Follow the guidelines above
- Maintain consistency
- Handle errors gracefully
"""

# The Prompt class automatically formats templates
final_prompt = template.format(
    admin_prompt=admin_content,
    system_prompt=system_content
)
```

### Custom Template Creation

```python
from core.util.S3Utils import S3Utils

class CustomTemplateManager:
    def __init__(self, s3_bucket: str, region: str = "us-west-2"):
        self.s3_utils = S3Utils(region)
        self.s3_bucket = s3_bucket
    
    def create_template(self, template_name: str, template_content: str):
        """Upload a new template to S3"""
        return self.s3_utils.put_object(
            bucket_name=self.s3_bucket,
            key=f"templates/{template_name}",
            data=template_content.encode('utf-8'),
            content_type="text/plain"
        )
    
    def get_template(self, template_name: str):
        """Retrieve template from S3"""
        content = self.s3_utils.get_object(
            bucket_name=self.s3_bucket,
            key=f"templates/{template_name}"
        )
        return content.decode('utf-8') if content else None
```

## Configuration Management

### Environment-Based Configuration

```python
import os
from core.prompt.Prompt import Prompt

def create_prompt_manager_from_env():
    return Prompt(
        s3_bucket=os.getenv('PROMPTS_BUCKET', 'default-prompts'),
        system_prompt_prefix=os.getenv('SYSTEM_PROMPT_PREFIX', 'system/'),
        admin_prompt_name=os.getenv('ADMIN_PROMPT_NAME', 'admin_v1'),
        template_prefix=os.getenv('TEMPLATE_PREFIX', 'templates/main.txt'),
        region=os.getenv('AWS_REGION', 'us-west-2')
    )
```

### Configuration with Secrets

```python
from core.util.ConfigLoader import get_secret, load_env_variables

def create_secure_prompt_manager():
    env = load_env_variables()
    secrets = get_secret(env['PROMPT_SECRET_NAME'])
    
    return Prompt(
        s3_bucket=secrets['PROMPTS_BUCKET'],
        system_prompt_prefix=secrets['SYSTEM_PREFIX'],
        admin_prompt_name=secrets['ADMIN_NAME'],
        template_prefix=secrets['TEMPLATE_PREFIX'],
        region=env.get('AWS_REGION', 'us-west-2')
    )
```

## Advanced Usage Patterns

### Prompt Versioning

```python
class VersionedPromptManager:
    def __init__(self, prompt_manager: Prompt):
        self.prompt_manager = prompt_manager
        self.version_cache = {}
    
    def get_prompt_version(self, prompt_name: str, version: str):
        cache_key = f"{prompt_name}:{version}"
        
        if cache_key not in self.version_cache:
            # Convert version string to admin_prompt_version
            admin_version = self._parse_version(version)
            prompt = self.prompt_manager.get_prompt(
                prompt_name=prompt_name,
                admin_prompt_version=admin_version
            )
            self.version_cache[cache_key] = prompt
        
        return self.version_cache[cache_key]
    
    def _parse_version(self, version: str) -> int:
        # Parse version string (e.g., "v1", "v2.1", "latest")
        if version == "latest":
            return 1  # Default to latest
        return int(version.replace('v', '').split('.')[0])
```

### Prompt Composition Pipeline

```python
class PromptCompositionPipeline:
    def __init__(self, prompt_manager: Prompt):
        self.prompt_manager = prompt_manager
        self.processors = []
    
    def add_processor(self, processor):
        """Add a prompt processing function"""
        self.processors.append(processor)
    
    def compose(self, prompt_name: str, context: dict = None):
        """Compose prompt through processing pipeline"""
        base_prompt = self.prompt_manager.get_prompt(prompt_name)
        
        if not base_prompt:
            return None
        
        # Apply processors
        result = base_prompt
        for processor in self.processors:
            result = processor(result, context or {})
        
        return result

# Example processors
def add_timestamp_processor(prompt: str, context: dict) -> str:
    from datetime import datetime
    timestamp = datetime.now().isoformat()
    return f"[{timestamp}] {prompt}"

def context_injection_processor(prompt: str, context: dict) -> str:
    if context:
        return prompt.format(**context)
    return prompt
```

## Error Handling and Fallbacks

### Robust Prompt Loading

```python
from core.prompt.Prompt import Prompt
from core.prompt.StaticPromptMap import prompt_map

class RobustPromptLoader:
    def __init__(self, prompt_manager: Prompt):
        self.prompt_manager = prompt_manager
        self.fallback_prompts = prompt_map
    
    def get_prompt_with_fallback(self, prompt_name: str, fallback_key: str = None):
        """Get prompt with automatic fallback to static prompts"""
        try:
            prompt = self.prompt_manager.get_prompt(prompt_name)
            if prompt:
                return prompt
        except Exception as e:
            print(f"Failed to load prompt {prompt_name}: {e}")
        
        # Fallback to static prompt
        fallback_key = fallback_key or prompt_name
        return self.fallback_prompts.get(fallback_key, "Default prompt not available")
    
    def validate_prompt(self, prompt: str) -> bool:
        """Validate prompt format and content"""
        if not prompt or len(prompt.strip()) == 0:
            return False
        
        # Add more validation rules as needed
        required_elements = ["{", "}"]  # Basic template validation
        return all(element in prompt for element in required_elements)
```

## Testing

### Unit Tests

```python
import pytest
from unittest.mock import patch, MagicMock
from core.prompt.Prompt import Prompt

@pytest.fixture
def mock_s3_utils():
    with patch('c3po_core.prompt.Prompt.S3Utils') as mock:
        yield mock

def test_prompt_composition(mock_s3_utils):
    # Mock S3 response
    mock_s3_utils.return_value.get_object.return_value = b"Test template: {admin_prompt} {system_prompt}"
    
    # Mock SystemPrompt and AdminPrompt
    with patch('c3po_core.prompt.Prompt.SystemPrompt') as mock_system, \
         patch('c3po_core.prompt.Prompt.AdminPrompt') as mock_admin:
        
        mock_system.return_value.get_system_prompt.return_value = "System content"
        mock_admin.return_value.get_admin_prompt.return_value = "Admin content"
        
        prompt_manager = Prompt("bucket", "prefix", "admin", "template")
        result = prompt_manager.get_prompt("test_prompt")
        
        assert "System content" in result
        assert "Admin content" in result

def test_static_prompt_map():
    from core.prompt.StaticPromptMap import prompt_map
    
    assert "revised_query_prompt" in prompt_map
    assert "get_data_source" in prompt_map
    assert isinstance(prompt_map["revised_query_prompt"], str)
```

### Integration Tests

```python
import pytest
from core.prompt.Prompt import Prompt

@pytest.mark.integration
def test_s3_prompt_loading():
    # This test requires actual S3 setup
    prompt_manager = Prompt(
        s3_bucket="test-prompts-bucket",
        system_prompt_prefix="test/system/",
        admin_prompt_name="test_admin",
        template_prefix="test/templates/main.txt"
    )
    
    result = prompt_manager.get_prompt("test_prompt")
    assert result is not None or result is None  # Depends on S3 content
```

## Best Practices

1. **Use Template Variables**: Design prompts with configurable parameters
2. **Version Control**: Implement proper versioning for prompt changes
3. **Fallback Strategies**: Always have fallback prompts for critical functionality
4. **Validation**: Validate prompt content before use
5. **Caching**: Cache frequently used prompts for performance
6. **Modular Design**: Break complex prompts into reusable components
7. **Testing**: Test prompts with various inputs and edge cases
8. **Documentation**: Document prompt purpose, variables, and expected outputs

## Integration with Other Modules

The prompt module integrates with:

- **Agent Module**: Provides prompts for agent initialization and execution
- **Utility Module**: Uses S3Utils for external prompt storage
- **Model Provider**: Works with LLMs to process prompts

### Example Integration

```python
from core.agent.Agent import AgentBase
from core.prompt.Prompt import Prompt
from core.prompt.StaticPromptMap import prompt_map
from core.model_provider.factory import ModelFactory

class FullyIntegratedAgent(AgentBase):
    def __init__(self):
        # Initialize components
        self.prompt_manager = Prompt(
            s3_bucket="agent-prompts",
            system_prompt_prefix="nlq/",
            admin_prompt_name="nlq_admin",
            template_prefix="templates/nlq_template.txt"
        )
        
        llm = ModelFactory.create_provider(
            provider="bedrock",
            model_name="anthropic.claude-3-sonnet-20240229"
        )
        
        super().__init__(llm=llm)
    
    def _build_graph(self):
        # Try dynamic prompt first, fallback to static
        dynamic_prompt = self.prompt_manager.get_prompt("nlq_main")
        prompt = dynamic_prompt or prompt_map["generate_sql"]
        
        return create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=prompt
        )
```

This prompt module provides a flexible and robust foundation for managing prompts across the entire C3PO framework, supporting both static and dynamic prompt management strategies.

# Get onboarding information
onboarding = PromptManager.get_onboarding("user_guide")

# Using prompts in an agent
def _build_graph(self):
    main_agent = create_react_agent(
        model=self.llm,
        tools=[self.tools],
        prompt=sql_prompt.get_prompt(),  # This gets the latest versioned prompt
        response_format=(FORMAT_INSTRUCTION, ResponseFormat)
    )
    return main_agent
```

## Prompt Management

### 1. Version Control with MLflow
```python
# Example of how prompts are versioned
class SystemPrompt:
    def get_prompt(self) -> str:
        # Get base prompt from S3
        base_prompt = self._load_from_s3()
        
        # Get latest version from MLflow
        version = self._get_mlflow_version()
        
        # Combine and return final prompt
        return self._format_prompt(base_prompt, version)
```

### 2. S3 Storage Integration
```python
class PromptManager:
    @staticmethod
    def _fetch_from_s3(path: str) -> str:
        s3_utils = S3Utils(
            bucket_name=config.PROMPT_BUCKET,
            aws_access_key=config.AWS_ACCESS_KEY,
            aws_secret_key=config.AWS_SECRET_KEY
        )
        return s3_utils.read_file(path)
```

### 3. MLflow Version Management
```python
class MLflowClient:
    def get_latest_version(self, name: str) -> str:
        # Fetch latest version from MLflow
        return mlflow.get_latest_version(name)

    def log_prompt(self, name: str, content: str):
        # Log new prompt version to MLflow
        mlflow.log_artifact(name, content)
```

## Best Practices

1. Prompt Storage
   - Store base prompts in S3 for centralized management
   - Use structured paths for different prompt types
   - Maintain clear versioning through MLflow

2. Version Management
   - Track all prompt changes in MLflow
   - Include metadata with each version
   - Document version changes and improvements

3. Access Patterns
   - Always use PromptManager for accessing prompts
   - Cache frequently used prompts
   - Handle version updates gracefully

## Error Handling

```python
class PromptManager:
    @staticmethod
    def get_prompt(name: str) -> SystemPrompt:
        try:
            prompt = SystemPrompt(name)
            return prompt.get_prompt()
        except S3Error:
            logger.error(f"Failed to fetch prompt {name} from S3")
            raise
        except MLflowError:
            logger.error(f"Failed to get version for prompt {name}")
            raise
```

## Prompt Updates

1. Adding New Prompts
```python
# Upload to S3
s3_utils.upload_file("local_prompt.json", "prompts/system/new_prompt.json")

# Register with MLflow
mlflow_client.log_prompt("new_prompt", content)
```

2. Updating Existing Prompts
```python
# Update in S3
s3_utils.upload_file("updated_prompt.json", "prompts/system/existing_prompt.json")

# Log new version in MLflow
mlflow_client.log_prompt("existing_prompt", new_content)
```

## Performance Considerations

1. Caching
   - Implement caching for frequently used prompts
   - Cache MLflow versions with appropriate TTL
   - Use S3 read-through caching

2. Batch Operations
   - Group related prompt updates
   - Use bulk operations when possible
   - Implement version update notifications

3. Error Recovery
   - Implement fallback mechanisms
   - Cache last known good versions
   - Provide offline capabilities

## Prompt Types

### 1. System Prompts
- Base prompts that define agent behavior
- Include role definitions and basic instructions
- Example from NLQ Agent:
```python
system_prompt = """
You are an AI assistant specialized in converting natural language queries to SQL.
Your task is to understand the user's question and generate appropriate SQL code.
"""
```

### 2. Task-Specific Prompts
- Specialized prompts for specific tasks
- Include detailed instructions and examples
- Example from SQL generation:
```python
sql_prompt = """
Given the following question: {question}
Generate SQL code that will answer this question.
Consider the following schema: {schema}
"""
```

## Prompt Structure

A well-structured prompt should include:
- Clear role definition
- Task description
- Input context
- Output format requirements
- Examples (when needed)
- Error handling instructions

## Template Variables

Common template variables used in prompts:
- `{context}`: Current conversation context
- `{task_description}`: Specific task details
- `{format_instructions}`: Required output format
- `{examples}`: Example inputs and outputs
- `{constraints}`: Any limitations or requirements

## Error Handling

Include error handling instructions in prompts:
```python
error_handling_prompt = """
If you encounter any of the following issues:
1. Incomplete information
2. Invalid input format
3. Unsupported operations

Respond with:
{error_format}
"""
```

# PromptStore — MLflow-based Prompt Versioning for Agents

PromptStore is a lightweight, pluggable module for managing versioned prompt templates using MLflow. Designed for LLM-based agent systems (like C3PO), it enables structured prompt storage, retrieval, and auditability across multiple prompt types (e.g., `AdminPrompt`, `SystemPrompt`, `NLQ_Agent`).

---

## Features

- Auto-incremented version aliases (`v1`, `v2`, ...)
- Timestamp-based internal versioning
- Per-prompt-type experiment isolation via Databricks MLflow
- Supports loading latest or specific versioned prompts
- Easily list all available versions for a prompt type
- Compatible with Databricks-hosted MLflow

---

Note: Each prompt type is mapped to a dedicated MLflow experiment

Each run in the experiment is a versioned prompt with:
- `version`: Timestamp
- `version_alias`: incremented (`v1`, `v2`, …)
- `artifact`: stored `.txt` prompt content

---
##  Setup

You must set these before using PromptStore (for external apps like those on EKS):

- export DATABRICKS_HOST=https://<your-databricks-workspace>
- export DATABRICKS_TOKEN=<your-personal-access-token>

## Usage

### 1. Initialize the Store
```python
from PromptStore import PromptStore

store = PromptStore("NLQ_Agent", "us-dev-iidd-genai/agents")
```
### 2. Store a New Prompt
```python
version = store.store_prompt("This is a versioned NLQ prompt.", "Claude 3.5", "7")
print("Saved as:", version)
```
### 3. Load Latest or Specific Version
```python
latest = store.load_prompt()
v2 = store.load_prompt(version_alias="v2")
print(v2)
```

```json
{
  "prompt": "This is a versioned NLQ prompt.",
  "model": "Claude 3.5",
  "temperature": "7"
}
```
### 4. List Available Versions
```python
print(store.list_versions())  # → ['v1', 'v2', 'v3']
```
