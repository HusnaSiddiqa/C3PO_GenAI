import pytest
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from chat_manager.routes.chat_routes import generate_id


class TestOnboardingEndpoint:
    """Test cases for the onboarding endpoint."""
    
    def test_get_onboarding_success(self, client, mock_dynamodb_tables, sample_onboarding_data):
        """Test successful retrieval of onboarding data."""
        # Populate the mock table
        table = mock_dynamodb_tables['onboarding']
        table.put_item(Item=sample_onboarding_data)
        
        response = client.get("/v2/chat-manager/chat/onboarding")
        
        assert response.status_code == 200
        data = response.json()
        assert data["onboarding_id"] == sample_onboarding_data["onboarding_id"]
        assert data["agent_name"] == sample_onboarding_data["agent_name"]
        assert data["agent_description"] == sample_onboarding_data["agent_description"]
        assert data["updated_by"] == sample_onboarding_data["updated_by"]
        assert data["updated_at"] == sample_onboarding_data["updated_at"]
    
    def test_get_onboarding_not_found(self, client, mock_dynamodb_tables):
        """Test when onboarding data is not found."""
        response = client.get("/v2/chat-manager/chat/onboarding")
        
        assert response.status_code == 404
        assert "Onboarding data not found" in response.json()["detail"]
    
    def test_get_onboarding_dynamodb_error(self, client, mock_dynamodb_tables):
        """Test handling of DynamoDB errors."""
        with patch('chat_manager.routes.chat_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB connection error")
            mock_get_table.return_value = mock_table
            
            response = client.get("/v2/chat-manager/chat/onboarding")
            
            assert response.status_code == 500
            assert "DynamoDB error" in response.json()["detail"]


class TestClickableQuestionsEndpoint:
    """Test cases for the clickable questions endpoint."""
    
    def test_get_clickable_questions_success(self, client, mock_dynamodb_tables, sample_clickable_questions):
        """Test successful retrieval of clickable questions."""
        # Populate the mock table
        table = mock_dynamodb_tables['clickable']
        for question in sample_clickable_questions:
            table.put_item(Item=question)
        
        response = client.get("/v2/chat-manager/chat/clickable")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that we have the expected categories
        categories = [cat["category"] for cat in data]
        assert "General" in categories
        assert "Technical" in categories
        
        # Check that questions are properly grouped
        general_category = next(cat for cat in data if cat["category"] == "General")
        assert len(general_category["clickable_questions"]) == 2
        
        technical_category = next(cat for cat in data if cat["category"] == "Technical")
        assert len(technical_category["clickable_questions"]) == 1
    
    def test_get_clickable_questions_empty(self, client, mock_dynamodb_tables):
        """Test when no clickable questions are found."""
        response = client.get("/v2/chat-manager/chat/clickable")
        
        assert response.status_code == 200
        data = response.json()
        assert data == []
    
    def test_get_clickable_questions_dynamodb_error(self, client, mock_dynamodb_tables):
        """Test handling of DynamoDB errors."""
        with patch('chat_manager.routes.chat_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB connection error")
            mock_get_table.return_value = mock_table
            
            response = client.get("/v2/chat-manager/chat/clickable")
            
            assert response.status_code == 500
            assert "Error fetching clickable questions" in response.json()["detail"]


class TestConversationEndpoint:
    """Test cases for the conversation endpoint."""
    
    def test_get_conversation_success(self, client, mock_dynamodb_tables, sample_conversation_data, sample_messages):
        """Test successful retrieval of a conversation."""
        # Populate the mock tables
        conv_table = mock_dynamodb_tables['conversation']
        
        # Add conversation metadata
        meta_item = {
            "PK": f"CONVERSATION#{sample_conversation_data['conversation_id']}",
            "SK": "META",
            **sample_conversation_data
        }
        conv_table.put_item(Item=meta_item)
        
        # Add messages
        for message in sample_messages:
            conv_table.put_item(Item=message)
        
        response = client.get(f"/v2/chat-manager/chat/conversation/{sample_conversation_data['conversation_id']}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["conversation_id"] == sample_conversation_data["conversation_id"]
        assert data["user_id"] == sample_conversation_data["user_id"]
        assert data["status"] == sample_conversation_data["status"]
        assert data["title"] == sample_conversation_data["title"]
        assert len(data["messages"]) == 2
        
        # Check message structure
        user_message = data["messages"][0]
        assert user_message["role"] == "user"
        assert user_message["type"] == "text"
        assert user_message["conversation_id"] == sample_conversation_data["conversation_id"]
        
        assistant_message = data["messages"][1]
        assert assistant_message["role"] == "assistant"
        assert assistant_message["type"] == "text"
    
    def test_get_conversation_with_file(self, client, mock_dynamodb_tables, sample_conversation_data, sample_file_data):
        """Test conversation retrieval with file attachment."""
        # Populate the mock tables
        conv_table = mock_dynamodb_tables['conversation']
        file_table = mock_dynamodb_tables['files']
        
        # Add conversation metadata
        meta_item = {
            "PK": f"CONVERSATION#{sample_conversation_data['conversation_id']}",
            "SK": "META",
            **sample_conversation_data
        }
        conv_table.put_item(Item=meta_item)
        
        # Add message with file
        message_with_file = {
            "PK": f"CONVERSATION#{sample_conversation_data['conversation_id']}",
            "SK": "MESSAGE#msg-1",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text",
            "conversation_id": sample_conversation_data["conversation_id"],
            "message_id": "msg-1",
            "file_id": sample_file_data["file_id"],
            "result": '[{"type": "text", "content": "Hello"}]'
        }
        conv_table.put_item(Item=message_with_file)
        
        # Add file metadata
        file_table.put_item(Item=sample_file_data)
        
        response = client.get(f"/v2/chat-manager/chat/conversation/{sample_conversation_data['conversation_id']}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["messages"]) == 1
        message = data["messages"][0]
        assert message["file"] is not None
        assert message["file"]["file_id"] == sample_file_data["file_id"]
        assert message["file"]["filename"] == sample_file_data["filename"]
        assert message["file"]["file_type"] == sample_file_data["file_type"]
    
    def test_get_conversation_with_chart(self, client, mock_dynamodb_tables, sample_conversation_data):
        """Test conversation retrieval with chart data."""
        # Populate the mock table
        conv_table = mock_dynamodb_tables['conversation']
        
        # Add conversation metadata
        meta_item = {
            "PK": f"CONVERSATION#{sample_conversation_data['conversation_id']}",
            "SK": "META",
            **sample_conversation_data
        }
        conv_table.put_item(Item=meta_item)
        
        # Add message with chart
        chart_data = [
            {
                "type": "bar",
                "x_field": "category",
                "y_field": "value",
                "data": [{"category": "A", "value": 10}, {"category": "B", "value": 20}]
            }
        ]
        
        message_with_chart = {
            "PK": f"CONVERSATION#{sample_conversation_data['conversation_id']}",
            "SK": "MESSAGE#msg-1",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text",
            "conversation_id": sample_conversation_data["conversation_id"],
            "message_id": "msg-1",
            "chart": json.dumps(chart_data),
            "result": '[{"type": "text", "content": "Here is your chart"}]'
        }
        conv_table.put_item(Item=message_with_chart)
        
        response = client.get(f"/v2/chat-manager/chat/conversation/{sample_conversation_data['conversation_id']}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["messages"]) == 1
        message = data["messages"][0]
        assert message["chart"] == chart_data
    
    def test_get_conversation_not_found(self, client, mock_dynamodb_tables):
        """Test when conversation is not found."""
        response = client.get("/v2/chat-manager/chat/conversation/nonexistent-conv-id")
        
        assert response.status_code == 404
        assert "Conversation not found" in response.json()["detail"]
    
    def test_get_conversation_dynamodb_error(self, client, mock_dynamodb_tables):
        """Test handling of DynamoDB errors."""
        with patch('chat_manager.routes.chat_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.get_item.side_effect = Exception("DynamoDB connection error")
            mock_get_table.return_value = mock_table
            
            response = client.get("/v2/chat-manager/chat/conversation/test-conv-id")
            
            assert response.status_code == 500
            assert "Error retrieving conversation" in response.json()["detail"]


class TestChatHistoryEndpoint:
    """Test cases for the chat history endpoint."""
    
    def test_get_chat_history_success(self, client, mock_dynamodb_tables):
        """Test successful retrieval of chat history."""
        # Populate the mock table
        table = mock_dynamodb_tables['conversation']
        
        # Add conversation metadata for different time periods
        now = datetime.now(timezone.utc)
        
        # Today's conversation
        today_conv = {
            "PK": "CONVERSATION#conv-today",
            "SK": "META",
            "conversation_id": "conv-today",
            "user_id": "user-123",
            "status": "active",
            "created_at": now.isoformat(),
            "last_updated": now.isoformat(),
            "title": "Today's Conversation"
        }
        
        # Yesterday's conversation
        yesterday = now - timedelta(days=1)
        yesterday_conv = {
            "PK": "CONVERSATION#conv-yesterday",
            "SK": "META",
            "conversation_id": "conv-yesterday",
            "user_id": "user-123",
            "status": "active",
            "created_at": yesterday.isoformat(),
            "last_updated": yesterday.isoformat(),
            "title": "Yesterday's Conversation"
        }
        
        # Last 7 days conversation
        three_days_ago = now - timedelta(days=3)
        week_conv = {
            "PK": "CONVERSATION#conv-week",
            "SK": "META",
            "conversation_id": "conv-week",
            "user_id": "user-123",
            "status": "active",
            "created_at": three_days_ago.isoformat(),
            "last_updated": three_days_ago.isoformat(),
            "title": "Week Conversation"
        }
        
        # Older conversation
        ten_days_ago = now - timedelta(days=10)
        older_conv = {
            "PK": "CONVERSATION#conv-older",
            "SK": "META",
            "conversation_id": "conv-older",
            "user_id": "user-123",
            "status": "active",
            "created_at": ten_days_ago.isoformat(),
            "last_updated": ten_days_ago.isoformat(),
            "title": "Older Conversation"
        }
        
        # Add all conversations
        for conv in [today_conv, yesterday_conv, week_conv, older_conv]:
            table.put_item(Item=conv)
        
        response = client.get("/v2/chat-manager/chat/history?user_id=user-123")
        
        assert response.status_code == 200
        data = response.json()
        
        chat_history = data["chatHistory"]
        assert len(chat_history["today"]) == 1
        assert len(chat_history["yesterday"]) == 1
        assert len(chat_history["last7Days"]) == 1
        assert len(chat_history["older"]) == 1
        
        # Check that conversations are properly categorized
        assert chat_history["today"][0]["conversation_id"] == "conv-today"
        assert chat_history["yesterday"][0]["conversation_id"] == "conv-yesterday"
        assert chat_history["last7Days"][0]["conversation_id"] == "conv-week"
        assert chat_history["older"][0]["conversation_id"] == "conv-older"
    
    def test_get_chat_history_empty(self, client, mock_dynamodb_tables):
        """Test when no chat history is found."""
        response = client.get("/v2/chat-manager/chat/history?user_id=user-123")
        
        assert response.status_code == 200
        data = response.json()
        chat_history = data["chatHistory"]
        assert len(chat_history["today"]) == 0
        assert len(chat_history["yesterday"]) == 0
        assert len(chat_history["last7Days"]) == 0
        assert len(chat_history["older"]) == 0
    
    def test_get_chat_history_with_default_user(self, client, mock_dynamodb_tables):
        """Test chat history with default user when no user_id provided."""
        with patch.dict('os.environ', {'DEFAULT_USER': 'default-user'}):
            response = client.get("/v2/chat-manager/chat/history")
            
            assert response.status_code == 200
            # The response should be processed normally with the default user
    
    def test_get_chat_history_dynamodb_error(self, client, mock_dynamodb_tables):
        """Test handling of DynamoDB errors."""
        with patch('chat_manager.routes.chat_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.side_effect = Exception("DynamoDB connection error")
            mock_get_table.return_value = mock_table
            
            response = client.get("/v2/chat-manager/chat/history?user_id=user-123")
            
            assert response.status_code == 500
            assert "Error retrieving chat history" in response.json()["detail"]


class TestUtilityFunctions:
    """Test cases for utility functions."""
    
    def test_generate_id(self):
        """Test the generate_id function."""
        
        id1 = generate_id()
        id2 = generate_id()
        
        assert isinstance(id1, str)
        assert isinstance(id2, str)
        assert id1 != id2  # Should generate unique IDs
        assert len(id1) > 0  # Should not be empty 