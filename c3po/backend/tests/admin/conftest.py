import pytest
import boto3
import os
from moto import mock_aws
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Add the parent directory to the path so we can import our modules
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Import constants directly to avoid importing the full app
from utils.constants import ONBOARDING_TABLE, CONVERSATION_STORE_TABLE, CLICKABLE_QUESTIONS_TABLE, BYOD_FILES_TABLE


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    # Import app here to avoid circular imports
    from chat_manager.main import app
    return TestClient(app)


@pytest.fixture
def mock_dynamodb_tables():
    """Mock DynamoDB tables for testing."""
    with mock_aws():
        dynamodb = boto3.resource('dynamodb', region_name='us-west-2')
        
        # Create mock tables
        tables = {}
        
        # Onboarding table
        tables['onboarding'] = dynamodb.create_table(
            TableName=ONBOARDING_TABLE,
            KeySchema=[
                {'AttributeName': 'onboarding_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'onboarding_id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # Conversation store table
        tables['conversation'] = dynamodb.create_table(
            TableName=CONVERSATION_STORE_TABLE,
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'last_updated', 'AttributeType': 'S'}
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'UserLastUpdated',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'last_updated', 'KeyType': 'RANGE'}
                    ],
                    'Projection': {'ProjectionType': 'ALL'}
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # Clickable questions table
        tables['clickable'] = dynamodb.create_table(
            TableName=CLICKABLE_QUESTIONS_TABLE,
            KeySchema=[
                {'AttributeName': 'question_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'question_id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # BYOD files table
        tables['files'] = dynamodb.create_table(
            TableName=BYOD_FILES_TABLE,
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        yield tables


@pytest.fixture
def sample_onboarding_data():
    """Sample onboarding data for testing."""
    return {
        "onboarding_id": "test-onboarding-123",
        "updated_by": "test-user",
        "agent_description": "A helpful AI assistant for testing",
        "agent_name": "Test Agent",
        "updated_at": "2024-01-01T00:00:00Z"
    }


@pytest.fixture
def sample_clickable_questions():
    """Sample clickable questions data for testing."""
    return [
        {
            "question_id": "q1",
            "category": "General",
            "question": "What can you help me with?"
        },
        {
            "question_id": "q2",
            "category": "General",
            "question": "How do I get started?"
        },
        {
            "question_id": "q3",
            "category": "Technical",
            "question": "What are the system requirements?"
        }
    ]


@pytest.fixture
def sample_conversation_data():
    """Sample conversation data for testing."""
    return {
        "conversation_id": "conv-123",
        "user_id": "user-123",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z",
        "last_updated": "2024-01-01T01:00:00Z",
        "title": "Test Conversation"
    }


@pytest.fixture
def sample_messages():
    """Sample messages for testing."""
    return [
        {
            "PK": "CONVERSATION#conv-123",
            "SK": "MESSAGE#msg-1",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text",
            "conversation_id": "conv-123",
            "message_id": "msg-1",
            "result": '[{"type": "text", "content": "Hello"}]'
        },
        {
            "PK": "CONVERSATION#conv-123",
            "SK": "MESSAGE#msg-2",
            "timestamp": "2024-01-01T00:01:00Z",
            "role": "assistant",
            "type": "text",
            "conversation_id": "conv-123",
            "message_id": "msg-2",
            "result": '[{"type": "text", "content": "Hi there! How can I help you?"}]'
        }
    ]


@pytest.fixture
def sample_file_data():
    """Sample file data for testing."""
    return {
        "PK": "FILE#file-123",
        "SK": "META",
        "file_id": "file-123",
        "filename": "test.pdf",
        "file_type": "pdf"
    } 