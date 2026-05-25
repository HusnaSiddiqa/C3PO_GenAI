from unittest.mock import patch, MagicMock, AsyncMock

import pytest


class TestDownloadClickableQuestionsCSV:
    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_download_clickable_questions_success(self, mock_table):
        # Mock scan to return items
        mock_table.scan.side_effect = [
            {"Items": [
                {
                    "PK": "QUESTION#Q1",
                    "SK": "CATEGORY#General",
                    "category": "General",
                    "question_id": "Q1",
                    "question": "What is X?",
                    "expected_answer": "X is ...",
                    "enabled": True,
                    "order": "1",
                    "sql_query": "SELECT * FROM X",
                    "updated_at": "2024-01-01T00:00:00Z",
                    "updated_by": "admin"
                }
            ], "LastEvaluatedKey": None}
        ]
        from admin.routes.admin_clickable_routes import download_clickable_questions_csv
        response = download_clickable_questions_csv()
        assert hasattr(response, "body_iterator")  # StreamingResponse

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_download_clickable_questions_empty(self, mock_table):
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        from admin.routes.admin_clickable_routes import download_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            download_clickable_questions_csv()
        assert "No clickable questions found" in str(exc_info.value)

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_download_clickable_questions_dynamodb_error(self, mock_table):
        mock_table.scan.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_clickable_routes import download_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            download_clickable_questions_csv()
        assert "Error downloading clickable questions" in str(exc_info.value)

class TestUploadClickableQuestionsCSV:
    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    @pytest.mark.asyncio
    async def test_upload_clickable_questions_success(self, mock_table):
        # Prepare CSV content
        csv_content = "category,expected_answer,question,enabled,order\nGeneral,42,What is the answer?,true,1\n"
        file = MagicMock()
        file.content_type = "text/csv"
        file.filename = "ground_truth.csv"
        file.read = AsyncMock(return_value=csv_content.encode("utf-8"))
        # Mock scan for delete
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        # Mock batch_writer context manager
        mock_batch = MagicMock()
        mock_table.batch_writer.return_value.__enter__.return_value = mock_batch

        from admin.routes.admin_clickable_routes import upload_clickable_questions_csv
        result = await upload_clickable_questions_csv(user_id="admin", file=file)
        assert result["status"] == "success"
        assert result["inserted"] == 1

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    @pytest.mark.asyncio
    async def test_upload_clickable_questions_missing_field(self, mock_table):
        csv_content = "category,question,enabled,order\nGeneral,What is the answer?,true,1\n"
        file = MagicMock()
        file.content_type = "text/csv"
        file.filename = "ground_truth.csv"
        file.read = AsyncMock(return_value=csv_content.encode("utf-8"))
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        mock_table.batch_writer.return_value.__enter__.return_value = MagicMock()
        from admin.routes.admin_clickable_routes import upload_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            await upload_clickable_questions_csv(user_id="admin", file=file)
        assert "Missing mandatory field" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_upload_clickable_questions_invalid_filetype(self):
        file = MagicMock()
        file.content_type = "application/pdf"
        file.filename = "ground_truth.csv"
        file.read = MagicMock(return_value=b"not a csv")
        from admin.routes.admin_clickable_routes import upload_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            await upload_clickable_questions_csv(user_id="admin", file=file)
        assert "File must be a CSV" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_upload_clickable_questions_invalid_filename(self):
        file = MagicMock()
        file.content_type = "text/csv"
        file.filename = "not_ground_truth.csv"
        file.read = MagicMock(return_value=b"category,expected_answer,question\nGeneral,42,What is the answer?\n")
        from admin.routes.admin_clickable_routes import upload_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            await upload_clickable_questions_csv(user_id="admin", file=file)
        assert "File name must be ground_truth.csv" in str(exc_info.value)

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    @pytest.mark.asyncio
    async def test_upload_clickable_questions_dynamodb_error(self, mock_table):
        csv_content = "category,expected_answer,question,enabled,order\nGeneral,42,What is the answer?,true,1\n"
        file = MagicMock()
        file.content_type = "text/csv"
        file.filename = "ground_truth.csv"
        file.read = MagicMock(return_value=csv_content.encode("utf-8"))
        mock_table.scan.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_clickable_routes import upload_clickable_questions_csv
        with pytest.raises(Exception) as exc_info:
            await upload_clickable_questions_csv(user_id="admin", file=file)
        assert "Error uploading clickable questions" in str(exc_info.value)

class TestGetClickableQuestions:
    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_get_clickable_questions_success(self, mock_table):
        mock_table.scan.side_effect = [
            {"Items": [
                {
                    "PK": "QUESTION#Q1",
                    "SK": "CATEGORY#General",
                    "category": "General",
                    "question_id": "Q1",
                    "question": "What is X?",
                    "expected_answer": "X is ...",
                    "enabled": True,
                    "order": "1",
                    "sql_query": "SELECT * FROM X"
                }
            ], "LastEvaluatedKey": None}
        ]
        from admin.routes.admin_clickable_routes import get_clickable_questions
        result = get_clickable_questions()
        assert isinstance(result, list)
        assert result[0]["question_id"] == "Q1"
        assert result[0]["question"] == "What is X?"

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_get_clickable_questions_empty(self, mock_table):
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        from admin.routes.admin_clickable_routes import get_clickable_questions
        result = get_clickable_questions()
        assert result == []

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_get_clickable_questions_dynamodb_error(self, mock_table):
        mock_table.scan.side_effect = Exception("DynamoDB error")
        from admin.routes.admin_clickable_routes import get_clickable_questions
        with pytest.raises(Exception) as exc_info:
            get_clickable_questions()
        assert "Error fetching clickable questions" in str(exc_info.value)

class TestUpdateClickableQuestions:
    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_update_clickable_question_success(self, mock_table):
        # Mock get_item to return an existing item
        mock_table.get_item.return_value = {
            "Item": {
                "PK": "QUESTION#Q1",
                "SK": "CATEGORY#General",
                "category": "General",
                "enabled": True
            }
        }
        mock_table.update_item.return_value = None
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": False
        }]
        from admin.routes.admin_clickable_routes import update_clickable_question
        result = update_clickable_question(questions=questions)
        assert result["status"] == "success"
        assert result["updated_items"][0]["enabled"] is False

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_update_clickable_question_missing_fields(self, mock_table):
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General"
            # enabled missing
        }]
        from admin.routes.admin_clickable_routes import update_clickable_question
        with pytest.raises(Exception) as exc_info:
            update_clickable_question(questions=questions)
        assert "required fields" in str(exc_info.value)

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_update_clickable_question_not_found(self, mock_table):
        mock_table.get_item.return_value = {"Item": None}
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": True
        }]
        from admin.routes.admin_clickable_routes import update_clickable_question
        with pytest.raises(Exception) as exc_info:
            update_clickable_question(questions=questions)
        assert "not found" in str(exc_info.value)

    @patch('admin.routes.admin_clickable_routes.clickable_questions_table')
    def test_update_clickable_question_dynamodb_error(self, mock_table):
        mock_table.get_item.side_effect = Exception("DynamoDB error")
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": True
        }]
        from admin.routes.admin_clickable_routes import update_clickable_question
        with pytest.raises(Exception) as exc_info:
            update_clickable_question(questions=questions)
        assert "Error updating clickable questions" in str(exc_info.value)