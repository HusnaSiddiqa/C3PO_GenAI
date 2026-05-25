import pytest
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from chat_manager.routes.chat_routes import generate_id


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


class TestOnboardingLogic:
    """Test cases for onboarding logic."""
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_onboarding_data_processing(self, mock_get_table):
        """Test onboarding data processing logic."""
        # Mock table response
        mock_table = MagicMock()
        mock_response = {
            "Items": [{
                "onboarding_id": "test-123",
                "agent_name": "Test Agent",
                "agent_description": "A test agent",
                "updated_by": "test-user",
                "updated_at": "2024-01-01T00:00:00Z"
            }]
        }
        mock_table.scan.return_value = mock_response
        mock_get_table.return_value = mock_table
        
        # Import the function
        from chat_manager.routes.chat_routes import get_onboarding # This import was already there
        
        # Test the function
        result = await get_onboarding()
        
        # Verify the result
        assert result.onboarding_id == "test-123"
        assert result.agent_name == "Test Agent"
        assert result.agent_description == "A test agent"
        assert result.updated_by == "test-user"
        assert result.updated_at == "2024-01-01T00:00:00Z"
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_onboarding_not_found(self, mock_get_table):
        """Test onboarding not found scenario."""
        # Mock empty response
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_onboarding
        
        # Test that it raises HTTPException
        with pytest.raises(Exception) as exc_info:
            await get_onboarding()
        
        assert "Onboarding data not found" in str(exc_info.value)
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_onboarding_dynamodb_error(self, mock_get_table):
        """Test DynamoDB error handling."""
        # Mock DynamoDB error
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB connection error")
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_onboarding
        
        # Test that it raises HTTPException with 500 status
        with pytest.raises(Exception) as exc_info:
            await get_onboarding()
        
        assert "DynamoDB error" in str(exc_info.value)


class TestClickableQuestionsLogic:
    """Test cases for clickable questions logic."""
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_clickable_questions_processing(self, mock_get_table):
        """Test clickable questions processing logic."""
        # Mock table response
        mock_table = MagicMock()
        mock_response = {
            "Items": [
                {
                    "question_id": "q1",
                    "category": "General",
                    "question": "What can you help me with?",
                    "enabled": True
                },
                {
                    "question_id": "q2",
                    "category": "General",
                    "question": "How do I get started?",
                    "enabled": True
                },
                {
                    "question_id": "q3",
                    "category": "Technical",
                    "question": "What are the system requirements?",
                    "enabled": True
                }
            ]
        }
        mock_table.scan.return_value = mock_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_clickable_questions
        
        result = await get_clickable_questions()
        
        # Verify the result structure
        assert len(result) == 2  # Two categories
        
        # Check General category
        general_cat = next(cat for cat in result if cat["category"] == "General")
        assert len(general_cat["clickable_questions"]) == 2
        
        # Check Technical category
        technical_cat = next(cat for cat in result if cat["category"] == "Technical")
        assert len(technical_cat["clickable_questions"]) == 1
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_clickable_questions_empty(self, mock_get_table):
        """Test empty clickable questions scenario."""
        # Mock empty response
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_clickable_questions
        
        result = await get_clickable_questions()
        
        assert result == []
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_clickable_questions_dynamodb_error(self, mock_get_table):
        """Test DynamoDB error handling for clickable questions."""
        # Mock DynamoDB error
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB connection error")
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_clickable_questions
        
        # Test that it raises HTTPException with 500 status
        with pytest.raises(Exception) as exc_info:
            await get_clickable_questions()
        
        assert "Error fetching clickable questions" in str(exc_info.value)


class TestConversationLogic:
    """Test cases for conversation logic."""
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_metadata_processing(self, mock_get_table):
        """Test conversation metadata processing logic."""
        # Mock conversation metadata
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "user",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "result": '[{"type": "text", "content": "Hello"}]'
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify the result
        assert result.conversation_id == "conv-123"
        assert result.user_id == "user-123"
        assert result.status == "active"
        assert result.title == "Test Conversation"
        assert len(result.messages) == 1
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_not_found(self, mock_get_table):
        """Test conversation not found scenario."""
        # Mock empty response
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        # Test that it raises HTTPException
        with pytest.raises(Exception) as exc_info:
            await get_conversation("nonexistent")
        
        assert "Conversation not found" in str(exc_info.value)
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_chart_data(self, mock_get_table):
        """Test conversation with chart data processing."""
        # Mock conversation with chart data
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        chart_data = [{"type": "bar", "data": [{"x": 1, "y": 2}]}]
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "assistant",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "chart": json.dumps(chart_data),
                    "result": '[{"type": "text", "content": "Here is your chart"}]'
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify chart data is processed correctly
        assert len(result.messages) == 1
        assert result.messages[0].chart == chart_data
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_invalid_chart_data(self, mock_get_table):
        """Test conversation with invalid chart data."""
        # Mock conversation with invalid chart data
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "assistant",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "chart": "invalid json",
                    "result": '[{"type": "text", "content": "Here is your chart"}]'
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify invalid chart data is handled gracefully
        # Chart should be None since len(chart_data) == 0 after JSON decode error
        assert len(result.messages) == 1
        assert result.messages[0].chart is None
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @patch('chat_manager.routes.chat_routes.CONVERSATION_STORE_TABLE', 'test-conversation-store')
    @patch('chat_manager.routes.chat_routes.BYOD_FILES_TABLE', 'test-byod-files')
    @pytest.mark.asyncio
    async def test_conversation_with_file_data(self, mock_get_table):
        """Test conversation with file data processing."""
        # Mock conversation with file data
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "user",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "file_id": "file-123",
                    "result": '[{"type": "text", "content": "Uploaded file"}]'
                }
            ]
        }
        
        mock_file_response = {
            "Item": {
                "file_id": "file-123",
                "filename": "test.pdf",
                "file_type": "pdf"
            }
        }
        
        # Mock different table responses
        def mock_get_table_side_effect(table_name):
            mock_table_instance = MagicMock()
            if table_name == "test-conversation-store":
                mock_table_instance.get_item.return_value = mock_meta_response
                mock_table_instance.query.return_value = mock_messages_response
            elif table_name == "test-byod-files":
                mock_table_instance.get_item.return_value = mock_file_response
            return mock_table_instance
        
        mock_get_table.side_effect = mock_get_table_side_effect
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify file data is processed correctly
        assert len(result.messages) == 1
        assert result.messages[0].file is not None
        assert result.messages[0].file.file_id == "file-123"
        assert result.messages[0].file.filename == "test.pdf"
        assert result.messages[0].file.file_type == "pdf"
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_invalid_result_json(self, mock_get_table):
        """Test conversation with invalid result JSON."""
        # Mock conversation with invalid result JSON
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "user",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "result": "invalid json"
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify invalid result JSON is handled gracefully
        assert len(result.messages) == 1
        assert result.messages[0].result == []
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_dynamodb_error(self, mock_get_table):
        """Test DynamoDB error handling for conversation."""
        # Mock DynamoDB error
        mock_table = MagicMock()
        mock_table.get_item.side_effect = Exception("DynamoDB connection error")
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        # Test that it raises HTTPException with 500 status
        with pytest.raises(Exception) as exc_info:
            await get_conversation("conv-123")
        
        assert "Error retrieving conversation" in str(exc_info.value)


class TestChatHistoryLogic:
    """Test cases for chat history logic."""
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_chat_history_time_categorization(self, mock_get_table):
        """Test chat history time categorization logic."""
        # Mock chat history data
        mock_table = MagicMock()
        now = datetime.now(timezone.utc)
        
        # Create test data for different time periods
        today_conv = {
            "PK": "CONVERSATION#conv-today",
            "SK": "META",
            "conversation_id": "conv-today",
            "user_id": "user-123",
            "status": "active",
            "last_updated": now.isoformat(),
            "title": "Today's Conversation"
        }
        
        yesterday = now - timedelta(days=1)
        yesterday_conv = {
            "PK": "CONVERSATION#conv-yesterday",
            "SK": "META",
            "conversation_id": "conv-yesterday",
            "user_id": "user-123",
            "status": "active",
            "last_updated": yesterday.isoformat(),
            "title": "Yesterday's Conversation"
        }
        
        three_days_ago = now - timedelta(days=3)
        week_conv = {
            "PK": "CONVERSATION#conv-week",
            "SK": "META",
            "conversation_id": "conv-week",
            "user_id": "user-123",
            "status": "active",
            "last_updated": three_days_ago.isoformat(),
            "title": "Week Conversation"
        }
        
        ten_days_ago = now - timedelta(days=10)
        older_conv = {
            "PK": "CONVERSATION#conv-older",
            "SK": "META",
            "conversation_id": "conv-older",
            "user_id": "user-123",
            "status": "active",
            "last_updated": ten_days_ago.isoformat(),
            "title": "Older Conversation"
        }
        
        mock_response = {
            "Items": [today_conv, yesterday_conv, week_conv, older_conv]
        }
        
        mock_table.query.return_value = mock_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_chat_history
        
        result = await get_chat_history("user-123")
        
        # Verify categorization
        chat_history = result["chatHistory"]
        assert len(chat_history["today"]) == 1
        assert len(chat_history["yesterday"]) == 1
        assert len(chat_history["last7Days"]) == 1
        assert len(chat_history["older"]) == 1
        
        # Check that conversations are properly categorized
        assert chat_history["today"][0]["conversation_id"] == "conv-today"
        assert chat_history["yesterday"][0]["conversation_id"] == "conv-yesterday"
        assert chat_history["last7Days"][0]["conversation_id"] == "conv-week"
        assert chat_history["older"][0]["conversation_id"] == "conv-older"
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_chat_history_empty(self, mock_get_table):
        """Test empty chat history scenario."""
        # Mock empty response
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": []}
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_chat_history
        
        result = await get_chat_history("user-123")
        
        chat_history = result["chatHistory"]
        assert len(chat_history["today"]) == 0
        assert len(chat_history["yesterday"]) == 0
        assert len(chat_history["last7Days"]) == 0
        assert len(chat_history["older"]) == 0
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @patch.dict('os.environ', {'DEFAULT_USER': 'default-user'})
    @pytest.mark.asyncio
    async def test_chat_history_with_default_user(self, mock_get_table):
        """Test chat history with default user when no user_id provided."""
        # Mock empty response
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": []}
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_chat_history
        
        result = await get_chat_history(None)
        
        # Verify default user is used
        chat_history = result["chatHistory"]
        assert len(chat_history["today"]) == 0
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_chat_history_with_invalid_timestamp(self, mock_get_table):
        """Test chat history with invalid timestamp handling."""
        # Mock response with invalid timestamp
        mock_table = MagicMock()
        mock_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-invalid",
                    "SK": "META",
                    "conversation_id": "conv-invalid",
                    "user_id": "user-123",
                    "status": "active",
                    "last_updated": "invalid-timestamp",
                    "title": "Invalid Timestamp"
                }
            ]
        }
        
        mock_table.query.return_value = mock_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_chat_history
        
        result = await get_chat_history("user-123")
        
        # Verify invalid timestamp is handled gracefully
        chat_history = result["chatHistory"]
        assert len(chat_history["today"]) == 0
        assert len(chat_history["yesterday"]) == 0
        assert len(chat_history["last7Days"]) == 0
        assert len(chat_history["older"]) == 0
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_chat_history_dynamodb_error(self, mock_get_table):
        """Test DynamoDB error handling for chat history."""
        # Mock DynamoDB error
        mock_table = MagicMock()
        mock_table.query.side_effect = Exception("DynamoDB connection error")
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_chat_history
        
        # Test that it raises HTTPException with 500 status
        with pytest.raises(Exception) as exc_info:
            await get_chat_history("user-123")
        
        assert "Error retrieving chat history" in str(exc_info.value) 

    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_dict_result(self, mock_get_table):
        """Test conversation with dict result processing."""
        # Mock conversation with dict result
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "user",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "result": '{"type": "text", "content": "Hello"}'
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify dict result is converted to list
        assert len(result.messages) == 1
        assert isinstance(result.messages[0].result, list)
        assert len(result.messages[0].result) == 1
        assert result.messages[0].result[0]["type"] == "text"
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_non_string_result(self, mock_get_table):
        """Test conversation with non-string result processing."""
        # Mock conversation with non-string result
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "user",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "result": None
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify non-string result is handled gracefully
        assert len(result.messages) == 1
        assert result.messages[0].result == []
    
    @patch('chat_manager.routes.chat_routes.get_table')
    @pytest.mark.asyncio
    async def test_conversation_with_chart_error_dict(self, mock_get_table):
        """Test conversation with chart data containing error dict."""
        # Mock conversation with chart error dict
        mock_table = MagicMock()
        mock_meta_response = {
            "Item": {
                "conversation_id": "conv-123",
                "user_id": "user-123",
                "status": "active",
                "created_at": "2024-01-01T00:00:00Z",
                "last_updated": "2024-01-01T01:00:00Z",
                "title": "Test Conversation"
            }
        }
        
        chart_error_data = {"error": "Chart generation failed"}
        mock_messages_response = {
            "Items": [
                {
                    "PK": "CONVERSATION#conv-123",
                    "SK": "MESSAGE#msg-1",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "role": "assistant",
                    "type": "text",
                    "conversation_id": "conv-123",
                    "message_id": "msg-1",
                    "chart": json.dumps(chart_error_data),
                    "result": '[{"type": "text", "content": "Chart error"}]'
                }
            ]
        }
        
        mock_table.get_item.return_value = mock_meta_response
        mock_table.query.return_value = mock_messages_response
        mock_get_table.return_value = mock_table
        
        from chat_manager.routes.chat_routes import get_conversation
        
        result = await get_conversation("conv-123")
        
        # Verify chart error dict is converted to empty list
        # Chart should be None since len(chart_data) == 0 after error processing
        assert len(result.messages) == 1
        assert result.messages[0].chart is None 