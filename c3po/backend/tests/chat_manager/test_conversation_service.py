#!/usr/bin/env python3
"""
Unit Tests for Conversation Service

This file contains comprehensive unit tests for all functions in conversation_service.py
including success cases, error cases, and edge cases.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from decimal import Decimal
import datetime
from fastapi import HTTPException

# Import the functions to test
from chat_manager.services.conversation_service import (
    fetch_all_instructions,
    fetch_schema_fields,
    extract_cleaned_result,
    fetch_onboarding_instructions,
    fetch_title_generation_prompt,
    generate_conversation_title,
    generate_title_on_message_count
)


class TestFetchAllInstructions:
    """Test cases for fetch_all_instructions function."""
    
    @pytest.mark.asyncio
    async def test_fetch_all_instructions_success(self):
        """Test successful fetching of all instructions."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {"category": "general_instructions", "description": "General app instructions"},
                {"category": "nlq_instructions", "description": "NLQ specific instructions"},
                {"category": "chart_instructions", "description": "Chart generation instructions"}
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_all_instructions()
            
        expected = {
            "general_instructions": "General app instructions",
            "nlq_instructions": "NLQ specific instructions", 
            "chart_instructions": "Chart generation instructions"
        }
        assert result == expected
        mock_table.scan.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_all_instructions_empty_response(self):
        """Test fetching instructions with empty response."""
        mock_table = Mock()
        mock_table.scan.return_value = {"Items": []}
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_all_instructions()
            
        assert result == {}
        mock_table.scan.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_all_instructions_missing_category(self):
        """Test fetching instructions with items missing category."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {"category": "general_instructions", "description": "General app instructions"},
                {"description": "Missing category"},  # Missing category
                {"category": "chart_instructions", "description": "Chart generation instructions"}
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_all_instructions()
            
        expected = {
            "general_instructions": "General app instructions",
            "chart_instructions": "Chart generation instructions"
        }
        assert result == expected
    
    @pytest.mark.asyncio
    async def test_fetch_all_instructions_missing_description(self):
        """Test fetching instructions with items missing description."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {"category": "general_instructions", "description": "General app instructions"},
                {"category": "nlq_instructions"},  # Missing description
                {"category": "chart_instructions", "description": "Chart generation instructions"}
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_all_instructions()
            
        expected = {
            "general_instructions": "General app instructions",
            "chart_instructions": "Chart generation instructions"
        }
        assert result == expected
    
    @pytest.mark.asyncio
    async def test_fetch_all_instructions_database_error(self):
        """Test fetching instructions with database error."""
        mock_table = Mock()
        mock_table.scan.side_effect = Exception("Database connection error")
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_all_instructions()
            
        assert result == {}
        mock_table.scan.assert_called_once()


class TestFetchSchemaFields:
    """Test cases for fetch_schema_fields function."""
    
    @pytest.mark.asyncio
    async def test_fetch_schema_fields_success(self):
        """Test successful fetching of schema fields."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {
                    "table_name": "sales_data",
                    "column_name": "product_name",
                    "metadata_type": "string",
                    "metadata_description": "Product name"
                },
                {
                    "table_name": "sales_data", 
                    "column_name": "sales_amount",
                    "metadata_type": "decimal",
                    "metadata_description": "Sales amount"
                },
                {
                    "table_name": "customer_data",
                    "column_name": "customer_id",
                    "metadata_type": "integer"
                }
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_schema_fields()
            
        expected = [
            "sales_data.product_name:string:Product name",
            "sales_data.sales_amount:decimal:Sales amount", 
            "customer_data.customer_id:integer"
        ]
        assert result == expected
        mock_table.scan.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_schema_fields_empty_response(self):
        """Test fetching schema fields with empty response."""
        mock_table = Mock()
        mock_table.scan.return_value = {"Items": []}
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_schema_fields()
                
        assert result == []
    
    @pytest.mark.asyncio
    async def test_fetch_schema_fields_missing_table_name(self):
        """Test fetching schema fields with items missing table_name."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {
                    "table_name": "sales_data",
                    "column_name": "product_name",
                    "metadata_type": "string"
                },
                {
                    "column_name": "sales_amount",  # Missing table_name
                    "metadata_type": "decimal"
                }
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_schema_fields()
            
        expected = ["sales_data.product_name:string"]
        assert result == expected
    
    @pytest.mark.asyncio
    async def test_fetch_schema_fields_missing_column_name(self):
        """Test fetching schema fields with items missing column_name."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {
                    "table_name": "sales_data",
                    "column_name": "product_name",
                    "metadata_type": "string"
                },
                {
                    "table_name": "sales_data",  # Missing column_name
                    "metadata_type": "decimal"
                }
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_schema_fields()
            
        expected = ["sales_data.product_name:string"]
        assert result == expected
    
    @pytest.mark.asyncio
    async def test_fetch_schema_fields_database_error(self):
        """Test fetching schema fields with database error."""
        mock_table = Mock()
        mock_table.scan.side_effect = Exception("Database connection error")
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_schema_fields()
            
        assert result == []


class TestExtractCleanedResult:
    """Test cases for extract_cleaned_result function."""
    
    def test_extract_cleaned_result_success(self):
        """Test successful extraction and cleaning of results."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": [
                            {
                                "parts": [
                                    {
                                        "root": {
                                            "text": "[{'name': 'Product A', 'price': 100.50, 'date': '2023-01-01'}]"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        expected = [{"name": "Product A", "price": 100.50, "date": "2023-01-01"}]
        assert result == expected
    
    def test_extract_cleaned_result_with_decimal(self):
        """Test extraction with Decimal values."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": [
                            {
                                "parts": [
                                    {
                                        "root": {
                                            "text": "[{'amount': 100.50, 'count': 5}]"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        expected = [{"amount": 100.50, "count": 5}]
        assert result == expected
    
    def test_extract_cleaned_result_with_datetime(self):
        """Test extraction with datetime values."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": [
                            {
                                "parts": [
                                    {
                                        "root": {
                                            "text": "[{'date': '2023-01-01', 'timestamp': '2023-01-01T12:00:00'}]"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        expected = [{"date": "2023-01-01", "timestamp": "2023-01-01T12:00:00"}]
        assert result == expected
    
    def test_extract_cleaned_result_nested_structure(self):
        """Test extraction with nested structure."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": [
                            {
                                "parts": [
                                    {
                                        "root": {
                                            "text": "[{'items': [{'name': 'Item 1', 'price': 10.50}], 'total': 10.50}]"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        expected = [{"items": [{"name": "Item 1", "price": 10.50}], "total": 10.50}]
        assert result == expected
    
    def test_extract_cleaned_result_invalid_json(self):
        """Test extraction with invalid JSON in text."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": [
                            {
                                "parts": [
                                    {
                                        "root": {
                                            "text": "invalid json content"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        assert result == []
    
    def test_extract_cleaned_result_missing_structure(self):
        """Test extraction with missing response structure."""
        results = {"invalid": "structure"}
        
        result = extract_cleaned_result(results)
        
        assert result == []
    
    def test_extract_cleaned_result_empty_artifacts(self):
        """Test extraction with empty artifacts."""
        results = {
            "response": {
                "root": {
                    "result": {
                        "artifacts": []
                    }
                }
            }
        }
        
        result = extract_cleaned_result(results)
        
        assert result == []


class TestFetchOnboardingInstructions:
    """Test cases for fetch_onboarding_instructions function."""
    
    @pytest.mark.asyncio
    async def test_fetch_onboarding_instructions_success(self):
        """Test successful fetching of onboarding instructions."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {"agent_description": "Welcome to the AI assistant. I can help you with various tasks."}
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_onboarding_instructions()
            
        expected = "Welcome to the AI assistant. I can help you with various tasks."
        assert result == expected
        mock_table.scan.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_onboarding_instructions_empty_response(self):
        """Test fetching onboarding instructions with empty response."""
        mock_table = Mock()
        mock_table.scan.return_value = {"Items": []}
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_onboarding_instructions()
            
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_fetch_onboarding_instructions_missing_agent_description(self):
        """Test fetching onboarding instructions with missing agent_description."""
        mock_table = Mock()
        mock_table.scan.return_value = {
            "Items": [
                {"other_field": "some value"}  # Missing agent_description
            ]
        }
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_onboarding_instructions()
            
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_fetch_onboarding_instructions_database_error(self):
        """Test fetching onboarding instructions with database error."""
        mock_table = Mock()
        mock_table.scan.side_effect = Exception("Database connection error")
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            result = await fetch_onboarding_instructions()
            
        assert result == []


class TestFetchTitleGenerationPrompt:
    """Test cases for fetch_title_generation_prompt function."""
    
    @pytest.mark.asyncio
    async def test_fetch_title_generation_prompt_success(self):
        """Test successful fetching of title generation prompt."""
        mock_prompt_content = "Generate a title for the following message: {message}"
        
        with patch('chat_manager.services.conversation_service.read_s3_file', return_value=mock_prompt_content):
            result = await fetch_title_generation_prompt("test-bucket", "prompts/title.txt")
            
        assert result == "Generate a title for the following message: {message}"
    
    @pytest.mark.asyncio
    async def test_fetch_title_generation_prompt_empty_content(self):
        """Test fetching title generation prompt with empty content."""
        with patch('chat_manager.services.conversation_service.read_s3_file', return_value=""):
            result = await fetch_title_generation_prompt("test-bucket", "prompts/title.txt")
            
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_fetch_title_generation_prompt_none_content(self):
        """Test fetching title generation prompt with None content."""
        with patch('chat_manager.services.conversation_service.read_s3_file', return_value=None):
            result = await fetch_title_generation_prompt("test-bucket", "prompts/title.txt")
            
        assert result == ""
    
    @pytest.mark.asyncio
    async def test_fetch_title_generation_prompt_s3_error(self):
        """Test fetching title generation prompt with S3 error."""
        with patch('chat_manager.services.conversation_service.read_s3_file', side_effect=Exception("S3 error")):
            result = await fetch_title_generation_prompt("test-bucket", "prompts/title.txt")
            
        assert result == ""


class TestGenerateConversationTitle:
    """Test cases for generate_conversation_title function."""
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_success(self):
        """Test successful title generation."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'MODEL_BASE_URL': 'https://api.openai.com',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        mock_prompt = "Generate a title for: {message}"
        mock_llm_response = Mock()
        mock_llm_response.content = "Generated Title"
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.ModelFactory.create_provider') as mock_factory, \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=mock_prompt):
            
            mock_provider = Mock()
            mock_llm = Mock()
            mock_llm.invoke.return_value = mock_llm_response
            mock_provider.get_llm.return_value = mock_llm
            mock_factory.return_value = mock_provider
            
            result = await generate_conversation_title("Test message")
            
        assert result == "Generated Title"
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_with_general_instructions(self):
        """Test title generation with general instructions."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'MODEL_BASE_URL': 'https://api.openai.com',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        mock_prompt = "Instructions: {general_instructions}\nGenerate a title for: {message}"
        mock_llm_response = Mock()
        mock_llm_response.content = "Generated Title with Instructions"
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.ModelFactory.create_provider') as mock_factory, \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=mock_prompt):
            
            mock_provider = Mock()
            mock_llm = Mock()
            mock_llm.invoke.return_value = mock_llm_response
            mock_provider.get_llm.return_value = mock_llm
            mock_factory.return_value = mock_provider
            
            result = await generate_conversation_title("Test message", "General instructions")
            
        assert result == "Generated Title with Instructions"
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_no_api_key(self):
        """Test title generation when API key is not found."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo'
        }
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=None):
            
            result = await generate_conversation_title("Test message")
            
        assert result == "Test message"
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_no_prompt(self):
        """Test title generation when prompt is not found."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=""):
            
            result = await generate_conversation_title("Test message")
            
        assert result == "Test message"
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_llm_error(self):
        """Test title generation when LLM invocation fails."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        mock_prompt = "Generate a title for: {message}"
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.ModelFactory.create_provider') as mock_factory, \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=mock_prompt):
            
            mock_provider = Mock()
            mock_llm = Mock()
            mock_llm.invoke.side_effect = Exception("LLM error")
            mock_provider.get_llm.return_value = mock_llm
            mock_factory.return_value = mock_provider
            
            result = await generate_conversation_title("Test message")
            
        assert result == "Test message"
    
    @pytest.mark.asyncio
    async def test_generate_conversation_title_empty_response(self):
        """Test title generation with empty LLM response."""
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        mock_prompt = "Generate a title for: {message}"
        mock_llm_response = Mock()
        mock_llm_response.content = ""
        
        with patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.ModelFactory.create_provider') as mock_factory, \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=mock_prompt):
            
            mock_provider = Mock()
            mock_llm = Mock()
            mock_llm.invoke.return_value = mock_llm_response
            mock_provider.get_llm.return_value = mock_llm
            mock_factory.return_value = mock_provider
            
            result = await generate_conversation_title("Test message")
            
        assert result == ""


class TestGenerateTitleOnMessageCount:
    """Test cases for generate_title_on_message_count function."""
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_success(self):
        """Test successful title generation on message count."""
        mock_table = Mock()
        mock_table.get_item.return_value = {
            "Item": {
                "title": "",
                "message_count": 1
            }
        }
        mock_table.query.return_value = {
            "Items": [
                {"summary": "First message"},
                {"summary": "Second message"}
            ]
        }
        
        mock_instructions = {"general_instructions": "General app instructions"}
        
        with patch('chat_manager.services.conversation_service.fetch_all_instructions', return_value=mock_instructions), \
             patch('chat_manager.services.conversation_service.generate_conversation_title', return_value="Generated Title"):
            
            result = await generate_title_on_message_count("test-conversation", mock_table)
            
        assert result == "Generated Title"
        mock_table.update_item.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_existing_title(self):
        """Test title generation when title already exists."""
        mock_table = Mock()
        mock_table.get_item.return_value = {
            "Item": {
                "title": "Existing Title",
                "message_count": 1
            }
        }
        mock_table.query.return_value = {
            "Items": [
                {"summary": "First message"}
            ]
        }
        
        mock_instructions = {"general_instructions": "General app instructions"}
        
        with patch('chat_manager.services.conversation_service.fetch_all_instructions', return_value=mock_instructions), \
             patch('chat_manager.services.conversation_service.generate_conversation_title', return_value="Generated Title"):
            
            result = await generate_title_on_message_count("test-conversation", mock_table)
            
        assert result == "Generated Title"
        mock_table.update_item.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_wrong_count(self):
        """Test title generation with wrong message count."""
        mock_table = Mock()
        mock_table.get_item.return_value = {
            "Item": {
                "title": "",
                "message_count": 5  # Not 1, 2, or 3
            }
        }
        
        result = await generate_title_on_message_count("test-conversation", mock_table)
        
        assert result is None
        mock_table.update_item.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_no_message_count(self):
        """Test title generation when message_count is not in metadata."""
        mock_table = Mock()
        mock_table.get_item.return_value = {
            "Item": {
                "title": ""
                # Missing message_count
            }
        }
        mock_table.query.return_value = {
            "Items": [
                {"summary": "First message"}
            ]
        }
        
        mock_instructions = {"general_instructions": "General app instructions"}
        
        with patch('chat_manager.services.conversation_service.fetch_all_instructions', return_value=mock_instructions), \
             patch('chat_manager.services.conversation_service.generate_conversation_title', return_value="Generated Title"):
            
            result = await generate_title_on_message_count("test-conversation", mock_table)
            
        assert result == "Generated Title"
        # Should call query to count messages
        mock_table.query.assert_called()
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_no_conversation(self):
        """Test title generation when conversation doesn't exist."""
        mock_table = Mock()
        mock_table.get_item.return_value = {"Item": {}}  # No conversation found
        
        result = await generate_title_on_message_count("test-conversation", mock_table)
        
        assert result is False
        mock_table.update_item.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_generate_title_on_message_count_database_error(self):
        """Test title generation with database error."""
        mock_table = Mock()
        mock_table.get_item.side_effect = Exception("Database error")
        
        result = await generate_title_on_message_count("test-conversation", mock_table)
        
        assert result is False


class TestIntegrationScenarios:
    """Integration test scenarios for conversation service."""
    
    @pytest.mark.asyncio
    async def test_full_title_generation_flow(self):
        """Test the complete title generation flow."""
        # Mock all dependencies
        mock_table = Mock()
        mock_table.get_item.return_value = {
            "Item": {
                "title": "",
                "message_count": 2
            }
        }
        mock_table.query.return_value = {
            "Items": [
                {"summary": "First user message"},
                {"summary": "Second user message"}
            ]
        }
        
        mock_env = {
            'SECRET_NAME': 'test-secret',
            'PROVIDER': 'openai',
            'MODEL': 'gpt-3.5-turbo',
            'WORKSPACE_BUCKET_NAME': 'test-bucket',
            'TITLE_GENERATION_PROMPT_KEY': 'prompts/title.txt'
        }
        
        mock_secret = "test-api-key"
        mock_prompt = "Generate a title for: {message}"
        mock_llm_response = Mock()
        mock_llm_response.content = "User Query Analysis"
        
        with patch('chat_manager.services.conversation_service.fetch_all_instructions', return_value={"general_instructions": "General instructions"}), \
             patch('chat_manager.services.conversation_service.load_env_variables', return_value=mock_env), \
             patch('chat_manager.services.conversation_service.get_secret', return_value=mock_secret), \
             patch('chat_manager.services.conversation_service.ModelFactory.create_provider') as mock_factory, \
             patch('chat_manager.services.conversation_service.fetch_title_generation_prompt', return_value=mock_prompt):
            
            mock_provider = Mock()
            mock_llm = Mock()
            mock_llm.invoke.return_value = mock_llm_response
            mock_provider.get_llm.return_value = mock_llm
            mock_factory.return_value = mock_provider
            
            result = await generate_title_on_message_count("test-conversation", mock_table)
            
        assert result == "User Query Analysis"
        mock_table.update_item.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_error_handling_integration(self):
        """Test error handling across multiple functions."""
        # Test that errors are properly handled and don't crash the application
        mock_table = Mock()
        mock_table.scan.side_effect = Exception("Database error")
        
        with patch('chat_manager.services.conversation_service.get_table', return_value=mock_table):
            # These should return empty/default values instead of crashing
            instructions_result = await fetch_all_instructions()
            schema_result = await fetch_schema_fields()
            onboarding_result = await fetch_onboarding_instructions()
            
        assert instructions_result == {}
        assert schema_result == []
        assert onboarding_result == []


if __name__ == "__main__":
    pytest.main([__file__])
