import pytest
import io
import csv

from fastapi import FastAPI
from fastapi.testclient import TestClient
from admin.routes.admin_clickable_routes import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestDownloadClickableQuestionsCSV:
    def test_download_clickable_questions_success(self, mocker):
        # Mock DynamoDB scan to return items
        items = [
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
        ]
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = [
            {"Items": items, "LastEvaluatedKey": None}
        ]
        response = client.get("/clickable-questions/download")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        content = response.content.decode()
        assert "question_id" in content
        assert "Q1" in content

    def test_download_clickable_questions_empty(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        response = client.get("/clickable-questions/download")
        assert response.status_code == 500
        assert "Error downloading clickable questions" in response.json()["detail"]

    def test_download_clickable_questions_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = Exception("DynamoDB error")
        response = client.get("/clickable-questions/download")
        assert response.status_code == 500
        assert "Error downloading clickable questions" in response.json()["detail"]


class TestUploadClickableQuestionsCSV:
    def test_upload_clickable_questions_success(self, mocker):
        # Prepare CSV content
        csv_content = "category,expected_answer,question,enabled,order\nGeneral,42,What is the answer?,true,1\n"
        file = io.BytesIO(csv_content.encode("utf-8"))
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        # Mock scan for delete
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        # Mock batch_writer context manager
        mock_batch = mocker.MagicMock()
        mock_table.batch_writer.return_value.__enter__.return_value = mock_batch

        response = client.post(
            "/clickable-questions/upload",
            data={"user_id": "admin"},
            files={"file": ("ground_truth.csv", file, "text/csv")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["inserted"] == 1

    def test_upload_clickable_questions_missing_field(self, mocker):
        csv_content = "category,question,enabled,order\nGeneral,What is the answer?,true,1\n"
        file = io.BytesIO(csv_content.encode("utf-8"))
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        mock_table.batch_writer.return_value.__enter__.return_value = mocker.MagicMock()
        response = client.post(
            "/clickable-questions/upload",
            data={"user_id": "admin"},
            files={"file": ("ground_truth.csv", file, "text/csv")}
        )
        assert response.status_code == 400
        assert "Missing mandatory field" in response.json()["detail"]

    def test_upload_clickable_questions_invalid_filetype(self):
        file = io.BytesIO(b"not a csv")
        response = client.post(
            "/clickable-questions/upload",
            data={"user_id": "admin"},
            files={"file": ("ground_truth.csv", file, "application/pdf")}
        )
        assert response.status_code == 400
        assert "File must be a CSV" in response.json()["detail"]

    def test_upload_clickable_questions_invalid_filename(self):
        file = io.BytesIO(b"category,expected_answer,question\nGeneral,42,What is the answer?\n")
        response = client.post(
            "/clickable-questions/upload",
            data={"user_id": "admin"},
            files={"file": ("not_ground_truth.csv", file, "text/csv")}
        )
        assert response.status_code == 400
        assert "File name must be ground_truth.csv" in response.json()["detail"]

    def test_upload_clickable_questions_dynamodb_error(self, mocker):
        csv_content = "category,expected_answer,question,enabled,order\nGeneral,42,What is the answer?,true,1\n"
        file = io.BytesIO(csv_content.encode("utf-8"))
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = Exception("DynamoDB error")
        response = client.post(
            "/clickable-questions/upload",
            data={"user_id": "admin"},
            files={"file": ("ground_truth.csv", file, "text/csv")}
        )
        assert response.status_code == 500
        assert "Error uploading clickable questions" in response.json()["detail"]


class TestGetClickableQuestions:
    def test_get_clickable_questions_success(self, mocker):
        items = [
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
        ]
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = [
            {"Items": items, "LastEvaluatedKey": None}
        ]
        response = client.get("/clickable-questions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["question_id"] == "Q1"
        assert data[0]["question"] == "What is X?"

    def test_get_clickable_questions_empty(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = [
            {"Items": [], "LastEvaluatedKey": None}
        ]
        response = client.get("/clickable-questions")
        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_get_clickable_questions_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.scan.side_effect = Exception("DynamoDB error")
        response = client.get("/clickable-questions")
        assert response.status_code == 500
        assert "Error fetching clickable questions" in response.json()["detail"]


class TestUpdateClickableQuestions:
    def test_update_clickable_question_success(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
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
        response = client.put("/clickable-questions/update", json={"questions": questions})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["updated_items"][0]["enabled"] is False

    def test_update_clickable_question_missing_fields(self):
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": None
        }]
        response = client.put("/clickable-questions/update", json={"questions": questions})
        assert response.status_code == 500
        assert "PK, SK, category, and enabled are required fields" in response.json()["detail"]

    def test_update_clickable_question_not_found(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.get_item.return_value = {"Item": None}
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": True
        }]
        response = client.put("/clickable-questions/update", json={"questions": questions})
        assert response.status_code == 500
        assert "not found" in response.json()["detail"]

    def test_update_clickable_question_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.admin_clickable_routes.clickable_questions_table')
        mock_table.get_item.side_effect = Exception("DynamoDB error")
        questions = [{
            "PK": "QUESTION#Q1",
            "SK": "CATEGORY#General",
            "category": "General",
            "enabled": True
        }]
        response = client.put("/clickable-questions/update", json={"questions": questions})
        assert response.status_code == 500
        assert "Error updating clickable questions" in response.json()["detail"]
