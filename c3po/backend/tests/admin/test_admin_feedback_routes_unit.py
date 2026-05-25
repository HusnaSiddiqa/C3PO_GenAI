import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

class TestAdminFeedbackRoutes:
    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_basic(self, mock_table):
        now = datetime.utcnow().isoformat()
        mock_table.query.return_value = {"Items": [
            {
                'feedback_created_at': now,
                'feedback_comment': 'Good',
                'feedback_rating': '5',
                'user_id': 'user1',
                'agent': 'C3PO',
                'feedback_prompt': 'Prompt',
                'feedback_response': 'Response',
                'feedback_sql_query': 'SELECT 1',
                'message_id': 'msg-1'
            }
        ]}
        from admin.routes.admin_feedback_routes import get_feedback

        result = get_feedback(
            search=None,
            user_id=None,
            rating=None,
            date_from=None,
            date_to=None,
            days=30
        )

        assert isinstance(result, list)
        assert result[0]['user_id'] == 'user1'
        assert result[0]['feedback'] == 'Good'

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_filters(self, mock_table):
        now = datetime.utcnow().isoformat()
        mock_table.query.return_value = {"Items": [
            {
                'feedback_created_at': now,
                'feedback_comment': 'Good',
                'feedback_rating': '5',
                'user_id': 'user1',
                'agent': 'C3PO',
                'feedback_prompt': 'Prompt',
                'feedback_response': 'Response',
                'feedback_sql_query': 'SELECT 1',
                'message_id': 'msg-1'
            },
            {
                'feedback_created_at': now,
                'feedback_comment': None,
                'feedback_rating': None,
                'user_id': 'user2',
                'agent': 'C3PO',
                'feedback_prompt': 'Prompt2',
                'feedback_response': 'Response2',
                'feedback_sql_query': 'SELECT 2',
                'message_id': 'msg-2'
            }
        ]}
        from admin.routes.admin_feedback_routes import get_feedback
        # Only items with feedback or rating are included
        result = get_feedback(
            search=None,
            user_id='user1',
            rating=None,
            date_from=None,
            date_to=None,
            days=30
        )
        assert len(result) == 1
        assert result[0]['user_id'] == 'user1'

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_search_and_date(self, mock_table):
        now = datetime.utcnow().isoformat()
        mock_table.query.return_value = {"Items": [
            {
                'feedback_created_at': now,
                'feedback_comment': 'Great job',
                'feedback_rating': '5',
                'user_id': 'user1',
                'agent': 'C3PO',
                'feedback_prompt': 'Prompt',
                'feedback_response': 'Response',
                'feedback_sql_query': 'SELECT 1',
                'message_id': 'msg-1'
            }
        ]}
        from admin.routes.admin_feedback_routes import get_feedback
        # Search by comment
        result = get_feedback(
            search='great',
            user_id=None,
            rating=None,
            date_from=None,
            date_to=None,
            days=30
        )
        assert len(result) == 1
        # Date range filter
        result = get_feedback(
            search=None,
            user_id=None,
            rating=None,
            date_from=now,
            date_to=now,
            days=30  # Pass days again
        )
        assert len(result) == 1

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_dynamodb_error(self, mock_table):
        mock_table.query.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_feedback_routes import get_feedback
        result = get_feedback(
            search=None,
            user_id=None,
            rating=None,
            date_from=None,
            date_to=None,
            days=30
        )
        assert isinstance(result, list)
        assert len(result) == 0  # Should return empty list on error

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_users(self, mock_table):
        mock_table.scan.return_value = {
            'Items': [
                {'user_id': 'user1'},
                {'user_id': 'user2'},
                {'user_id': 'user1'},
                {'user_id': None}
            ]
        }
        from admin.routes.admin_feedback_routes import get_feedback_users
        result = get_feedback_users()
        assert result == ['user1', 'user2']

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_users_dynamodb_error(self, mock_table):
        mock_table.scan.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_feedback_routes import get_feedback_users
        result = get_feedback_users()
        assert "mock-user-1" in result

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_detail_found(self, mock_table):
        mock_table.query.return_value = {
            'Items': [
                {
                    'user_id': 'user1',
                    'feedback_rating': '5',
                    'feedback_prompt': 'Prompt',
                    'agent': 'C3PO',
                    'feedback_response': 'Response',
                    'feedback_comment': 'Good',
                    'feedback_sql_query': 'SELECT 1'
                }
            ]
        }
        from admin.routes.admin_feedback_routes import get_feedback_detail
        result = get_feedback_detail('msg-1')
        assert result['user_id'] == 'user1'
        assert result['rating'] == '5'

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_detail_not_found(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        from admin.routes.admin_feedback_routes import get_feedback_detail
        with pytest.raises(Exception) as exc_info:
            get_feedback_detail('msg-404')
        assert "Feedback not found" in str(exc_info.value)

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_get_feedback_detail_dynamodb_error(self, mock_table):
        mock_table.query.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_feedback_routes import get_feedback_detail
        result = get_feedback_detail('msg-err')
        assert result['user_id'] == "mock-user"

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_review_feedback_success(self, mock_table):
        mock_table.query.return_value = {
            'Items': [
                {
                    'SK': 'MESSAGE#2025-07-10T12:00:00Z#msg-1',
                    'PK': 'CONV#1',
                    'message_id': 'msg-1',
                    'conversation_id': 'conv-1'
                }
            ]
        }
        mock_table.update_item.return_value = {"Attributes": {"feedback_sql_query": "SELECT 1"}}
        from admin.routes.admin_feedback_routes import review_feedback
        result = review_feedback('msg-1', 'SELECT 1', 'conv-1', 'admin')
        assert result['status'] == 'updated'
        assert result['message_id'] == 'msg-1'

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_review_feedback_not_found(self, mock_table):
        mock_table.query.return_value = {'Items': []}
        from admin.routes.admin_feedback_routes import review_feedback
        with pytest.raises(Exception) as exc_info:
            review_feedback('msg-404', 'SELECT 1', 'conv-404', 'admin')
        assert "Feedback entry not found" in str(exc_info.value)

    @patch('admin.routes.admin_feedback_routes.chat_feedback_table')
    def test_review_feedback_dynamodb_error(self, mock_table):
        mock_table.query.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_feedback_routes import review_feedback
        result = review_feedback('msg-err', 'SELECT 1', 'conv-err', 'admin')
        assert result['status'] == 'error'

    def test_review_feedback_no_sql_query(self):
        from admin.routes.admin_feedback_routes import review_feedback
        result = review_feedback('msg-1', '', 'conv-1', 'admin')
        assert result['status'] == 'no changes'