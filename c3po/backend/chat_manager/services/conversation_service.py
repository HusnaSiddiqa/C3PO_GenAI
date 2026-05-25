from utils.dynamodb import get_table
from utils.constants import INSTRUCTIONS_TABLE, SCHEMA_CONFIG_TABLE, ONBOARDING_TABLE 
from utils.s3 import read_s3_file
from fastapi import HTTPException
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
import ast
import datetime
from core.model_provider.factory import ModelFactory
from core.util.ConfigLoader import load_env_variables, get_secret

async def fetch_all_instructions():
    """
    Fetch all instructions from the DynamoDB table and return them by category.
    """
    try:
        table = get_table(INSTRUCTIONS_TABLE)
        response = table.scan()
        items = response.get("Items", [])

        instructions_by_category = {}
        for item in items:
            category = item.get("category")
            description = item.get("description")
            if category and description:
                instructions_by_category[category] = description

        return instructions_by_category

    except Exception as e:
        print(f"Error fetching instructions: {str(e)}")
        return {}
    
async def fetch_schema_fields():
    """
    Fetch schema fields from the oncology schema config table.
    """
    try:
        table = get_table(SCHEMA_CONFIG_TABLE)
        filter_expr = Attr("item_type").eq("column") & Attr("status").ne("deleted")

        items = []
        scan_kwargs = {"FilterExpression": filter_expr}
        while True:
            response = table.scan(**scan_kwargs)
            items.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

        if not items:
            raise HTTPException(status_code=404, detail="Schema fields not found")

        formatted_schema = []
        for item in items:
            if 'table_name' in item and 'column_name' in item:
                metadata_type = item.get('metadata_type', '')
                metadata_description = item.get('metadata_description', '')

                schema_item = f"{item['table_name']}.{item['column_name']}"
                if metadata_type:
                    schema_item += f":{metadata_type}"
                if metadata_description:
                    schema_item += f":{metadata_description}"

                formatted_schema.append(schema_item)
        return formatted_schema

    except Exception as e:
        print(f"Error fetching schema fields: {str(e)}")
        return []
    
def extract_cleaned_result(results: dict) -> list:
    """
    Extract and clean the list of result dictionaries from the nested 'results' payload.
    Handles Decimal and datetime.date formatting.
    Returns a clean list of dicts, safe to JSON serialize.
    """
    try:
        # Navigate to the text field
        raw_text = results["response"]["root"]["result"]["artifacts"][0]["parts"][0]["root"]["text"]
        print(f"Raw text from results: {raw_text}")

        # Safely evaluate the Python-literal-style list
        parsed_data = ast.literal_eval(raw_text)  # May raise SyntaxError or ValueError

        # Recursively clean up Decimal and datetime objects
        def clean(obj):
            if isinstance(obj, list):
                return [clean(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: clean(v) for k, v in obj.items()}
            elif isinstance(obj, Decimal):
                return float(obj)
            elif isinstance(obj, (datetime.date, datetime.datetime)):
                return obj.isoformat()
            return obj

        return clean(parsed_data)

    except Exception as e:
        print(f"Error parsing results: {e}")
        return []

# Fetch onboarding instructions and return the agent description
async def fetch_onboarding_instructions():
    """
    Fetch onboarding instructions from the DynamoDB table.
    """
    try:
        table = get_table(ONBOARDING_TABLE)
        response = table.scan()
        items = response.get("Items", [])
        return len(items) > 0 and items[0].get("agent_description", "") or ""
    except Exception as e:
        print(f"Error fetching onboarding instructions: {str(e)}")
        return []

async def fetch_title_generation_prompt(bucket: str, key: str) -> str:
    """
    Fetch the title generation prompt from S3.
    
    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key (path to the .txt file)
    
    Returns:
        str: The prompt content from the S3 file, or a default prompt if file not found
    """
    try:
        prompt_content = read_s3_file(bucket=bucket, key=key, file_format='text')
        
        if prompt_content:
            print(f"Prompt content from S3: {prompt_content}")
            return prompt_content.strip()
        else:
            # Fallback to default prompt if S3 file is not found or empty
            return ""
            
    except Exception as e:
        print(f"Error fetching title generation prompt from S3: {str(e)}")
        # Return default prompt on error
        return ""

# Generate title for conversation using message
async def generate_conversation_title(message: str, general_instructions: str = "") -> str:
    """
    Generate a title for a conversation using the message.
    
    Args:
        message (str): The user message to generate title from
        general_instructions (str, optional): General application instructions to include in the prompt
    """
    try:
        
        # Load environment variables
        env = load_env_variables()
        secret_name = env.get('SECRET_NAME', '')
        model_api_key = get_secret(secret_name) if secret_name else None
        
        if not model_api_key:
            print("Model API key not found, falling back to simple title generation")
            return message
        
        provider = env.get('PROVIDER', 'openai')
        model = env.get('MODEL', 'gpt-3.5-turbo')
        model_base_url = env.get('MODEL_BASE_URL', '')
        
        llm_provider = ModelFactory.create_provider(
            provider=provider, 
            model_name=model,
            base_url=model_base_url, 
            api_key=model_api_key
        )
        llm = llm_provider.get_llm()
        
        prompt_bucket = env.get('WORKSPACE_BUCKET_NAME', '')
        prompt_key = env.get('TITLE_GENERATION_PROMPT_KEY', 'system_prompts/title_generation_prompt.txt')
        prompt_template = await fetch_title_generation_prompt(bucket=prompt_bucket, key=prompt_key)
        
        if general_instructions:
            prompt = prompt_template.format(
                message=message,
                general_instructions=general_instructions
            )
        else:
            prompt = prompt_template.format(message=message)
        
        if prompt:
            response = llm.invoke(input=prompt)
            title = response.content.strip() if response and response.content else ""
        else:
            title = message
            
        print(f"Title generated by LLM: {title}")
        
        return title
        
    except Exception as e:
        print(f"Error generating conversation title with LLM: {str(e)}")
        return message

async def generate_title_on_message_count(conversation_id: str, table) -> str | None:
    """
    Generate a title for a conversation by analyzing the first 1, 2, or 3 messages.
    Uses message count from conversation metadata for efficiency.
    
    Args:
        conversation_id (str): The conversation ID
        table: DynamoDB table object
    
    Returns:
        str | None: Generated title if title was generated, None otherwise
    """
    try:
        conversation_response = table.get_item(
            Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"}
        )
        conversation_item = conversation_response.get("Item", {})
        current_title = conversation_item.get("title", "")
        
        message_count = conversation_item.get("message_count", 0)
        if message_count == 0:
            message_count_response = table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
                ExpressionAttributeValues={
                    ":pk": f"CONVERSATION#{conversation_id}",
                    ":sk_prefix": "MESSAGE#"
                }
            )
            message_count = len(message_count_response.get("Items", []))
        else:
            message_count = int(message_count)
        
        print(f"Conversation {conversation_id}: Found {message_count} messages")
        print(f"Conversation {conversation_id}: Current title is '{current_title}'")
        
        if message_count in [1, 2, 3]:
            print(f"Conversation {conversation_id}: Generating title on message {message_count}")
            
            instructions = await fetch_all_instructions()
            general_instructions = instructions.get("general_instructions", "")
            
            message_count_response = table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk_prefix)",
                FilterExpression="#type_attr = :type",
                ExpressionAttributeNames={
                    "#type_attr": "type"
                },
                ExpressionAttributeValues={
                    ":pk": f"CONVERSATION#{conversation_id}",
                    ":sk_prefix": "MESSAGE#",
                    ":type": "user_input"
                }
            )
            
            messages_to_analyze = message_count_response.get("Items", [])
            print(f"Conversation {conversation_id}: Messages to analyze: {messages_to_analyze}")
            combined_message = " ".join([msg.get("summary", "") for msg in messages_to_analyze])
            print(f"Conversation {conversation_id}: Analyzing {message_count} messages for title: {combined_message[:100]}...")
            
            generated_title = await generate_conversation_title(combined_message, general_instructions)
            
            table.update_item(
                Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"},
                UpdateExpression="SET title = :title",
                ExpressionAttributeValues={":title": generated_title}
            )
            print(f"Conversation {conversation_id}: Generated title: {generated_title}")
            return generated_title
        else:
            print(f"Conversation {conversation_id}: Not generating title (count={message_count}, title='{current_title}')")
            
        return None
        
    except Exception as e:
        print(f"Error generating title for conversation {conversation_id}: {str(e)}")
        return False