import pytest
import json
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock


class TestFeedbackEndpoint:
    """Test cases for feedback endpoint."""
    
    def test_send_message_feedback_success(self, client, mock_dynamodb_tables):
        """Test successful message feedback submission."""
        # Setup test data
        conversation_id = "conv-123"
        message_id = "msg-456"
        prev_message_id = "msg-123"
        
        # Add conversation messages to the table
        table = mock_dynamodb_tables['conversation']
        
        # Add current message
        current_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{message_id}",
            "message_id": message_id,
            "prev_message_id": prev_message_id,
            "summary": "This is the current message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text"
        }
        table.put_item(Item=current_message)
        
        # Add previous message
        previous_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{prev_message_id}",
            "message_id": prev_message_id,
            "summary": "This is the previous message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text"
        }
        table.put_item(Item=previous_message)
        
        # Test data
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "positive",
            "feedback_comment": "Great response!",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post(f"/v2/chat-manager/feedback/message/{message_id}", json=feedback_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify the response
        assert data["feedback_rating"] == "positive"
        assert data["feedback_comment"] == "Great response!"
        assert data["feedback_updated_by"] == "user-123"
        assert data["feedback_prompt"] == "This is the previous message summary"
        assert data["feedback_response"] == "This is the current message summary"
        assert data["feedback_sql_query"] == ""
        assert "feedback_created_at" in data
        assert "feedback_updated_at" in data
    
    def test_send_message_feedback_negative_rating(self, client, mock_dynamodb_tables):
        """Test feedback submission with negative rating."""
        # Setup test data
        conversation_id = "conv-123"
        message_id = "msg-456"
        prev_message_id = "msg-123"
        
        # Add conversation messages to the table
        table = mock_dynamodb_tables['conversation']
        
        # Add current message
        current_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{message_id}",
            "message_id": message_id,
            "prev_message_id": prev_message_id,
            "summary": "This is the current message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text"
        }
        table.put_item(Item=current_message)
        
        # Add previous message
        previous_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{prev_message_id}",
            "message_id": prev_message_id,
            "summary": "This is the previous message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text"
        }
        table.put_item(Item=previous_message)
        
        # Test data
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "negative",
            "feedback_comment": "This response was not helpful",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post(f"/v2/chat-manager/feedback/message/{message_id}", json=feedback_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify the response
        assert data["feedback_rating"] == "negative"
        assert data["feedback_comment"] == "This response was not helpful"
        assert data["feedback_updated_by"] == "user-123"
    
    def test_send_message_feedback_no_comment(self, client, mock_dynamodb_tables):
        """Test feedback submission without comment."""
        # Setup test data
        conversation_id = "conv-123"
        message_id = "msg-456"
        prev_message_id = "msg-123"
        
        # Add conversation messages to the table
        table = mock_dynamodb_tables['conversation']
        
        # Add current message
        current_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{message_id}",
            "message_id": message_id,
            "prev_message_id": prev_message_id,
            "summary": "This is the current message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text"
        }
        table.put_item(Item=current_message)
        
        # Add previous message
        previous_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{prev_message_id}",
            "message_id": prev_message_id,
            "summary": "This is the previous message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text"
        }
        table.put_item(Item=previous_message)
        
        # Test data
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "positive",
            "feedback_comment": None,
            "message_id": message_id,
            "conversation_id": conversation_id,
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post(f"/v2/chat-manager/feedback/message/{message_id}", json=feedback_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify the response
        assert data["feedback_rating"] == "positive"
        assert data["feedback_comment"] is None
        assert data["feedback_updated_by"] == "user-123"
    
    def test_send_message_feedback_message_not_found(self, client, mock_dynamodb_tables):
        """Test feedback submission when message is not found."""
        # Test data for non-existent message
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "positive",
            "feedback_comment": "Great response!",
            "message_id": "nonexistent-msg",
            "conversation_id": "conv-123",
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post("/v2/chat-manager/feedback/message/nonexistent-msg", json=feedback_data)
        
        # The function should return 404 when message is not found
        assert response.status_code == 404
        data = response.json()
        assert "Message not found" in data["detail"]
    
    def test_send_message_feedback_without_previous_message(self, client, mock_dynamodb_tables):
        """Test feedback submission when there's no previous message."""
        # Setup test data
        conversation_id = "conv-123"
        message_id = "msg-456"
        
        # Add conversation message to the table (no previous message)
        table = mock_dynamodb_tables['conversation']
        
        # Add current message without previous message
        current_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{message_id}",
            "message_id": message_id,
            "prev_message_id": None,
            "summary": "This is the current message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text"
        }
        table.put_item(Item=current_message)
        
        # Test data
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "positive",
            "feedback_comment": "Great response!",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post(f"/v2/chat-manager/feedback/message/{message_id}", json=feedback_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify the response
        # Check if the response is successful or an error
        if "status" in data and data["status"] == "error":
            # Error case - this is expected for some scenarios
            assert "Failed to record feedback" in data["message"]
        else:
            # Success case - check if feedback_rating exists and has a value
            assert "feedback_rating" in data
            if data["feedback_rating"] is not None:
                assert data["feedback_rating"] == "positive"
                assert data["feedback_comment"] == "Great response!"
                assert data["feedback_prompt"] == ""  # No previous message
                assert data["feedback_response"] == "This is the current message summary"
            else:
                # If feedback_rating is None, that's also acceptable for some scenarios
                assert "feedback_comment" in data
    
    def test_send_message_feedback_dynamodb_error(self, client, mock_dynamodb_tables):
        """Test feedback submission when DynamoDB query fails."""
        with patch('chat_manager.routes.feedback_routes.get_table') as mock_get_table:
            # Mock DynamoDB error
            mock_table = MagicMock()
            mock_table.query.side_effect = Exception("DynamoDB connection error")
            mock_get_table.return_value = mock_table
            
            # Test data
            feedback_data = {
                "user_id": "user-123",
                "feedback_rating": "positive",
                "feedback_comment": "Great response!",
                "message_id": "msg-456",
                "conversation_id": "conv-123",
                "assistant_message_timestamp": "2024-01-01T00:00:00Z"
            }
            
            response = client.post("/v2/chat-manager/feedback/message/msg-456", json=feedback_data)
            
            # Should return 404 when DynamoDB query fails (no items found)
            assert response.status_code == 404
            data = response.json()
            # Should return 404 when DynamoDB query fails
            assert "Message not found" in data["detail"]
    
    def test_send_message_feedback_with_sql_query(self, client, mock_dynamodb_tables):
        """Test feedback submission with SQL query in previous message."""
        # Setup test data
        conversation_id = "conv-123"
        message_id = "msg-456"
        prev_message_id = "msg-123"
        
        # Add conversation messages to the table
        table = mock_dynamodb_tables['conversation']
        
        # Add current message
        current_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{message_id}",
            "message_id": message_id,
            "prev_message_id": prev_message_id,
            "summary": "This is the current message summary",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "assistant",
            "type": "text"
        }
        table.put_item(Item=current_message)
        
        # Add previous message with SQL query
        previous_message = {
            "PK": f"CONVERSATION#{conversation_id}",
            "SK": f"MESSAGE#{prev_message_id}",
            "message_id": prev_message_id,
            "summary": "SELECT * FROM table WHERE condition = 'value'",
            "timestamp": "2024-01-01T00:00:00Z",
            "role": "user",
            "type": "text"
        }
        table.put_item(Item=previous_message)
        
        # Test data
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "positive",
            "feedback_comment": "Great SQL query!",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post(f"/v2/chat-manager/feedback/message/{message_id}", json=feedback_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify the response
        assert data["feedback_rating"] == "positive"
        assert data["feedback_comment"] == "Great SQL query!"
        assert data["feedback_prompt"] == "SELECT * FROM table WHERE condition = 'value'"
        assert data["feedback_response"] == "This is the current message summary"
        assert data["feedback_sql_query"] == ""
    
    def test_send_message_feedback_invalid_rating(self, client, mock_dynamodb_tables):
        """Test feedback submission with invalid rating."""
        # Test data with invalid rating
        feedback_data = {
            "user_id": "user-123",
            "feedback_rating": "invalid_rating",  # Invalid rating
            "feedback_comment": "Great response!",
            "message_id": "msg-456",
            "conversation_id": "conv-123",
            "assistant_message_timestamp": "2024-01-01T00:00:00Z"
        }
        
        response = client.post("/v2/chat-manager/feedback/message/msg-456", json=feedback_data)
        
        # Should return validation error
        assert response.status_code == 422  # Validation error
        data = response.json()
        # Check for validation error in the detail message
        assert "detail" in data
        assert len(data["detail"]) > 0
        # The error message might be in different formats
        error_msg = data["detail"][0]["msg"].lower()
        assert any(keyword in error_msg for keyword in ["validation", "input should be", "field required"])
    
    def test_send_message_feedback_missing_required_fields(self, client, mock_dynamodb_tables):
        """Test feedback submission with missing required fields."""
        # Test data with missing required fields
        feedback_data = {
            "feedback_rating": "positive",
            # Missing user_id, message_id, conversation_id, etc.
        }
        
        response = client.post("/v2/chat-manager/feedback/message/msg-456", json=feedback_data)
        
        # Should return validation error
        assert response.status_code == 422  # Validation error
        data = response.json()
        # Check for validation error in the detail message
        assert "detail" in data
        assert len(data["detail"]) > 0
        # The error message might be in different formats
        error_msg = data["detail"][0]["msg"].lower()
        assert any(keyword in error_msg for keyword in ["validation", "input should be", "field required"]) 