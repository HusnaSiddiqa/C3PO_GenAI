# Memory Module Documentation

The memory module provides persistent storage capabilities for agent conversations and state management using AWS S3 as the backend storage system.

## Overview

The memory module enables agents to maintain conversation history and context across multiple interactions. It uses AWS S3 for durable storage and provides a simple interface for storing and retrieving agent memory.

### User-Centric Memory Management

The memory system is designed with user-specific isolation, meaning each user's conversation data is stored separately. This provides:

- **Privacy Isolation**: Each user's memory is kept separate from others
- **Personalized Context**: Agents can maintain user-specific conversation history
- **Multi-tenant Support**: Multiple users can interact with the same agent without data mixing
- **Scalable Architecture**: Memory is organized hierarchically with user identification

Key benefits:
- User conversations remain private and isolated
- Agents can provide personalized responses based on user history
- System can scale to support multiple concurrent users
- Memory cleanup and management can be done per user

## Components

### MemoryStore Class

The `MemoryStore` class is the main component that handles memory operations for agents.

#### Key Features:
- AWS S3-based persistent storage
- Conversation-specific memory management
- Automatic key generation and management
- Error handling and recovery

#### Constructor

```python
def __init__(self, bucket_name: str, prefix: str, region_name: str = "us-west-2")
```

**Parameters:**
- `bucket_name`: S3 bucket name for storing memory data
- `prefix`: Key prefix for organizing memory data
- `region_name`: AWS region (default: "us-west-2")

#### Methods

**search(user_name, agent_name, **kwargs)**
- Retrieves memory data for a specific user and agent combination
- Supports conversation_id filtering through kwargs
- Returns stored content or None if not found

**Parameters:**
- `user_name`: Identifier for the user whose memory is being accessed
- `agent_name`: Name of the agent whose memory is being retrieved
- `**kwargs`: Additional parameters including:
  - `conversation_id`: Optional conversation identifier for specific thread memory

**get_store(bucket_name, prefix, region_name)**
- Static factory method for creating MemoryStore instances
- Convenient way to create store instances

## Implementation Examples

### Basic Usage

```python
from core.memory.memory_store import MemoryStore

# Create memory store
memory_store = MemoryStore(
    bucket_name="my-agent-memory",
    prefix="conversations",
    region_name="us-west-2"
)

# Search for agent memory
memory_data = memory_store.search(
    user_name="user123",
    agent_name="nlq_agent",
    conversation_id="12345"
)

if memory_data:
    print(f"Found memory: {memory_data}")
else:
    print("No memory found for this conversation")
```

### Using the Factory Method

```python
from core.memory.memory_store import MemoryStore

# Create store using factory method
store = MemoryStore.get_store(
    bucket_name="agent-conversations",
    prefix="memory",
    region_name="us-east-1"
)

# Use the store
conversation_memory = store.search(
    user_name="user456", 
    agent_name="chat_agent", 
    conversation_id="conv_001"
)
```

### Integration with Agents

```python
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore

class MemoryEnabledAgent(AgentBase):
    def __init__(self, llm, memory_config):
        super().__init__(llm)
        self.memory_store = MemoryStore(
            bucket_name=memory_config['bucket'],
            prefix=memory_config['prefix'],
            region_name=memory_config.get('region', 'us-west-2')
        )
    
    def get_conversation_memory(self, user_name: str, conversation_id: str):
        return self.memory_store.search(
            user_name=user_name,
            agent_name=self.name.lower().replace(' ', '_'),
            conversation_id=conversation_id
        )
    
    async def stream(self, query: str, thread_id: str, user_name: str):
        # Retrieve conversation memory
        memory = self.get_conversation_memory(user_name, thread_id)
        
        # Use memory in processing
        context = {"memory": memory, "query": query}
        
        # Process with memory context
        async for result in self._process_with_memory(context):
            yield result
```

### Memory Data Structure

The memory store uses a hierarchical key structure:

```
{prefix}/{user_name}/{agent_name}#{conversation_id}
```

Example keys:
- `conversations/user123/nlq_agent#12345`
- `memory/user456/chat_agent#conv_001`
- `sessions/user789/assistant#user_session_456`

### Error Handling

```python
def search_with_error_handling(self, user_name: str, agent_name: str, **kwargs):
    try:
        result = self.memory_store.search(user_name, agent_name, **kwargs)
        return result
    except Exception as e:
        print(f"Memory search failed: {e}")
        # Fallback to no memory
        return None
```

## Advanced Usage Patterns

### Conversation History Management

```python
class ConversationMemoryManager:
    def __init__(self, memory_store: MemoryStore):
        self.memory_store = memory_store
    
    def get_conversation_history(self, user_name: str, agent_name: str, conversation_id: str):
        """Retrieve full conversation history"""
        return self.memory_store.search(
            user_name=user_name,
            agent_name=agent_name,
            conversation_id=conversation_id
        )
    
    def get_recent_context(self, user_name: str, agent_name: str, conversation_id: str, limit: int = 5):
        """Get recent conversation context"""
        history = self.get_conversation_history(user_name, agent_name, conversation_id)
        if history:
            # Parse and return recent messages
            return self._parse_recent_messages(history, limit)
        return []
```

### Multi-Agent Memory Sharing

```python
class SharedMemoryManager:
    def __init__(self, memory_store: MemoryStore):
        self.memory_store = memory_store
    
    def get_shared_context(self, user_name: str, conversation_id: str, agent_names: list):
        """Get shared memory across multiple agents for a specific user"""
        shared_memory = {}
        for agent_name in agent_names:
            memory = self.memory_store.search(
                user_name=user_name,
                agent_name=agent_name,
                conversation_id=conversation_id
            )
            if memory:
                shared_memory[agent_name] = memory
        return shared_memory
```

## Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Memory Configuration
MEMORY_BUCKET=your-memory-bucket
MEMORY_PREFIX=conversations
```

### Configuration in Code

```python
import os
from core.memory.memory_store import MemoryStore

# Configuration from environment
memory_config = {
    'bucket_name': os.getenv('MEMORY_BUCKET', 'default-memory-bucket'),
    'prefix': os.getenv('MEMORY_PREFIX', 'conversations'),
    'region_name': os.getenv('AWS_REGION', 'us-west-2')
}

memory_store = MemoryStore(**memory_config)
```

## Best Practices

1. **Use meaningful prefixes**: Organize memory data with clear prefixes
2. **Handle missing memory gracefully**: Always check for None returns
3. **Implement proper error handling**: Handle AWS S3 errors appropriately
4. **Use conversation IDs consistently**: Maintain consistent ID formats
5. **Consider memory size limits**: Be mindful of S3 object size limits
6. **Implement memory cleanup**: Consider implementing memory retention policies

### User Identification Best Practices

7. **Consistent User IDs**: Use consistent, unique user identifiers across sessions
   ```python
   # Good: Use stable user identifiers
   user_id = "user_12345" or "john.doe@company.com"
   
   # Avoid: Temporary or session-based IDs that change
   user_id = session.temporary_id
   ```

8. **User Privacy**: Ensure user identifiers don't leak sensitive information
   ```python
   # Good: Use hashed or anonymized identifiers
   import hashlib
   user_id = hashlib.sha256(email.encode()).hexdigest()[:16]
   
   # Avoid: Using personally identifiable information directly
   user_id = user_email  # Don't use raw email in storage keys
   ```

9. **Memory Isolation**: Always include user_name in memory operations
   ```python
   # Correct: User-specific memory access
   memory = store.search(user_name="user123", agent_name="assistant")
   
   # Incorrect: Global memory access (deprecated pattern)
   memory = store.search(agent_name="assistant")  # Missing user context
   ```

## Error Scenarios and Handling

### Common Error Scenarios

1. **NoSuchKey Error**: When memory doesn't exist for a conversation
2. **Access Denied**: When S3 permissions are insufficient
3. **Network Errors**: When S3 is unreachable
4. **Invalid Bucket**: When bucket doesn't exist

### Error Handling Pattern

```python
def robust_memory_search(memory_store, user_name, agent_name, **kwargs):
    try:
        return memory_store.search(user_name, agent_name, **kwargs)
    except memory_store.s3.exceptions.NoSuchKey:
        print(f"No memory found for {user_name}/{agent_name}")
        return None
    except Exception as e:
        print(f"Memory search error: {e}")
        # Log error for debugging
        import logging
        logging.error(f"Memory search failed: {e}")
        return None
```

## Integration with Other Modules

The memory module integrates with:

- **Agent Module**: For conversation state persistence
- **Utility Module**: For AWS configuration management
- **Core Framework**: For overall system memory management

### Example Integration

```python
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore
from core.util.ConfigLoader import load_env_variables

class PersistentAgent(AgentBase):
    def __init__(self, llm):
        super().__init__(llm)
        
        # Load configuration
        env = load_env_variables()
        
        # Initialize memory store
        self.memory_store = MemoryStore(
            bucket_name=env.get('MEMORY_BUCKET'),
            prefix=env.get('MEMORY_PREFIX', 'agent_memory'),
            region_name=env.get('AWS_REGION', 'us-west-2')
        )
    
    def _get_conversation_context(self, user_name: str, conversation_id: str):
        return self.memory_store.search(
            user_name=user_name,
            agent_name=self.name.lower().replace(' ', '_'),
            conversation_id=conversation_id
        )
```

## Performance Considerations

1. **Caching**: Consider implementing local caching for frequently accessed memory
2. **Batch Operations**: Use batch operations when possible
3. **Connection Pooling**: Reuse S3 client connections
4. **Async Operations**: Consider async S3 operations for better performance

## Security Considerations

1. **IAM Permissions**: Use appropriate IAM roles and policies
2. **Encryption**: Enable S3 server-side encryption
3. **Access Logging**: Enable S3 access logging for auditing
4. **Network Security**: Use VPC endpoints if within AWS network

## Testing

### Unit Test Example

```python
import pytest
from moto import mock_s3
import boto3
from core.memory.memory_store import MemoryStore

@mock_s3
def test_memory_store():
    # Create mock S3 bucket
    s3 = boto3.client('s3', region_name='us-west-2')
    s3.create_bucket(
        Bucket='test-bucket',
        CreateBucketConfiguration={'LocationConstraint': 'us-west-2'}
    )
    
    # Test memory store
    store = MemoryStore('test-bucket', 'test-prefix')
    
    # Test search (should return None for non-existent key)
    result = store.search('test_user', 'test_agent', conversation_id='123')
    assert result is None
```

This memory module provides the foundation for persistent agent memory, enabling more contextual and intelligent conversations across multiple interactions.

## Migration Guide

### Updating Existing Code

If you have existing code that uses the memory module, you'll need to update your `search` calls to include the `user_name` parameter:

#### Before (Old API):
```python
# Old method signature - no longer supported
memory = memory_store.search(
    agent_name="nlq_agent",
    conversation_id="12345"
)
```

#### After (New API):
```python
# New method signature - requires user_name
memory = memory_store.search(
    user_name="user123",
    agent_name="nlq_agent", 
    conversation_id="12345"
)
```

#### Agent Implementation Update:
```python
# Before
class OldAgent(AgentBase):
    def get_memory(self, conversation_id: str):
        return self.memory_store.search(
            agent_name=self.name,
            conversation_id=conversation_id
        )

# After  
class UpdatedAgent(AgentBase):
    def get_memory(self, user_name: str, conversation_id: str):
        return self.memory_store.search(
            user_name=user_name,
            agent_name=self.name,
            conversation_id=conversation_id
        )
```

### Breaking Changes Summary

- `search()` method now requires `user_name` as the first parameter
- Memory keys now include user identification in the hierarchy
- All memory operations are now user-scoped for better isolation

### Backward Compatibility

This is a breaking change that requires code updates. The old API without `user_name` is no longer supported to ensure proper user isolation and data privacy.
