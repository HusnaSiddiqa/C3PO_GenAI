import os
import re
import json
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, List, Optional, Any, Tuple
from fastapi import HTTPException
from ast import literal_eval
from decimal import Decimal

# Configure logging
logger = logging.getLogger(__name__)

# Pre-compile regex patterns for better performance
AGENT_ROUTING_PATTERN = re.compile(r"routed the request to: \[(.*?)\]")
CONTENT_PATTERN = re.compile(r"content='(.*?)'\s+additional_kwargs=", re.DOTALL)


def convert_floats_to_decimals(obj):
    """Recursively convert float values to Decimal types for DynamoDB compatibility."""
    if isinstance(obj, dict):
        return {key: convert_floats_to_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimals(item) for item in obj]
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj


def decimal_json_serializer(obj):
    """JSON serializer for objects with Decimal types."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _is_deck_agent_selected(raw_outputs: dict, selected_agents: list) -> bool:
    """Check if either Precanned Deck Refresh Agent or PPT Agent is selected and has output."""
    precanned_selected = ("Precanned_Deck_Refresh_Agent" in raw_outputs and
                          "Precanned_Deck_Refresh_Agent" in selected_agents)
    ppt_selected = ("PPT_Creation_Agent" in raw_outputs and "PPT_Creation_Agent" in selected_agents)
    return precanned_selected or ppt_selected


def _get_deck_agent_output(raw_outputs: dict, selected_agents: list) -> str:
    """Get the output from the appropriate deck agent."""
    if ("Precanned_Deck_Refresh_Agent" in raw_outputs and
            "Precanned_Deck_Refresh_Agent" in selected_agents):
        return raw_outputs["Precanned_Deck_Refresh_Agent"]
    elif "PPT_Creation_Agent" in raw_outputs and "PPT_Creation_Agent" in selected_agents:
        return raw_outputs["PPT_Creation_Agent"]
    else:
        return ""


def validate_conversation_request(request) -> None:
    """Validate conversation request parameters."""
    if not request.user_id:
        request.user_id = os.getenv("DEFAULT_USER")

    if not request.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="message is required")


def validate_file_upload(user_id: str, file) -> None:
    """Validate file upload parameters."""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    if not file:
        raise HTTPException(status_code=400, detail="File is required")

    # Import here to avoid circular imports
    from utils.constants import FILE_TYPE, FILE_SIZE

    if file.content_type not in FILE_TYPE:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF, PNG, and JPEG are allowed.",
        )

    if file.size > FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds the limit of {FILE_SIZE / (1024 * 1024)} MB.",
        )


def check_existing_files(conversation_id: str, file_table) -> None:
    """Check if files already exist for the conversation."""
    if not conversation_id:
        return

    try:
        response = file_table.scan(
            FilterExpression="conversation_id = :conv_id and #type_attr = :type",
            ExpressionAttributeNames={"#type_attr": "type"},
            ExpressionAttributeValues={":conv_id": conversation_id, "type": "BYOD"}
        )
        if response.get("Items"):
            raise HTTPException(
                status_code=400, detail="Only one file is allowed per conversation."
            )
    except Exception as e:
        logger.error(f"Error checking existing files: {str(e)}")
        raise HTTPException(status_code=500, detail="Error checking existing files")


def create_payload(conversation_id: str, **kwargs) -> Dict[str, Any]:
    """Create a standardized payload for database operations."""
    unique_msg_id = str(uuid4())
    now = datetime.utcnow().isoformat() + "Z"

    base_payload = {
        "PK": f"CONVERSATION#{conversation_id}",
        "SK": f"MESSAGE#{now}#{unique_msg_id}",
        "conversation_id": conversation_id,
        "role": "system",
        "type": "summary",
        "message_id": kwargs.get("message_id", unique_msg_id),
        "timestamp": now,
    }
    base_payload.update(kwargs)
    return base_payload


def save_payload_to_db(table, payload: Dict[str, Any]) -> str:
    """Save payload to database and return JSON string."""
    try:
        # Convert any float values to Decimal types for DynamoDB compatibility
        payload = convert_floats_to_decimals(payload)
        table.put_item(Item=payload)
        return json.dumps(payload, default=decimal_json_serializer) + "\n"
    except Exception as e:
        logger.error(f"Error saving payload to DB: {str(e)}")
        error_payload = create_payload(
            payload.get("conversation_id", "unknown"),
            stage="error",
            error_message=f"Database error: {str(e)}",
            role="system"
        )
        return json.dumps(error_payload) + "\n"


def yield_and_save(table, conversation_id: str, **payload_data) -> str:
    """Create payload, save to DB, and return JSON string."""
    payload = create_payload(conversation_id, **payload_data)
    return save_payload_to_db(table, payload)


def yield_error(table, conversation_id: str, error_msg: str, error_type: str = "parsing") -> str:
    """Create and save error payload."""
    error_payload = create_payload(
        conversation_id,
        stage="error",
        error_type=error_type,
        error_message=error_msg,
        role="system"
    )
    try:
        # Convert any float values to Decimal types for DynamoDB compatibility
        error_payload = convert_floats_to_decimals(error_payload)
        table.put_item(Item=error_payload)
    except Exception as e:
        logger.error(f"Error saving error payload: {str(e)}")

    return json.dumps(error_payload) + "\n"


def yield_title_update(conversation_id: str, title: str) -> str:
    """Create title update payload."""
    title_payload = {
        "event": "title_update",
        "conversation_id": conversation_id,
        "title": title,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    return json.dumps(title_payload) + "\n"


def parse_agent_routing(message_text: str) -> List[str]:
    """Parse agent routing information from message text."""
    try:
        match = AGENT_ROUTING_PATTERN.search(message_text)
        if match:
            raw_agents = match.group(1)
            agents = [a.strip().strip("'\"") for a in raw_agents.split(",")]
            # Normalize agent names
            normalized = []
            for agent in agents:
                if "Precanned Deck Refresh Agent" in agent:
                    normalized.append("Precanned Deck Refresh Agent")
                else:
                    normalized.append(agent)
            return normalized
        return []
    except Exception as e:
        logger.error(f"Error parsing agent routing: {str(e)}")
        return []


def parse_artifact_content(raw_text: str) -> Dict[str, Any]:
    """Parse artifact content from raw text."""

    def try_json(s: str):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            return None

    def try_literal(s: str):
        try:
            return literal_eval(s)
        except (ValueError, SyntaxError):
            return None

    parsed = try_json(raw_text)
    if isinstance(parsed, dict):
        if "message" in parsed and "file_url" in parsed:
            return {"type": "simple_json", "data": parsed}
        return {"type": "complex_json", "data": parsed}

    match = CONTENT_PATTERN.search(raw_text)
    if match:
        inner = match.group(1)
        parsed = try_json(inner) or try_literal(inner)
        if parsed is not None:
            return {"type": "complex_json", "data": parsed}
        return {"type": "text", "data": inner}

    parsed = try_literal(raw_text)
    if isinstance(parsed, (dict, list)):
        return {"type": "complex_json", "data": parsed}

    return {"type": "text", "data": raw_text}


def process_agent_response(agent: str, raw_outputs: dict, selected_agents: list,
                           table, conversation_id: str, user_msg_id: str, user_id: str, summary: str) -> Tuple[
    str, List[Any], str]:
    """Process agent response and return summary, results, and yield string."""
    message_results = []
    message_summary = ""
    yield_string = ""
    print(f"agent: {agent}")

    if agent not in raw_outputs or agent not in selected_agents:
        return message_summary, message_results, yield_string

    try:
        # Handle text-based agents
        if agent in ["General Response Agent", "BYOD_Agent"]:
            message_results = raw_outputs[agent]
            agent_payload = {
                "stage": "artifact",
                "role": "assistant",
                "type": "summary",
                "summary": message_results,
                "agent": ",".join(selected_agents),
                "prev_message_id": user_msg_id,
                "user_id": user_id
            }
            yield_string = yield_and_save(table, conversation_id, **agent_payload)
            message_summary = message_results
        # Handle NLQ Agent
        elif agent in ["NLQ_Agent", "ONC_driver_analysis_Agent", "NLQ_DSO_Agent","pmr_Agent","RAG_Agent"]:
            message_results = raw_outputs[agent]
            raw_message_results = message_results
            if isinstance(message_results, str):
                try:
                    # First, try to parse as JSON directly
                    message_results = json.loads(message_results)
                except json.JSONDecodeError:
                    try:
                        # If direct parsing fails, try cleaning the string
                        cleaned_str = message_results
                        # Remove control characters that can cause JSON parsing issues
                        cleaned_str = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned_str)
                        # Handle escaped characters
                        cleaned_str = cleaned_str.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        # Try to parse as JSON
                        message_results = json.loads(cleaned_str)
                    except json.JSONDecodeError:
                        try:
                            # If JSON parsing fails, try ast.literal_eval as fallback
                            import ast
                            python_literal = message_results.replace('\\n', '\n').replace('\\"', '"')
                            message_results = ast.literal_eval(python_literal)
                        except (ValueError, SyntaxError):
                            # If all fail, create a fallback structure
                            logger.warning(f"Failed to parse NLQ Agent response as JSON or Python literal: {message_results[:200]}...")
                            message_results = {"data_analysis": message_results, "sql_query": "", "json_data": []}

            if isinstance(message_results, dict):
                data_analysis = message_results.get("data_analysis", "")
                sql_query = message_results.get("sql_query", "")
                json_data = message_results.get("json_data", []) or message_results.get("results", [])
                data_limit_exceeded = message_results.get("data_limit_exceeded", False)
                if isinstance(json_data, str):
                    try:
                        # First, try to parse as JSON directly
                        json_data = json.loads(json_data)
                    except json.JSONDecodeError:
                        try:
                            # If direct parsing fails, try cleaning the string
                            cleaned_json_data = json_data
                            # Remove control characters that can cause JSON parsing issues
                            cleaned_json_data = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned_json_data)
                            # Handle escaped characters
                            cleaned_json_data = cleaned_json_data.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
                            json_data = json.loads(cleaned_json_data)
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse json_data string: {e}")
                            json_data = []
                if isinstance(json_data, list):
                    for item in json_data:
                        if isinstance(item, dict):
                            for key, value in item.items():
                                if isinstance(value, float):
                                    item[key] = str(value)
            else:
                data_analysis = summary
                sql_query = ""
                json_data = raw_message_results
                data_limit_exceeded = False

            payload_type = "sql_result" if json_data else "summary"
            is_incompleteness = data_analysis and "incomplete" in data_analysis.lower()
            summary = summary if summary else (data_analysis if is_incompleteness else "")
            agent_payload = {
                "stage": "artifact",
                "role": "assistant",
                "type": payload_type,
                "result": json_data if json_data else message_results,
                "summary": summary,
                "sql_query": sql_query,
                "agent": ",".join(selected_agents),
                "prev_message_id": user_msg_id,
                "user_id": user_id,
                "data_limit_exceeded": data_limit_exceeded,
            }
            yield_string = yield_and_save(table, conversation_id, **agent_payload)
            message_summary = data_analysis
        # Handle Chart Agent
        elif agent == "Chart_Agent":
            message_results = raw_outputs[agent]
            # Clean the JSON string by parsing and re-serializing
            if isinstance(message_results, str):
                try:
                    # Clean the string similar to NLQ Agent
                    cleaned_str = message_results
                    # Remove control characters that can cause JSON parsing issues
                    cleaned_str = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', cleaned_str)
                    # Handle escaped characters
                    cleaned_str = cleaned_str.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                    # Parse the JSON to get the actual data structure
                    parsed_data = json.loads(cleaned_str)
                    # Convert float values to Decimal types for DynamoDB compatibility
                    parsed_data = convert_floats_to_decimals(parsed_data)
                    # Re-serialize as proper JSON
                    cleaned_json = json.dumps(parsed_data, default=decimal_json_serializer)
                    message_results = parsed_data
                except json.JSONDecodeError:
                    # If parsing fails, just use the original
                    logger.warning(f"Failed to parse Chart Agent JSON: {message_results[:200]}...")
                    cleaned_json = message_results
            else:
                # Convert float values to Decimal types for DynamoDB compatibility
                message_results = convert_floats_to_decimals(message_results)
                cleaned_json = json.dumps(message_results, default=decimal_json_serializer)

            agent_payload = {
                "stage": "artifact",
                "role": "assistant",
                "type": "chart",
                "result": message_results,
                "summary": summary,
                "chart": cleaned_json,
                "agent": ",".join(selected_agents),
                "prev_message_id": user_msg_id,
                "user_id": user_id
            }
            yield_string = yield_and_save(table, conversation_id, **agent_payload)
            message_summary = "Chart generated successfully"

        # Handle ChartauditAgent (has both SQL results and chart data)
        elif agent == "Chartaudit_Agent":
            message_results = raw_outputs[agent]
            raw_message_results = message_results
            
            all_yields = []
            
            # --- 1. Initial Parsing and Extraction of All Question Results ---
            
            all_question_results = []
            latest_data_analysis = summary # Initialize with orchestrator summary
            
            if isinstance(message_results, str):
                try:
                    # First, try to parse as JSON directly
                    parsed_wrapper = json.loads(message_results)
                except json.JSONDecodeError:
                    try:
                        # If direct parsing fails, try cleaning the string
                        cleaned_str = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', message_results)
                        cleaned_str = cleaned_str.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        parsed_wrapper = json.loads(cleaned_str)
                    except json.JSONDecodeError:
                        try:
                            # If JSON parsing fails, try ast.literal_eval as fallback
                            import ast
                            python_literal = message_results.replace('\\n', '\n').replace('\\"', '"')
                            parsed_wrapper = ast.literal_eval(python_literal)
                        except (ValueError, SyntaxError):
                            logger.warning(f"Failed to parse ChartauditAgent response structure: {message_results[:200]}...")
                            parsed_wrapper = {} # Fail to empty dict

            elif isinstance(message_results, dict):
                parsed_wrapper = message_results
            else:
                 parsed_wrapper = {}

            # Extract the list of individual question results from the wrapper
            if parsed_wrapper.get("status") == "Task Complete" and parsed_wrapper.get("all_question_results"):
                all_question_results = parsed_wrapper["all_question_results"]
                latest_data_analysis = parsed_wrapper.get("final_summary", latest_data_analysis)
            elif isinstance(parsed_wrapper, dict) and (parsed_wrapper.get("sql_results") or parsed_wrapper.get("charts")):
                # Fallback: single, un-wrapped question result
                all_question_results = [parsed_wrapper]
            
            # --- 2. Iterate Per-Question and Create Payloads with All Preprocessing ---
            
            for q_result in all_question_results:
                
                # Extract question-specific metadata from the result object
                q_summary = q_result.get("data_analysis", "Data analysis for this question.")
                q_summary = q_result.get("summary", q_summary) # Use 'summary' as fallback for q_summary
                
                q_id = q_result.get("question_id", str(uuid4()))
                q_question = q_result.get("question", "Unknown Question")
                
                latest_data_analysis = q_summary # Update overall summary for fallback/final return
                
                # --- Process SQL Results (q_result.sql_results) ---
                # --- Process SQL Results and Charts Interleaved by Type ---
                sql_results = q_result.get("sql_results", [])
                chart_data = q_result.get("charts", [])

                # Determine if semi-structured
                all_result_types = set()
                if sql_results and isinstance(sql_results, list):
                    for sr in sql_results:
                        if isinstance(sr, dict):
                            all_result_types.add(sr.get("type", ""))
                is_semi_structured = "structured" in all_result_types and "unstructured" in all_result_types

                # Index SQL results by type
                sql_by_type = {}
                if sql_results and isinstance(sql_results, list):
                    for sr in sql_results:
                        if isinstance(sr, dict):
                            result_type = sr.get("type", "unknown")
                            sql_by_type.setdefault(result_type, []).append(sr)

                # Pre-process chart_data (parse if string)
                if isinstance(chart_data, str):
                    try:
                        cleaned_str = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', chart_data)
                        cleaned_str = cleaned_str.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
                        chart_data = json.loads(cleaned_str)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse ChartauditAgent chart data for QID {q_id}: {chart_data[:200]}...")
                        chart_data = []

                # Convert float values to Decimal types for DynamoDB compatibility
                if isinstance(chart_data, list):
                    chart_data_converted = convert_floats_to_decimals(chart_data)
                else:
                    chart_data_converted = []

                # Group charts by data_type
                charts_by_type = {}
                for chart in chart_data_converted:
                    if isinstance(chart, dict):
                        data_type = chart.get("data_type", "unknown")
                        charts_by_type.setdefault(data_type, []).append(chart)

                # Determine processing order: all unique types from both SQL and charts
                all_types_ordered = []
                for t in list(sql_by_type.keys()) + list(charts_by_type.keys()):
                    if t not in all_types_ordered:
                        all_types_ordered.append(t)

                # Emit SQL then chart for each type
                for result_type in all_types_ordered:
                    # --- Emit SQL results for this type ---
                    for sql_result in sql_by_type.get(result_type, []):
                        print(f"Processing SQL result of type: {result_type} for question ID: {q_id}")
                        sql_query = sql_result.get("sql", "")
                        results_data = sql_result.get("results", [])

                        # SQL data cleaning
                        if isinstance(results_data, str):
                            try:
                                results_data = json.loads(results_data)
                            except json.JSONDecodeError:
                                cleaned_json_data = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', results_data)
                                cleaned_json_data = cleaned_json_data.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
                                try:
                                    results_data = json.loads(cleaned_json_data)
                                except json.JSONDecodeError:
                                    results_data = []

                        if isinstance(results_data, list):
                            for item_data in results_data:
                                if isinstance(item_data, dict):
                                    for key, value in item_data.items():
                                        if isinstance(value, float):
                                            item_data[key] = str(value)

                        if results_data:
                            if result_type == "unstructured" and is_semi_structured:
                                sql_summary = "Unstructured data summary"
                            elif result_type == "unstructured" and not is_semi_structured:
                                sql_summary = q_summary
                            else:
                                sql_summary = q_summary

                            sql_agent_payload = {
                                "stage": "artifact",
                                "role": "assistant",
                                "type": "sql_result",
                                "result": results_data,
                                "summary": sql_summary,
                                "sql_query": sql_query,
                                "result_type": result_type,
                                "agent": ",".join(selected_agents),
                                "prev_message_id": user_msg_id,
                                "user_id": user_id,
                                "question_id": q_id,
                                "question": q_question,
                            }
                            all_yields.append(yield_and_save(table, conversation_id, **sql_agent_payload))

                    # --- Emit charts for this type (immediately after its SQL) ---
                    charts_for_type = charts_by_type.get(result_type, [])
                    if charts_for_type:
                        chart_json = json.dumps(charts_for_type, default=decimal_json_serializer)

                        chart_agent_payload = {
                            "stage": "artifact",
                            "role": "assistant",
                            "type": "chart",
                            "result": charts_for_type,
                            "summary": f"Visualization showing {result_type} chart for the query",
                            "chart": chart_json,
                            "chart_type": result_type,
                            "agent": ",".join(selected_agents),
                            "prev_message_id": user_msg_id,
                            "user_id": user_id,
                            "question_id": q_id,
                            "question": q_question,
                        }
                        all_yields.append(yield_and_save(table, conversation_id, **chart_agent_payload))
            
            # --- 3. Final Summary and Yield Compilation ---
            
            # If no yields were created but we had a valid summary, send the overall summary
            if not all_yields and all_question_results:
                 summary_payload = {
                    "stage": "artifact",
                    "role": "assistant",
                    "type": "summary",
                    "summary": latest_data_analysis,
                    "agent": ",".join(selected_agents),
                    "prev_message_id": user_msg_id,
                    "user_id": user_id
                }
                 all_yields.append(yield_and_save(table, conversation_id, **summary_payload))
            
            elif not all_yields:
                # Fallback for completely unparsable/empty result
                summary_payload = {
                    "stage": "artifact",
                    "role": "assistant",
                    "type": "summary",
                    "summary": str(raw_message_results) if raw_message_results else "No results or summary could be extracted.",
                    "agent": ",".join(selected_agents),
                    "prev_message_id": user_msg_id,
                    "user_id": user_id
                }
                all_yields.append(yield_and_save(table, conversation_id, **summary_payload))
            
            # Combine all yields
            yield_string = "".join(all_yields)
            message_summary = latest_data_analysis
            message_results = all_question_results
            
            return message_summary, message_results, yield_string
        # Handle deck agents
        elif agent in ["Precanned_Deck_Refresh_Agent", "PPT_Creation_Agent"]:
            print(f"agent: {agent}")
            print(f"raw_outputs: {raw_outputs}")
            print(f"selected_agents: {selected_agents}")
            if _is_deck_agent_selected(raw_outputs, selected_agents):
                deck_output = _get_deck_agent_output(raw_outputs, selected_agents)
                print(f"deck_output: {deck_output}")
                try:
                    # Try to parse the deck output as JSON to extract file information
                    deck_output_json = json.loads(deck_output)
                    file_url = deck_output_json.get("file_url", "")
                    if not file_url:
                        agent_payload = {
                            "stage": "artifact",
                            "role": "assistant",
                            "type": "summary",
                            "summary": deck_output_json.get("message", ""),
                            "agent": ",".join(selected_agents),
                            "prev_message_id": user_msg_id,
                            "user_id": user_id
                        }
                        yield_string = yield_and_save(table, conversation_id, **agent_payload)
                        message_summary = deck_output_json.get("message", "")
                        return message_summary, message_results, yield_string
                    file_id = str(uuid4())
                    now = datetime.utcnow().isoformat() + "Z"
                    if not file_url:
                        agent_payload = {
                            "stage": "artifact",
                            "role": "assistant",
                            "type": "summary",
                            "summary": deck_output_json.get("message", ""),
                            "agent": ",".join(selected_agents),
                            "prev_message_id": user_msg_id,
                            "user_id": user_id
                        }
                        yield_string = yield_and_save(table, conversation_id, **agent_payload)
                        message_summary = deck_output_json.get("message", "")
                        return message_summary, message_results, yield_string
                    # Import here to avoid circular imports
                    from utils.constants import BYOD_FILES_TABLE
                    from utils.dynamodb import get_table
                    # Create file record
                    file_record = {
                        "PK": f"FILE#{file_id}",
                        "SK": "META",
                        "file_id": file_id,
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "filename": deck_output_json.get("filename", "deck.pptx"),
                        "file_type": deck_output_json.get("file_type","application/vnd.openxmlformats-officedocument.presentationml.presentation"),
                        "s3_path": file_url,
                        "created_at": now,
                        "last_updated": now,
                        "type": "AGENT_PPTX"
                    }
                    file_table = get_table(BYOD_FILES_TABLE)
                    file_table.put_item(Item=file_record)

                    agent_payload = {
                        "stage": "artifact",
                        "role": "assistant",
                        "type": "file",
                        "file": {
                            "file_id": file_id,
                            "s3_path": file_url,
                            "filename": file_record["filename"],
                            "file_type": file_record["file_type"]
                        },
                        "summary": deck_output_json.get("message", ""),
                        "file_id": file_id,
                        "agent": ",".join(selected_agents),
                        "prev_message_id": user_msg_id,
                        "user_id": user_id
                    }
                    yield_string = yield_and_save(table, conversation_id, **agent_payload)
                    message_summary = deck_output_json.get("message", "")

                except (json.JSONDecodeError, Exception) as e:
                    # Fallback to original behavior if JSON parsing fails
                    logger.warning(f"Error processing deck agent JSON output: {str(e)}")
                    agent_payload = {
                        "stage": "artifact",
                        "role": "assistant",
                        "type": "deck",
                        "summary": deck_output,
                        "agent": ",".join(selected_agents),
                        "prev_message_id": user_msg_id,
                        "user_id": user_id
                    }
                    yield_string = yield_and_save(table, conversation_id, **agent_payload)
                    message_summary = deck_output

    except Exception as e:
        logger.error(f"Error processing agent {agent}: {str(e)}")
        yield_string = yield_error(table, conversation_id, f"Error processing {agent}: {str(e)}", "agent_processing")

    return message_summary, message_results, yield_string


def handle_task_submitted(table, conversation_id: str) -> str:
    """Handle task submitted state."""
    return yield_and_save(table, conversation_id,
                          event="synthetic",
                          stage="thinking",
                          message="Analyzing your query..."
                          )


def handle_status_update(result: dict, table, conversation_id: str, selected_agents: list, user_id: str) -> Tuple[
    str, List[str]]:
    """Handle status update processing."""
    try:
        status = result.get("status", {})
        state = status.get("state")
        message_obj = status.get("message", {})
        parts = message_obj.get("parts", [])
        message_text = parts[0]["text"] if parts and parts[0]["kind"] == "text" else None

        # Check if this status update contains artifact/raw_outputs data from orchestrator
        # (immediate artifact-updates wrapped as status-updates by A2A framework)
        if message_text:
            try:
                message_data = json.loads(message_text)
                # If it contains raw_outputs, treat it as an artifact-update and process accordingly
                if isinstance(message_data, dict) and "raw_outputs" in message_data:
                    logger.info(f"[handle_status_update] Processing artifact data from status-update")
                    # logger.info(f"[handle_status_update] raw_outputs keys: {list(message_data.get('raw_outputs', {}).keys())}")
                    logger.info(f"[handle_status_update] selected_agents: {selected_agents}")
                    # This is an immediate artifact-update from orchestrator, process like artifact-update
                    raw_outputs = message_data.get("raw_outputs", {})
                    summary = message_data.get("summary", "")

                    all_yields = []
                    # Define agent priority
                    agent_priority = [
                        "General Response Agent",
                        "NLQ_Agent",
                        "Chartaudit_Agent",
                        "ONC_driver_analysis_Agent",
                        "NLQ_DSO_Agent",
                        "pmr_Agent",
                        "Chart_Agent",
                        "BYOD_Agent",
                        "RAG_Agent",
                        "Precanned_Deck_Refresh_Agent",
                        "PPT_Creation_Agent"
                    ]

                    # Create a fake user_msg_id for the response processing
                    user_msg_id = str(uuid4())

                    agent_processed = 0
                    for agent in agent_priority:
                        if agent in selected_agents:
                            agent_processed += 1
                            last_summary = summary if agent_processed == 1 else " "

                            logger.info(f"[handle_status_update] Processing agent: {agent}")
                            message_summary, message_results, yield_string = process_agent_response(
                                agent, raw_outputs, selected_agents, table, conversation_id, user_msg_id, user_id, last_summary
                            )
                            if yield_string:
                                logger.info(f"[handle_status_update] Got yield_string for agent {agent}, length: {len(yield_string)}")
                                all_yields.append(yield_string)

                    combined_result = "".join(all_yields)
                    logger.info(f"[handle_status_update] Returning combined artifact data with {len(all_yields)} agents, total length: {len(combined_result)}")
                    return combined_result, selected_agents
            except (json.JSONDecodeError, ValueError):
                pass

        # Skip other JSON messages
        if message_text:
            try:
                json.loads(message_text)
                return "", selected_agents
            except Exception:
                pass

        if state == "completed":
            final_completion_payload = create_payload(
                conversation_id,
                stage="completed",
                is_final=True,
                role="system",
                message="Stream completed successfully"
            )
            return json.dumps(final_completion_payload) + "\n", selected_agents

        # Handle agent routing
        if message_text and "orchestrator has routed the request to" in message_text:
            selected_agents = parse_agent_routing(message_text)
            payload_data = {
                "stage": "agent-routing",
                "agent_message": message_text,
                "selected_agents": selected_agents,
                "contextId": result.get("contextId"),
                "taskId": result.get("taskId"),
                "user_id": user_id
            }
            return yield_and_save(table, conversation_id, **payload_data), selected_agents
        else:
            payload_data = {
                "stage": state,
                "agent_message": message_text,
                "contextId": result.get("contextId"),
                "taskId": result.get("taskId"),
                "user_id": user_id
            }
            return yield_and_save(table, conversation_id, **payload_data), selected_agents

    except Exception as e:
        logger.error(f"Error processing status update: {str(e)}")
        return yield_error(table, conversation_id, f"Error processing status update: {str(e)}",
                           "status_processing"), selected_agents


def handle_artifact_update(result: dict, table, conversation_id: str, selected_agents: list,
                           full_response: str, user_msg_id: str, user_id: str) -> Tuple[str, str]:
    """Handle artifact update processing."""
    try:
        artifact = result.get("artifact", {})
        artifact_parts = artifact.get("parts", [])
        artifact_text = artifact_parts[0]["text"] if artifact_parts and artifact_parts[0]["kind"] == "text" else None

        if artifact_text:
            full_response += artifact_text

        payload_data = {
            "stage": "artifact",
            "artifactId": artifact.get("artifactId"),
            "artifact_name": artifact.get("name"),
            "contextId": result.get("contextId"),
            "taskId": result.get("taskId"),
            "user_id": user_id
        }
        # Initialize all_yields at the beginning
        all_yields = []

        # Process response artifacts
        if artifact.get("name") == "response" or artifact_text:
            parsed_content = parse_artifact_content(artifact_text or "")

            if parsed_content["type"] == "simple_json":
                # Handle Precanned Deck Refresh Agent format
                data = parsed_content["data"]
                message_summary = data.get("message", "")
                file_url = data.get("file_url", "")

                payload_data.update({
                    "summary": message_summary,
                    "file_url": file_url,
                    "role": "assistant",
                    "type": "file",
                    "user_id": user_id
                })
            elif parsed_content["type"] == "complex_json":
                # Handle complex agent responses
                data = parsed_content["data"]
                summary = data.get("summary", "")
                raw_outputs = data.get("raw_outputs", {})
                payload_data.update({
                    "summary": summary,
                    "role": "assistant",
                    "user_id": user_id
                })
                message_summary = summary
                # Define agent priority
                agent_priority = [
                    "General Response Agent",
                    "NLQ_Agent",
                    "Chartaudit_Agent",
                    "ONC_driver_analysis_Agent",
                    "NLQ_DSO_Agent",
                    "pmr_Agent",
                    "Chart_Agent",
                    "BYOD_Agent",
                    "RAG_Agent",
                    "Precanned_Deck_Refresh_Agent",
                    "PPT_Creation_Agent"
                ]
                print(f"selected_agents: {selected_agents}")
                agent_processed = 0
                for agent in agent_priority:
                    last_summary = " "
                    if agent in selected_agents:
                        agent_processed += 1
                        last_summary = summary if agent_processed == len(selected_agents) else " "

                    message_summary, message_results, yield_string = process_agent_response(
                        agent, raw_outputs, selected_agents, table, conversation_id, user_msg_id, user_id, last_summary
                    )
                    if yield_string:
                        all_yields.append(yield_string)
        # Return combined yields from all agents
        return "".join(all_yields), full_response

    except Exception as e:
        logger.error(f"Error processing artifact update: {str(e)}")
        return yield_error(table, conversation_id, f"Error processing artifact: {str(e)}",
                           "artifact_processing"), full_response


def handle_delta_update(chunk_data: dict, full_response: str) -> str:
    """Handle delta update processing."""
    delta = chunk_data.get("delta", "")
    if delta:
        full_response += delta
        delta_payload = {
            "event": "delta",
            "delta": delta,
            "full_response": full_response
        }
        return json.dumps(delta_payload) + "\n"
    return ""
