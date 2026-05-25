# Model Provider Module Documentation

The model provider module provides a unified interface for working with different Language Model providers. It abstracts the complexity of different LLM APIs and provides a consistent interface for agent development.

## Overview

The model provider module supports multiple LLM providers through a factory pattern, allowing easy switching between different providers while maintaining the same interface. Currently supported providers include AWS Bedrock and Mosaic AI.

## Architecture

```
ModelFactory
├── BedrockProvider → ChatBedrock
└── MosaicProvider → ChatOpenAI
```

## Components

### 1. ModelFactory

The main factory class that creates appropriate provider instances based on configuration.

#### Static Methods

**create_provider(provider, model_name, api_key, region, base_url)**
- Creates and returns a language model instance
- Automatically selects the appropriate provider
- Handles provider-specific configuration

```python
@staticmethod
def create_provider(
    provider: str,
    model_name: str,
    api_key: Optional[str] = None,
    region: str = "us-east-1",
    base_url: str = "https://api.mosaic.ai/v1"
) -> BaseChatModel
```

### 2. BedrockProvider

Provider for AWS Bedrock language models.

#### Features:
- Integration with AWS Bedrock service
- Support for Claude, Titan, and other Bedrock models
- AWS credential management
- Regional deployment support

#### Constructor
```python
def __init__(
    self,
    model_name: str = "anthropic.claude-3-sonnet-20240229",
    region: str = "us-west-2",
    **kwargs: Any,
)
```

#### Methods
**get_llm() -> ChatBedrock**
- Returns configured ChatBedrock instance
- Handles AWS authentication automatically

### 3. MosaicProvider

Provider for Mosaic AI language models (OpenAI-compatible API).

#### Features:
- OpenAI-compatible API integration
- Custom base URL support
- API key authentication
- Support for various model configurations

#### Constructor
```python
def __init__(
    self,
    model_name: str,
    api_key: str,
    base_url: str,
    **kwargs: Any,
)
```

#### Methods
**get_llm() -> ChatOpenAI**
- Returns configured ChatOpenAI instance
- Handles API authentication and configuration

## Usage Examples

### Basic Usage with Factory

```python
from core.model_provider.factory import ModelFactory

# Using AWS Bedrock
bedrock_llm = ModelFactory.create_provider(
    provider="bedrock",
    model_name="anthropic.claude-3-sonnet-20240229",
    region="us-west-2"
)

# Using Mosaic AI
mosaic_llm = ModelFactory.create_provider(
    provider="mosaic",
    model_name="gpt-4",
    api_key="your-api-key",
    base_url="https://api.mosaic.ai/v1"
)
```

### Direct Provider Usage

```python
from core.model_provider.bedrock_provider import BedrockProvider
from core.model_provider.mosaic_provider import MosaicProvider

# Direct Bedrock usage
bedrock_provider = BedrockProvider(
    model_name="anthropic.claude-3-haiku-20240307",
    region="us-east-1"
)
bedrock_llm = bedrock_provider.get_llm()

# Direct Mosaic usage
mosaic_provider = MosaicProvider(
    model_name="mixtral-8x7b-instruct",
    api_key="your-api-key",
    base_url="https://api.mosaic.ai/v1"
)
mosaic_llm = mosaic_provider.get_llm()
```

### Integration with Agents

```python
from core.agent.Agent import AgentBase
from core.model_provider.factory import ModelFactory
from core.util.ConfigLoader import load_env_variables, get_secret

class ConfigurableAgent(AgentBase):
    def __init__(self):
        # Load configuration
        env = load_env_variables()
        provider = env['PROVIDER']
        model = env['MODEL']
        
        # Create LLM based on configuration
        if provider.lower() == "bedrock":
            llm = ModelFactory.create_provider(
                provider=provider,
                model_name=model,
                region=env.get('AWS_REGION', 'us-west-2')
            )
        elif provider.lower() == "mosaic":
            api_key = get_secret(env['SECRET_NAME'])['API_KEY']
            llm = ModelFactory.create_provider(
                provider=provider,
                model_name=model,
                api_key=api_key,
                base_url=env.get('MODEL_BASE_URL', 'https://api.mosaic.ai/v1')
            )
        
        super().__init__(llm=llm)
```

### Advanced Configuration

```python
from core.model_provider.factory import ModelFactory

# Bedrock with custom parameters
bedrock_llm = ModelFactory.create_provider(
    provider="bedrock",
    model_name="anthropic.claude-3-sonnet-20240229",
    region="us-west-2",
    # Additional kwargs passed to ChatBedrock
    temperature=0.7,
    max_tokens=1000,
    top_p=0.9
)

# Mosaic with custom parameters
mosaic_llm = ModelFactory.create_provider(
    provider="mosaic",
    model_name="gpt-4-turbo",
    api_key="your-api-key",
    base_url="https://api.mosaic.ai/v1",
    # Additional kwargs passed to ChatOpenAI
    temperature=0.5,
    max_tokens=2000,
    timeout=30
)
```

## Supported Models

### AWS Bedrock Models

```python
# Claude Models
claude_3_opus = "anthropic.claude-3-opus-20240229"
claude_3_sonnet = "anthropic.claude-3-sonnet-20240229"
claude_3_haiku = "anthropic.claude-3-haiku-20240307"

# Titan Models
titan_text = "amazon.titan-text-express-v1"
titan_embed = "amazon.titan-embed-text-v1"

# Example usage
llm = ModelFactory.create_provider(
    provider="bedrock",
    model_name=claude_3_opus,
    region="us-west-2"
)
```

### Mosaic AI Models

```python
# OpenAI Models
gpt_4 = "gpt-4"
gpt_4_turbo = "gpt-4-turbo"
gpt_3_5_turbo = "gpt-3.5-turbo"

# Open Source Models
mixtral = "mixtral-8x7b-instruct"
llama2 = "llama2-70b-chat"

# Example usage
llm = ModelFactory.create_provider(
    provider="mosaic",
    model_name=mixtral,
    api_key="your-api-key",
    base_url="https://api.mosaic.ai/v1"
)
```

## Configuration Management

### Environment Variables

```bash
# Provider Configuration
PROVIDER=bedrock  # or mosaic
MODEL=anthropic.claude-3-sonnet-20240229
AWS_REGION=us-west-2

# Mosaic Configuration
MODEL_BASE_URL=https://api.mosaic.ai/v1
SECRET_NAME=mosaic-api-keys

# AWS Configuration (for Bedrock)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### Configuration from Secrets

```python
from core.util.ConfigLoader import get_secret, load_env_variables

def create_llm_from_config():
    env = load_env_variables()
    provider = env['PROVIDER']
    model = env['MODEL']
    
    if provider.lower() == "mosaic":
        # Get API key from AWS Secrets Manager
        secrets = get_secret(env['SECRET_NAME'])
        api_key = secrets['MOSAIC_API_KEY']
        
        return ModelFactory.create_provider(
            provider=provider,
            model_name=model,
            api_key=api_key,
            base_url=env['MODEL_BASE_URL']
        )
    elif provider.lower() == "bedrock":
        return ModelFactory.create_provider(
            provider=provider,
            model_name=model,
            region=env.get('AWS_REGION', 'us-west-2')
        )
```

## Error Handling

### Common Error Scenarios

```python
from core.model_provider.factory import ModelFactory

def safe_model_creation(provider, model_name, **kwargs):
    try:
        return ModelFactory.create_provider(
            provider=provider,
            model_name=model_name,
            **kwargs
        )
    except ValueError as e:
        print(f"Invalid provider configuration: {e}")
        # Fallback to default provider
        return ModelFactory.create_provider(
            provider="bedrock",
            model_name="anthropic.claude-3-haiku-20240307"
        )
    except Exception as e:
        print(f"Model creation failed: {e}")
        raise
```

### Provider-Specific Error Handling

```python
from botocore.exceptions import NoCredentialsError, ClientError

def create_bedrock_with_error_handling():
    try:
        return ModelFactory.create_provider(
            provider="bedrock",
            model_name="anthropic.claude-3-sonnet-20240229"
        )
    except NoCredentialsError:
        print("AWS credentials not found")
        raise
    except ClientError as e:
        if e.response['Error']['Code'] == 'ValidationException':
            print("Invalid model name or region")
        raise
```

## Testing

### Unit Tests

```python
import pytest
from unittest.mock import patch, MagicMock
from core.model_provider.factory import ModelFactory

def test_bedrock_provider_creation():
    with patch('c3po_core.model_provider.bedrock_provider.ChatBedrock') as mock_bedrock:
        mock_instance = MagicMock()
        mock_bedrock.return_value = mock_instance
        
        provider = ModelFactory.create_provider(
            provider="bedrock",
            model_name="test-model"
        )
        
        assert provider is not None
        mock_bedrock.assert_called_once()

def test_mosaic_provider_creation():
    with patch('c3po_core.model_provider.mosaic_provider.ChatOpenAI') as mock_openai:
        mock_instance = MagicMock()
        mock_openai.return_value = mock_instance
        
        provider = ModelFactory.create_provider(
            provider="mosaic",
            model_name="test-model",
            api_key="test-key"
        )
        
        assert provider is not None
        mock_openai.assert_called_once()

def test_unknown_provider():
    with pytest.raises(ValueError, match="Unknown provider"):
        ModelFactory.create_provider(
            provider="unknown",
            model_name="test-model"
        )
```

### Integration Tests

```python
import pytest
from core.model_provider.factory import ModelFactory

@pytest.mark.integration
def test_bedrock_integration():
    # This test requires AWS credentials
    llm = ModelFactory.create_provider(
        provider="bedrock",
        model_name="anthropic.claude-3-haiku-20240307",
        region="us-west-2"
    )
    
    # Test basic functionality
    response = llm.invoke("Hello, world!")
    assert response is not None
    assert len(response.content) > 0

@pytest.mark.integration
def test_mosaic_integration():
    # This test requires Mosaic API key
    llm = ModelFactory.create_provider(
        provider="mosaic",
        model_name="gpt-3.5-turbo",
        api_key="test-api-key",
        base_url="https://api.mosaic.ai/v1"
    )
    
    # Test basic functionality
    response = llm.invoke("Hello, world!")
    assert response is not None
    assert len(response.content) > 0
```

## Best Practices

1. **Use the Factory Pattern**: Always use `ModelFactory.create_provider()` for consistency
2. **Handle Missing API Keys**: Implement proper error handling for missing credentials
3. **Configuration Management**: Use environment variables and secrets management
4. **Model Selection**: Choose appropriate models based on use case requirements
5. **Error Handling**: Implement comprehensive error handling for network and API issues
6. **Resource Management**: Consider connection pooling and rate limiting
7. **Testing**: Use mocking for unit tests and integration tests for real provider testing

## Performance Considerations

1. **Model Size**: Larger models provide better quality but slower response times
2. **Regional Deployment**: Choose regions close to your users for lower latency
3. **Caching**: Consider implementing response caching for repeated queries
4. **Batch Processing**: Use batch operations when available for better throughput
5. **Connection Reuse**: Reuse provider instances to avoid initialization overhead

## Integration with Other Modules

The model provider module integrates with:

- **Agent Module**: Provides LLMs for agent initialization
- **Utility Module**: Uses configuration loading and secrets management
- **Prompt Module**: Works with prompts to generate responses

### Example Integration

```python
from core.agent.Agent import AgentBase
from core.model_provider.factory import ModelFactory
from core.prompt.StaticPromptMap import prompt_map
from core.util.ConfigLoader import load_env_variables

class IntegratedAgent(AgentBase):
    def __init__(self):
        # Load configuration
        env = load_env_variables()
        
        # Create LLM
        self.llm = ModelFactory.create_provider(
            provider=env['PROVIDER'],
            model_name=env['MODEL'],
            api_key=env.get('API_KEY'),
            region=env.get('AWS_REGION', 'us-west-2')
        )
        
        super().__init__(llm=self.llm)
    
    def _build_graph(self):
        # Use prompts with the LLM
        return create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=prompt_map["agent_prompt"]
        )
```

This model provider module enables flexible and consistent LLM integration across the entire C3PO framework.

# Initialize a model provider
provider = "bedrock"  # or "mosaic"
model_name = "your_model_name"
base_url = "your_base_url"
api_key = "your_api_key"

# Create provider instance
llm_provider = ModelFactory.create_provider(
    provider=provider,
    model_name=model_name,
    base_url=base_url,
    api_key=api_key
)

# Get LLM instance
llm = llm_provider.get_llm()

# Use LLM in your application
response = llm.predict("Your prompt here")
```

## Provider Configuration

### Bedrock Provider
```python
# Example configuration for Bedrock
provider = "bedrock"
model_name = "anthropic.claude-v2"
```

### Mosaic Provider
```python
# Example configuration for Mosaic
provider = "mosaic"
model_name = "mpt-7b-instruct"
base_url = "your_mosaic_endpoint"
```

## Best Practices

1. Use environment variables for sensitive configuration
2. Always use the ModelFactory for provider creation
3. Handle provider-specific exceptions appropriately
4. Cache LLM instances when possible
5. Use appropriate model configurations for your use case

## Error Handling

The module provides consistent error handling across providers:

```python
try:
    llm_provider = ModelFactory.create_provider(...)
    llm = llm_provider.get_llm()
except ProviderNotFoundError:
    # Handle unknown provider
except InvalidConfigurationError:
    # Handle invalid configuration
except ConnectionError:
    # Handle connection issues
```

## Provider Features

Each provider implementation includes:
- Authentication handling
- Model configuration
- Response formatting
- Error handling
- Rate limiting (where applicable)
- Streaming support 