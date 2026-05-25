from unittest.mock import patch, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from admin.routes.admin_routes import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestAdminOnboardingEndpoint:
    def test_get_onboarding_success(self):
        sample_item = {
            "onboarding_id": "id-1",
            "agent_name": "AgentX",
            "agent_description": "Desc",
            "updated_by": "admin",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": [sample_item]}
            mock_get_table.return_value = mock_table

            response = client.get("/onboarding")
            assert response.status_code == 200
            data = response.json()
            assert data["onboarding_id"] == sample_item["onboarding_id"]

    def test_get_onboarding_not_found(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": []}
            mock_get_table.return_value = mock_table

            response = client.get("/onboarding")
            assert response.status_code == 500
            assert response.json()["detail"] == "DynamoDB error: 404: Onboarding data not found"

    def test_get_onboarding_dynamodb_error(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.get("/onboarding")
            assert response.status_code == 500

    def test_update_onboarding_success(self):
        request_data = {
            "onboarding_id": "id-1",
            "agent_name": "AgentX",
            "agent_description": "Desc",
            "updated_by": "admin"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.return_value = {"Items": [request_data]}
            mock_table.put_item.return_value = None
            mock_get_table.return_value = mock_table

            response = client.put("/onboarding", json=request_data)
            assert response.status_code == 200
            data = response.json()
            assert data["onboarding_id"] == request_data["onboarding_id"]

    def test_update_onboarding_dynamodb_error(self):
        request_data = {
            "onboarding_id": "id-1",
            "agent_name": "AgentX",
            "agent_description": "Desc",
            "updated_by": "admin"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.put("/onboarding", json=request_data)
            assert response.status_code == 500


class TestAdminInstructionsEndpoint:
    def test_get_instructions_success(self):
        sample_item = {
            "instruction_id": "inst-1",
            "category": "General",
            "description": "desc",
            "updated_by": "admin",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": [sample_item]}
            mock_get_table.return_value = mock_table

            response = client.get("/instructions")
            assert response.status_code == 200
            data = response.json()
            assert data[0]["instruction_id"] == sample_item["instruction_id"]

    def test_get_instructions_not_found(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": []}
            mock_get_table.return_value = mock_table

            response = client.get("/instructions")
            assert response.status_code == 500
            assert "Error retrieving instructions: 404: Instructions not found" in response.json()["detail"]

    def test_get_instructions_dynamodb_error(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.get("/instructions")
            assert response.status_code == 500

    def test_update_instructions_success(self):
        request_data = {
            "instruction_id": "inst-1",
            "category": "General",
            "description": "desc",
            "updated_by": "admin"
        }
        existing_item = {
            "instruction_id": "inst-1",
            "category": "General"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.return_value = {"Items": [existing_item]}
            mock_table.put_item.return_value = None
            mock_get_table.return_value = mock_table

            response = client.put("/instructions", json=request_data)
            assert response.status_code == 200
            data = response.json()
            assert data["instruction_id"] == request_data["instruction_id"]

    def test_update_instructions_not_found(self):
        request_data = {
            "instruction_id": "inst-1",
            "category": "General",
            "description": "desc",
            "updated_by": "admin"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.return_value = {"Items": []}
            mock_get_table.return_value = mock_table

            response = client.put("/instructions", json=request_data)
            assert response.status_code == 500
            assert "DynamoDB error: 404: Instructions data not found" in response.json()["detail"]

    def test_update_instructions_dynamodb_error(self):
        request_data = {
            "instruction_id": "inst-1",
            "category": "General",
            "description": "desc",
            "updated_by": "admin"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.query.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.put("/instructions", json=request_data)
            assert response.status_code == 500


class TestAdminPromptTemplateEndpoints:
    def test_get_agent_prompt_template_success(self):
        agent_item = {"KeyId": "agent-1", "value": "AgentX", "type": "agent"}
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": [agent_item]}
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/agents")
            assert response.status_code == 200
            data = response.json()
            assert data["agents"][0]["id"] == agent_item["KeyId"]

    def test_get_agent_prompt_template_not_found(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": []}
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/agents")
            assert response.status_code == 500
            assert response.json()["detail"] == "Error retrieving agents: 404: No agents found"

    def test_get_agent_prompt_template_dynamodb_error(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/agents")
            assert response.status_code == 500

    def test_create_prompt_template_agent_not_found(self):
        agent_id = "agent-1"
        request_data = {
            "agent_id": agent_id,
            "model": "model-1",
            "prompt": "Prompt text",
            "temperature": "0.7",
            "user_id": "test-user"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table, \
             patch('utils.mlflow_agents.create_prompt') as mock_create_prompt:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": []}
            mock_get_table.return_value = mock_table
            mock_create_prompt.return_value = {"prompt": "test", "version": "1"}

            response = client.put(f"/prompt-template/{agent_id}", json=request_data)
            assert response.status_code == 404
            assert "No agents found" in response.json()["detail"]

    def test_create_prompt_template_model_not_found(self):
        agent_id = "agent-1"
        request_data = {
            "agent_id": agent_id,
            "model": "model-2",
            "prompt": "Prompt text",
            "temperature": "0.7",
            "user_id": "test-user"
        }
        agent_item = {"KeyId": agent_id, "value": "AgentX", "type": "agent"}
        with patch('admin.routes.admin_routes.get_table') as mock_get_table, \
             patch('utils.mlflow_agents.create_prompt') as mock_create_prompt:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": [agent_item]}
            mock_get_table.return_value = mock_table
            mock_create_prompt.return_value = {"prompt": "test", "version": "1"}

            response = client.put(f"/prompt-template/{agent_id}", json=request_data)
            assert response.status_code == 404
            assert "Model model-2 not found" in response.json()["detail"]

    def test_create_prompt_template_dynamodb_error(self):
        agent_id = "agent-1"
        request_data = {
            "agent_id": agent_id,
            "model": "model-1",
            "prompt": "Prompt text",
            "temperature": "0.7",
            "user_id": "test-user"
        }
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.put(f"/prompt-template/{agent_id}", json=request_data)
            assert response.status_code == 500

    def test_get_prompt_template_by_version(self):
        agent = "AgentX"
        version = "1"
        with patch('admin.routes.admin_routes.mlflow_agents.get_prompt') as mock_get_prompt:
            mock_get_prompt.return_value = {
                "agent": agent,
                "prompt": "Prompt text",
                "version_alias": version,
                "model": "model-1",
                "temperature": "0.7"
            }
            response = client.get(f"/prompt-template/{agent}/{version}")
            assert response.status_code == 200
            data = response.json()
            assert data["version_alias"] == version

    def test_get_latest_prompt_template(self):
        agent = "AgentX"
        agent_id = "1"

        with patch('admin.routes.admin_routes.mlflow_agents.get_latest_prompt') as mock_get_latest:
            mock_get_latest.return_value = {
                "agent_id": agent_id,
                "prompt": "Prompt text",
                "version_alias": "2",
                "model": "model-1",
                "temperature": "0.7",
                "versions": ["1", "2"]
            }
            response = client.get(f"/prompt-template/agent-versions/latest/{agent}")
            assert response.status_code == 200
            data = response.json()
            assert data["version_alias"] == "2"

    def test_get_available_models_success(self):
        model_item = {"type": "model", "value": "model-1"}
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": [model_item]}
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/models")
            assert response.status_code == 200
            data = response.json()
            assert "model-1" in data

    def test_get_available_models_not_found(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.return_value = {"Items": []}
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/models")
            assert response.status_code == 500
            assert response.json()["detail"] == "Error retrieving models: 404: No models found"

    def test_get_available_models_dynamodb_error(self):
        with patch('admin.routes.admin_routes.get_table') as mock_get_table:
            mock_table = MagicMock()
            mock_table.scan.side_effect = Exception("DynamoDB error")
            mock_get_table.return_value = mock_table

            response = client.get("/prompt-template/models")
            assert response.status_code == 500
