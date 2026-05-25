import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

class TestAdminOnboardingLogic:
    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_onboarding_success(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            "Items": [{
                "onboarding_id": "id-1",
                "agent_name": "AgentX",
                "agent_description": "Desc",
                "updated_by": "admin",
                "updated_at": "2024-01-01T00:00:00Z"
            }]
        }
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_onboarding
        result = await get_onboarding()
        assert result.onboarding_id == "id-1"
        assert result.agent_name == "AgentX"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_onboarding_not_found(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_onboarding
        with pytest.raises(Exception) as exc_info:
            await get_onboarding()
        assert "Onboarding data not found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_onboarding_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_onboarding
        with pytest.raises(Exception) as exc_info:
            await get_onboarding()
        assert "DynamoDB error" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @patch('admin.routes.admin_routes.generate_id', return_value="new-id")
    @pytest.mark.asyncio
    async def test_update_onboarding_insert(self, mock_generate_id, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": []}
        mock_table.put_item.return_value = None
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_onboarding, OnboardingUpdateRequest
        req = OnboardingUpdateRequest(
            agent_name="AgentX",
            agent_description="Desc",
            updated_by="admin"
        )
        result = await update_onboarding(req)
        assert result.onboarding_id == "new-id"
        assert result.agent_name == "AgentX"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_update_onboarding_update(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": [{"onboarding_id": "id-1"}]}
        mock_table.put_item.return_value = None
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_onboarding, OnboardingUpdateRequest
        req = OnboardingUpdateRequest(
            onboarding_id="id-1",
            agent_name="AgentX",
            agent_description="Desc",
            updated_by="admin"
        )
        result = await update_onboarding(req)
        assert result.onboarding_id == "id-1"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_update_onboarding_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_onboarding, OnboardingUpdateRequest
        req = OnboardingUpdateRequest(
            onboarding_id="id-1",
            agent_name="AgentX",
            agent_description="Desc",
            updated_by="admin"
        )
        with pytest.raises(Exception) as exc_info:
            await update_onboarding(req)
        assert "DynamoDB error" in str(exc_info.value)

class TestAdminInstructionsLogic:
    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_instructions_success(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {
            "Items": [{
                "instruction_id": "inst-1",
                "category": "General",
                "description": "desc",
                "updated_by": "admin",
                "updated_at": "2024-01-01T00:00:00Z"
            }]
        }
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_instructions
        result = await get_instructions()
        assert result[0].instruction_id == "inst-1"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_instructions_not_found(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_instructions
        with pytest.raises(Exception) as exc_info:
            await get_instructions()
        assert "Instructions not found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_instructions_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_instructions
        with pytest.raises(Exception) as exc_info:
            await get_instructions()
        assert "Error retrieving instructions" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_update_instructions_success(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": [{"instruction_id": "inst-1", "category": "General"}]}
        mock_table.put_item.return_value = None
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_instructions, InstructionsUpdateRequest
        req = InstructionsUpdateRequest(
            instruction_id="inst-1",
            category="General",
            description="desc",
            updated_by="admin"
        )
        result = await update_instructions(req)
        assert result.instruction_id == "inst-1"
        assert result.category == "General"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_update_instructions_not_found(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_instructions, InstructionsUpdateRequest
        req = InstructionsUpdateRequest(
            instruction_id="inst-1",
            category="General",
            description="desc",
            updated_by="admin"
        )
        with pytest.raises(Exception) as exc_info:
            await update_instructions(req)
        assert "Instructions data not found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_update_instructions_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.query.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import update_instructions, InstructionsUpdateRequest
        req = InstructionsUpdateRequest(
            instruction_id="inst-1",
            category="General",
            description="desc",
            updated_by="admin"
        )
        with pytest.raises(Exception) as exc_info:
            await update_instructions(req)
        assert "DynamoDB error" in str(exc_info.value)

class TestAdminPromptTemplateLogic:
    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_agent_prompt_template_success(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": [{"KeyId": "agent-1", "value": "AgentX", "type": "agent"}]}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_agent_prompt_template
        result = await get_agent_prompt_template()
        assert result.agents[0].id == "agent-1"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_agent_prompt_template_not_found(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_agent_prompt_template
        with pytest.raises(Exception) as exc_info:
            await get_agent_prompt_template()
        assert "No agents found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_agent_prompt_template_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_agent_prompt_template
        with pytest.raises(Exception) as exc_info:
            await get_agent_prompt_template()
        assert "Error retrieving agents" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @patch('admin.routes.admin_routes.mlflow_agents.create_prompt')
    @pytest.mark.asyncio
    async def test_create_prompt_template_agent_not_found(self, mock_create_prompt, mock_get_table):
        agent_id = "agent-1"
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import create_prompt_template, CreatePromptRequest
        req = CreatePromptRequest(
            agent_id=agent_id,
            model="model-1",
            temperature="0.5",
            prompt="Prompt text",
            user_id="test-user"
        )
        with pytest.raises(Exception) as exc_info:
            await create_prompt_template(agent_id, req)
        assert "No agents found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @patch('admin.routes.admin_routes.mlflow_agents.create_prompt')
    @pytest.mark.asyncio
    async def test_create_prompt_template_model_not_found(self, mock_create_prompt, mock_get_table):
        agent_id = "agent-1"
        agent_item = {"KeyId": agent_id, "value": "AgentX", "type": "agent"}
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": [agent_item]}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import create_prompt_template, CreatePromptRequest
        req = CreatePromptRequest(
            agent_id=agent_id,
            model="model-1",
            temperature="0.5",
            prompt="Prompt text",
            user_id="test-user"
        )
        with pytest.raises(Exception) as exc_info:
            await create_prompt_template(agent_id, req)
        assert "Model model-1 not found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @patch('admin.routes.admin_routes.mlflow_agents.create_prompt')
    @pytest.mark.asyncio
    async def test_create_prompt_template_success(self, mock_create_prompt, mock_get_table):
        agent_id = "agent-1"
        agent_item = {"KeyId": agent_id, "value": "AgentX", "type": "agent"}
        model_item = {"type": "model", "value": "model-1", "base_url": "url"}
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": [agent_item, model_item]}
        mock_get_table.return_value = mock_table
        mock_create_prompt.return_value = {"prompt": "Prompt text", "version": "1"}

        from admin.routes.admin_routes import create_prompt_template, CreatePromptRequest
        req = CreatePromptRequest(
            agent_id=agent_id,
            model="model-1",
            temperature="0.5",
            prompt="Prompt text",
            user_id="test-user"
        )
        result = await create_prompt_template(agent_id, req)
        assert result["version"] == "1"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_create_prompt_template_dynamodb_error(self, mock_get_table):
        agent_id = "agent-1"
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import create_prompt_template, CreatePromptRequest
        req = CreatePromptRequest(
            agent_id=agent_id,
            model="model-1",
            temperature="0.5",
            prompt="Prompt text",
            user_id="test-user"
        )
        with pytest.raises(Exception) as exc_info:
            await create_prompt_template(agent_id, req)
        assert "Error retrieving agents" in str(exc_info.value)

    @patch('admin.routes.admin_routes.mlflow_agents.get_prompt')
    @pytest.mark.asyncio
    async def test_get_prompt_template_by_version(self, mock_get_prompt):
        mock_get_prompt.return_value = {"prompt": "Prompt text", "version": "1"}
        from admin.routes.admin_routes import get_prompt_template_by_version
        result = await get_prompt_template_by_version("AgentX", "1")
        assert result["version"] == "1"

    @patch('admin.routes.admin_routes.mlflow_agents.get_latest_prompt')
    @pytest.mark.asyncio
    async def test_get_latest_prompt_template(self, mock_get_latest):
        mock_get_latest.return_value = {"prompt": "Prompt text", "version": "2"}
        from admin.routes.admin_routes import get_latest_prompt_template
        result = await get_latest_prompt_template("AgentX")
        assert result["version"] == "2"

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_available_models_success(self, mock_get_table):
        model_item = {"type": "model", "value": "model-1"}
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": [model_item]}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_available_models
        result = await get_available_models()
        assert "model-1" in result

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_available_models_not_found(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_available_models
        with pytest.raises(Exception) as exc_info:
            await get_available_models()
        assert "No models found" in str(exc_info.value)

    @patch('admin.routes.admin_routes.get_table')
    @pytest.mark.asyncio
    async def test_get_available_models_dynamodb_error(self, mock_get_table):
        mock_table = MagicMock()
        mock_table.scan.side_effect = Exception("DynamoDB error")
        mock_get_table.return_value = mock_table

        from admin.routes.admin_routes import get_available_models
        with pytest.raises(Exception) as exc_info:
            await get_available_models()
        assert "Error retrieving models" in str(exc_info.value)