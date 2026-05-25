import os
import re
import json
import asyncio
import logging
from datetime import datetime
from uuid import uuid4
import mimetypes

import boto3

from fastapi import APIRouter, Path, HTTPException, Form, File, UploadFile, Request, Depends
from fastapi.responses import StreamingResponse
from opentelemetry import trace
from opentelemetry.context import get_current
from opentelemetry.propagate import inject
from traceloop_wrapper import initialize_traceloop
from utils.constants import (
    CONVERSATION_STORE_TABLE,
    BYOD_FILES_TABLE,
    mock_stream_message,
)
from utils.dynamodb import get_table
from utils.s3 import list_s3_objects, stream_s3_csv_parts_as_one, upload_to_s3, stream_from_s3
from ..services.conversation_service import (
    fetch_all_instructions,
    fetch_schema_fields,
    fetch_onboarding_instructions,
    generate_conversation_title,
    generate_title_on_message_count
)

from ..models.conversation import (
    ConversationRequest,
    ConversationStatusUpdateResponse,
    RenameTitleRequest,
    RenameTitleResponse,
    StatusUpdateRequest,
)
import httpx
from boto3.dynamodb.conditions import Key

from a2a.client import A2ACardResolver, A2AClient
from a2a.types import (
    MessageSendParams,
    SendStreamingMessageRequest,
)
from core.util.ConfigLoader import get_secret, load_env_variables

# Import helper functions
from .conversation_helpers import (
    validate_conversation_request,
    validate_file_upload,
    check_existing_files,
    create_payload,
    yield_error,
    yield_title_update,
    handle_task_submitted,
    handle_status_update,
    handle_artifact_update,
    handle_delta_update
)

env = load_env_variables()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
BUCKET_NAME = os.getenv("WORKSPACE_BUCKET_NAME")
AGENT_BASE_URL = os.getenv("AGENT_BASE_URL", "0.0.0.0")
AGENT_BASE_PORT = os.getenv("AGENT_BASE_PORT", "8001")


OVERRIDE_AGENT_DECISION = [agent
                           for agent in env.get('OVERRIDE_AGENT_DECISION', '').split(',')
                           if agent]

# Pre-compile regex patterns for better performance
AGENT_ROUTING_PATTERN = re.compile(r"routed the request to: \[(.*?)\]")
CONTENT_PATTERN = re.compile(r"content='(.*?)'\s+additional_kwargs=", re.DOTALL)

s3_client = boto3.client('s3')

@router.post("/query-stream")
async def handle_conversation(request: ConversationRequest):
    """Handle conversation streaming endpoint."""
    try:
        validate_conversation_request(request)
        
        now = datetime.utcnow().isoformat() + "Z"
        table = get_table(CONVERSATION_STORE_TABLE)
        instructions = await fetch_all_instructions()
        general_instructions = instructions.get("general_instructions", "")
        
        # Handle conversation creation / lookup
        if request.conversation_id:
            conversation_id = request.conversation_id
            response = table.get_item(
                Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"}
            )
            if not response.get("Item"):
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Update last_updated and query conversation
            table.update_item(
                Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"},
                UpdateExpression="SET last_updated = :last_updated",
                ExpressionAttributeValues={":last_updated": now}
            )
            
            # Query existing messages
            messages_response = table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues={
                    ":pk": f"CONVERSATION#{conversation_id}",
                    ":sk": "MESSAGE#"
                }
            )
            existing_messages = messages_response.get("Items", [])
        else:
            # Create new conversation
            conversation_id = str(uuid4())
            title = await generate_conversation_title(request.message, general_instructions)
            
            table.put_item(
                Item={
                    "PK": f"CONVERSATION#{conversation_id}",
                    "SK": "META",
                    "conversation_id": conversation_id,
                    "user_id": request.user_id,
                    "title": title,
                    "status": "active",
                    "created_at": now,
                    "last_updated": now,
                    "benchmarking": request.benchmarking,
                    "message_count": 0  # Initialize message counter
                }
            )
            existing_messages = []

        # Link uploaded file (if present)
        file_id = None
        file_items = []
        file_table = get_table(BYOD_FILES_TABLE)
        if request.file:
            # First try to get the file by file_id
            file_response = file_table.query(
                KeyConditionExpression="PK = :pk AND SK = :sk",
                ExpressionAttributeValues={
                    ":pk": f"FILE#{request.file.file_id}",
                    ":sk": "META",
                },
            )
            file_items = file_response.get("Items", [])
            if file_items:
                file_id = file_items[0].get("file_id")
            # Update the file to link it to this conversation
            file_table.update_item(
                Key={"PK": f"FILE#{request.file.file_id}", "SK": "META"},
                UpdateExpression="SET conversation_id = :conversation_id, last_updated = :last_updated, #type_attr = :type",
                ExpressionAttributeNames={
                    "#type_attr": "type"
                },
                ExpressionAttributeValues={
                    ":conversation_id": conversation_id,
                    ":last_updated": now,
                    ":type": "BYOD"
                },
            )

        # Save user message
        user_msg_id = str(uuid4())
        user_message_payload = create_payload(
            conversation_id,
            type="user_input",
            summary=request.message,
            prev_message_id=None,
            role="user",
            file_id=request.file.file_id if request.file else None,
            user_id=request.user_id,
            last_updated=now,
            created_at=now,
            timestamp=now,
            message_id=user_msg_id
        )
        table.put_item(Item=user_message_payload)

        # Update message count in conversation metadata
        try:
            # Use conditional update to handle both new and existing message_count fields
            table.update_item(
                Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"},
                UpdateExpression="SET message_count = if_not_exists(message_count, :zero) + :inc",
                ExpressionAttributeValues={":zero": 0, ":inc": 1}
            )
        except Exception as e:
            logger.error(f"Error updating message count: {str(e)}")
            
        generated_title = await generate_title_on_message_count(conversation_id, table)

        # Initialize orchestrator streaming client
        base_url = f'http://{AGENT_BASE_URL}:{AGENT_BASE_PORT}/v2/agents/orchestrator'
        httpx_client = httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(1000))
        
        try:
            resolver = A2ACardResolver(httpx_client=httpx_client, base_url=base_url)
            agent_card = await resolver.get_agent_card()
            client = A2AClient(httpx_client=httpx_client, agent_card=agent_card)
        except Exception as e:
            now2 = datetime.utcnow().isoformat() + "Z"
            logger.error(f"Error connecting to orchestrator: {str(e)}")
            # Return error response
            error_msg_id = str(uuid4())
            error_payload = create_payload(
                conversation_id,
                role="system",
                type="error",
                message_id=error_msg_id,
                timestamp=datetime.utcnow().isoformat() + "Z",
                stage="error",
                error_type="connection",
                error_message=f"Failed to connect to orchestrator: {str(e)}",
            )
            table.put_item(Item=error_payload)
            return StreamingResponse(
                iter([json.dumps(error_payload) + "\n"]), 
                media_type="application/json"
            )
        
        # Fetch instructions for agent metadata (reuse if already fetched)
        business_rules = instructions.get("business_rules", "")
        data_handling_rules = instructions.get("data_handling_rules", "")
        schema_config = await fetch_schema_fields()
        # file_items is already defined above
        message_id = str(uuid4())
        onboarding = await fetch_onboarding_instructions()

        # Determine document_s3_path from file_items
        document_s3_path = None
        if file_items:
            # Get the first file's s3_path
            document_s3_path = file_items[0].get("s3_path")
            logger.info(f"Found document_s3_path: {document_s3_path}")
        else:
            logger.info(f"No files found for conversation {conversation_id}")

        try:
            payload = MessageSendParams(
                message={
                    "role": "user",
                    "messageId": message_id,
                    "parts": [{"text": request.message}],
                },
                metadata={
                    "user_id": request.user_id,
                    "conversation_id": conversation_id,
                    "general_instructions": general_instructions,
                    "common_business_rules": business_rules,
                    "data_handling_rules": data_handling_rules,
                    "fields": schema_config,
                    "document_s3_path": document_s3_path,
                    "onboarding": onboarding,
                    "selected_source": request.selected_source,
                    "thinking_enabled": request.thinking_enabled or False,
                },
            )
            logger.debug('===========payload=======', payload)
            streaming_request = SendStreamingMessageRequest(id=str(uuid4()), params=payload)
            tracer = trace.get_tracer("AgentTracing")
            application_name = os.getenv("APPLICATION_NAME")
            initialize_traceloop(app_name=f"{application_name}_Chat_Manager", endpoint=os.getenv("DYNATRACE_ENDPOINT"),
                                 auth_token=get_secret(os.getenv('APP_SECRET_NAME'))['DYNATRACE_AUTH'])
            headers_out = {
                "user_id": request.user_id,
                "conversation_id": conversation_id
            }
            with tracer.start_as_current_span(f"{application_name}_Chat_Manager") as span:

                span.set_attribute("user.id", request.user_id)
                span.set_attribute("conversation.id", conversation_id)

                trace_id = span.get_span_context().trace_id
                span_id = span.get_span_context().span_id

                logger.info(f"[Chat Manager] Trace ID: {trace_id}")
                logger.info(f"[Chat Manager] Parent Span ID: {span_id}")


                inject(headers_out, context=get_current())

                logger.debug('=============headers_out===========', headers_out)
                stream_response = client.send_message_streaming(streaming_request, http_kwargs={"timeout": 1000, "headers": headers_out})
        except Exception as e:
            now2 = datetime.utcnow().isoformat() + "Z"
            logger.error(f"Error creating streaming request: {str(e)}")
            # Return error response
            error_msg_id = str(uuid4())
            error_payload = create_payload(
                conversation_id,
                role="system",
                type="error",
                message_id=error_msg_id,
                timestamp=datetime.utcnow().isoformat() + "Z",
                stage="error",
                error_type="request_creation",
                error_message=f"Failed to create streaming request: {str(e)}",
            )
            table.put_item(Item=error_payload)
            await httpx_client.aclose()
            return StreamingResponse(
                iter([json.dumps(error_payload) + "\n"]), 
                media_type="application/json"
            )

        # Async generator for streaming

        async def response_streamer():
            """Stream response generator."""
            now2 = datetime.utcnow().isoformat() + "Z"
            # Capture generated_title for use in the stream
            title_to_update = generated_title
            full_response = ""
            routing_sent = False
            message_summary = ""
            message_results = []
            selected_agents = OVERRIDE_AGENT_DECISION
            message_type = "summary"
            error_occurred = False
            error_message = ""
            artifact_received = False
            agents_called = False

            try:
                # Send title update if title was generated
                if title_to_update:
                    yield yield_title_update(conversation_id, title_to_update)
                    
                async for chunk in stream_response:
                    logger.debug(f"Processing chunk: {chunk}")
                    print("+++++++++++++chunk+++++++++++++", chunk)
                    try:
                        data = chunk.model_dump(mode="json", exclude_none=True)
                        result = data.get("result", {})
                        kind = result.get("kind")

                        # 1. Task submitted - Show thinking state
                        if kind == "task" and result.get("status", {}).get("state") == "submitted":
                            yield handle_task_submitted(table, conversation_id)

                        # 2. Status updates - Handle routing and working states
                        elif kind == "status-update":
                            yield_data, selected_agents = handle_status_update(result, table, conversation_id, selected_agents, request.user_id)
                            if yield_data:
                                yield yield_data
                            # Track if agents were called (agents are selected during status updates)
                            if selected_agents:
                                agents_called = True

                        # 3. Artifact updates - Handle final responses
                        elif kind == "artifact-update":
                            artifact_received = True
                            yield_data, full_response = handle_artifact_update(
                                result, table, conversation_id, selected_agents, full_response, user_msg_id, request.user_id
                            )
                            if yield_data:
                                yield yield_data

                        # 4. Delta stream - Handle real-time streaming
                        elif "delta" in data:
                            yield_data = handle_delta_update(data, full_response)
                            if yield_data:
                                yield yield_data

                        # 5. Error handling
                        elif "error" in data:
                            error_msg = data.get("error", "Unknown error")
                            yield yield_error(table, conversation_id, error_msg, "streaming_error")

                    except Exception as e:
                        logger.error(f"Error processing chunk: {str(e)}")
                        yield yield_error(table, conversation_id, f"Error processing chunk: {str(e)}", "chunk_processing")

            except httpx.TimeoutException as e:
                logger.warning(f"Timeout error in stream processing: {str(e)}")
                yield yield_error(table, conversation_id, f"Request timed out after 120 seconds: {str(e)}", "timeout")
            except httpx.ConnectError as e:
                logger.warning(f"Connection error in stream processing: {str(e)}")
                yield yield_error(table, conversation_id, f"Failed to connect to orchestrator: {str(e)}", "connection")
            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP error in stream processing: {str(e)}")
                yield yield_error(table, conversation_id, f"HTTP error from orchestrator: {str(e)}", "http_error")
            except Exception as e:
                logger.error(f"Error in stream processing: {str(e)}")
                yield yield_error(table, conversation_id, f"Stream processing error: {str(e)}", "stream_error")
            
            finally:
                # Check if stream ended without artifact update and no agents were called
                if not artifact_received and not agents_called and not error_occurred:
                    logger.warning(f"Stream ended without artifact update and no agents were called for conversation {conversation_id}")
                    yield yield_error(
                        table, 
                        conversation_id, 
                        "Stream ended unexpectedly without processing any agents or receiving a response", 
                        "incomplete_stream"
                    )
                
                await httpx_client.aclose()

        return StreamingResponse(response_streamer(), media_type="application/json")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in handle_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# PUT /conversation/{conversation_id}/status - Update the status (active/inactive)
@router.put(
    "/{conversation_id}/status", response_model=ConversationStatusUpdateResponse
)
async def update_conversation_status(
    conversation_id: str = Path(..., description="The conversation ID to update"),
    payload: StatusUpdateRequest = ...,
):
    """Update conversation status."""
    try:
        table = get_table(CONVERSATION_STORE_TABLE)
        
        # Check if conversation exists
        response = table.get_item(
            Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"}
        )
        if not response.get("Item"):
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Update status
        table.update_item(
            Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"},
            UpdateExpression="SET #status = :status, last_updated = :last_updated",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": payload.status,
                ":last_updated": datetime.utcnow().isoformat() + "Z"
            }
        )
        
        return ConversationStatusUpdateResponse(
            conversation_id=conversation_id,
            status=payload.status,
            message="Status updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")


# PUT /conversation/title - Rename the title of a conversation
@router.put("/title", response_model=RenameTitleResponse)
async def rename_conversation_title(request: RenameTitleRequest):
    """Rename conversation title."""
    try:
        if not request.conversation_id:
            raise HTTPException(status_code=400, detail="conversation_id is required")
        
        if not request.title:
            raise HTTPException(status_code=400, detail="title is required")
        
        table = get_table(CONVERSATION_STORE_TABLE)
        
        # Check if conversation exists
        response = table.get_item(
            Key={"PK": f"CONVERSATION#{request.conversation_id}", "SK": "META"}
        )
        if not response.get("Item"):
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Update title
        table.update_item(
            Key={"PK": f"CONVERSATION#{request.conversation_id}", "SK": "META"},
            UpdateExpression="SET title = :title",
            ExpressionAttributeValues={
                ":title": request.title,
            }
        )
        
        return RenameTitleResponse(
            conversation_id=request.conversation_id,
            title=request.title,
            message="Title updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming conversation title: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating title: {str(e)}")


# DELETE /conversation/{conversation_id} - Delete a conversation change status to inactive
@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete conversation and all associated messages."""
    try:
        table = get_table(CONVERSATION_STORE_TABLE)
        
        # Check if conversation exists
        response = table.get_item(
            Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"}
        )
        if not response.get("Item"):
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Change status to inactive
        from datetime import timezone

        table.update_item(
            Key={"PK": f"CONVERSATION#{conversation_id}", "SK": "META"},
            UpdateExpression="SET #status = :status, last_updated = :last_updated",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "inactive",
                ":last_updated": datetime.now(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            },
        )

        return {
            "conversation_id": conversation_id,
            "message": "Conversation and all messages deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting conversation: {str(e)}")


# POST Upload file to S3 bucket
@router.post("/upload")
async def upload_file(
    user_id: str = Form(...),
    conversation_id: str = Form(None),
    file: UploadFile = File(...),
):
    """Upload file to S3 and save metadata to DynamoDB."""
    try:
        validate_file_upload(user_id, file)
        
        file_table = get_table(BYOD_FILES_TABLE)
        check_existing_files(conversation_id, file_table)

        file_id = str(uuid4())
        now = datetime.utcnow().isoformat() + "Z"
        s3_key = f"byod_files/{user_id}/{file_id}/{file.filename}"

        contents = await file.read()
        upload_to_s3(contents, BUCKET_NAME, s3_key)

        file_table.put_item(
            Item={
                "PK": f"FILE#{file_id}",
                "SK": "META",
                "file_id": file_id,
                "user_id": user_id,
                "conversation_id": conversation_id,
                "filename": file.filename,
                "file_size": len(contents),
                "file_type": file.content_type,
                "s3_path": f"s3://{BUCKET_NAME}/{s3_key}",
                "created_at": now,
                "last_updated": now,
            }
        )

        return {
            "file_id": file_id,
            "file_url": f"s3://{BUCKET_NAME}/{s3_key}",
            "filename": file.filename,
            "file_size": len(contents),
            "file_type": file.content_type,
            "message": "File uploaded and metadata saved successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


## Download file from S3 bucket and return the file content
@router.get("/download/{file_id}")
async def download_byod_file(file_id: str):
    """Download file from S3 bucket and return the file content."""
    try:
        table = get_table(BYOD_FILES_TABLE)

        # Get file metadata from DynamoDB
        response = table.get_item(Key={"PK": f"FILE#{file_id}", "SK": "META"})
        file_item = response.get("Item")
        if not file_item:
            raise HTTPException(status_code=404, detail="File not found")

        s3_path = file_item.get("s3_path")
        file_name = file_item.get("filename", "downloaded_file")
        if not s3_path:
            raise HTTPException(status_code=404, detail="File not found in S3")
        
        logger.info(f"Downloading file from S3 path: {s3_path}")
        
        # Split bucket and key
        bucket, *key_parts = s3_path.replace("s3://", "").split("/", 1)
        key = key_parts[0] if key_parts else ""

        # Get file object from S3
        stream = stream_from_s3(bucket, key)
        return StreamingResponse(
            stream,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _is_data_object(key: str) -> bool:
    """Return True if an S3 key looks like a data part file."""
    if key.endswith("/"):
        return False

    name = key.rsplit("/", 1)[-1]

    prefixes_to_skip = ("_", ".")
    suffixes_to_skip = (".crc",)

    if name.startswith(prefixes_to_skip):
        return False

    if name.endswith(suffixes_to_skip):
        return False

    return True


_PART_RE = re.compile(r"part-(\d+)")


def _part_sort_key(key: str):
    """
    Sort Spark/Databricks part files by part number when present, else lexicographically.
    Examples:
      part-00000-.... -> 0
      part-00001-.... -> 1
    """
    name = key.rsplit("/", 1)[-1]
    m = _PART_RE.search(name)
    if m:
        return (0, int(m.group(1)), name)
    return (1, name)


@router.get("/download/{user_id}/{conversation_id}/{file_name}")
async def download_conversation_related_file(user_id: str, conversation_id: str, file_name: str):
    try:
        s3_prefix = "/".join(["NLQ", user_id, conversation_id, file_name]).rstrip("/") + "/"
        logger.info(f"Downloading from S3 prefix (directory): {s3_prefix}")

        all_keys = list_s3_objects(BUCKET_NAME, s3_prefix)
        data_keys = [k for k in all_keys if _is_data_object(k)]
        if not data_keys:
            raise HTTPException(
                status_code=404,
                detail=f"No downloadable data files found under prefix: {s3_prefix}"
            )

        data_keys.sort(key=_part_sort_key)

        media_type, _ = mimetypes.guess_type(file_name)
        media_type = media_type or "application/octet-stream"

        stream_iter = stream_s3_csv_parts_as_one(
            BUCKET_NAME,
            ordered_keys=data_keys,
        )

        return StreamingResponse(
            stream_iter,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading directory-based file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def stream_events():
    """Stream mock events for demo purposes."""
    for item in mock_stream_message:
        await asyncio.sleep(5)  # 5-second delay
        yield json.dumps(item) + "\n"


@router.post("/demo-stream")
async def demo_stream():
    """Demo streaming endpoint."""
    return StreamingResponse(stream_events(), media_type="application/json")
