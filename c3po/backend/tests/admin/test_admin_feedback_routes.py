from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from admin.routes.admin_feedback_routes import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestAdminFeedbackRoutes:
    def test_get_feedback_success(self):
        sample_item = {
            'feedback_created_at': "2025-12-10T12:00:00Z",
            'feedback_comment': "Great!",
            'feedback_rating': "5",
            'user_id': "user-1",
            'agent': "C3PO",
            'feedback_prompt': "Prompt",
            'feedback_response': "Response",
            'feedback_sql_query': "SELECT * FROM table;",
            'message_id': "msg-1"
        }
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {"Items": [sample_item]}
            response = client.get("/admin/feedback")
            assert response.status_code == 200
            data = response.json()
            assert data[0]['user_id'] == "user-1"
            assert data[0]['feedback'] == "Great!"

    def test_get_feedback_filters(self):
        sample_item = {
            'feedback_created_at': "2025-12-10T12:00:00Z",
            'feedback_comment': "Great!",
            'feedback_rating': "5",
            'user_id': "user-1",
            'agent': "C3PO",
            'feedback_prompt': "Prompt",
            'feedback_response': "Response",
            'feedback_sql_query': "SELECT * FROM table;",
            'message_id': "msg-1"
        }
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {"Items": [sample_item]}
            response = client.get("/admin/feedback?user_id=user-1&rating=5&search=Prompt")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]['user_id'] == "user-1"

    def test_get_feedback_dynamodb_error(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.side_effect = Exception("DynamoDB error")
            response = client.get("/admin/feedback")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 0  # Should return empty list on error

    def test_get_feedback_users_success(self):
        sample_items = [
            {'user_id': 'user-1'},
            {'user_id': 'user-2'},
            {'user_id': 'user-1'},
            {'user_id': None}
        ]
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.scan.return_value = {'Items': sample_items}
            response = client.get("/admin/feedback/user")
            assert response.status_code == 200
            data = response.json()
            assert "user-1" in data and "user-2" in data

    def test_get_feedback_users_dynamodb_error(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.scan.side_effect = Exception("DynamoDB error")
            response = client.get("/admin/feedback/user")
            assert response.status_code == 200
            data = response.json()
            assert "mock-user-1" in data

    def test_get_feedback_detail_success(self):
        sample_item = {
            'SK': 'MESSAGE#2025-07-10T12:00:00Z#msg-1',
            'PK': 'USER#user-1',
            'user_id': 'user-1',
            'feedback_rating': '5',
            'feedback_prompt': 'Prompt',
            'agent': 'C3PO',
            'feedback_response': 'Response',
            'feedback_comment': 'Great!',
            'feedback_sql_query': 'SELECT * FROM table;'
        }
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {'Items': [sample_item]}
            response = client.get("/admin/feedback/msg-1")
            assert response.status_code == 200
            data = response.json()
            assert data['user_id'] == 'user-1'
            assert data['feedback'] == 'Great!'

    def test_get_feedback_detail_not_found(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {'Items': []}
            response = client.get("/admin/feedback/msg-404")
            assert response.status_code == 404

    def test_get_feedback_detail_dynamodb_error(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.side_effect = Exception("DynamoDB error")
            response = client.get("/admin/feedback/msg-1")
            assert response.status_code == 200
            data = response.json()
            assert data['user_id'] == "mock-user"

    def test_review_feedback_success(self):
        sample_item = {
            'SK': 'MESSAGE#2025-07-10T12:00:00Z#msg-1',
            'PK': 'USER#user-1',
            'message_id': 'msg-1',
            'conversation_id': 'conv-1'
        }
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {'Items': [sample_item]}
            mock_table.update_item.return_value = {"Attributes": {}}
            response = client.put(
                "/admin/feedback/msg-1",
                json={"conversation_id": "conv-1", "sql_query": "SELECT * FROM table;", "user_id": "admin"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "updated"
            assert data["message_id"] == "msg-1"

    def test_review_feedback_not_found(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.return_value = {'Items': []}
            response = client.put(
                "/admin/feedback/msg-404",
                json={"conversation_id": "conv-404", "sql_query": "SELECT * FROM table;", "user_id": "admin"}
            )
            assert response.status_code == 404

    def test_review_feedback_dynamodb_error(self):
        with patch('admin.routes.admin_feedback_routes.chat_feedback_table') as mock_table:
            mock_table.query.side_effect = Exception("DynamoDB error")
            response = client.put(
                "/admin/feedback/msg-1",
                json={"conversation_id": "conv-1", "sql_query": "SELECT * FROM table;", "user_id": "admin"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "error"
            assert "Failed to update feedback" in data["message"]