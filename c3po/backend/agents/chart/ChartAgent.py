import os
import sys
import ast
import re
import traceback
import json

from collections.abc import AsyncIterator
from typing import Annotated, Any, Dict, List, Optional, Tuple, TypedDict
from time import perf_counter

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from agents.chart.Tools import data_exploration_tool, validate_llm_output
from agents.chart.data_builder import DataBuilder
from agents.chart.chart_builder import ChartBuilder

from langgraph.prebuilt import create_react_agent
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langgraph.graph import StateGraph
from traceloop_wrapper.metrics import record_response_time
from langgraph.graph.message import add_messages

from core.model_provider.factory import ModelFactory
from core.agent.ConversationState import ConversationState
from core.agent.Agent import AgentBase
from core.prompt.SystemPrompt import SystemPrompt
from core.prompt.PromptStore import PromptStore
from core.util.ConfigLoader import load_env_variables, get_secret
from a2a.types import AgentSkill
from utils.constants import LAST_AGENT_SEPARATOR
from utils.llm_util import extract_text


class ChartAgentState(TypedDict):
    input_data: List[Any]
    remaining_steps: int
    messages: Annotated[List[BaseMessage], add_messages]
    metadata: Dict[str, Any]
    step: int
    env: dict[str, str | None]
    data_limit_exceeded: bool



def latest_data_in_context(query: str):
    print('===========query=========', query)
    if LAST_AGENT_SEPARATOR not in query:
        raise ValueError(f"Separator {LAST_AGENT_SEPARATOR!r} not found")
    json_string = query.split(LAST_AGENT_SEPARATOR, 1)[1].strip()
    try:
        formatted_json_response = json.loads(json_string)
    except json.JSONDecodeError:
        formatted_json_response = _safe_literal_eval(json_string, [])
    print('===========formatted_json_response=========', formatted_json_response)
    if isinstance(formatted_json_response, dict) and "json_data" in formatted_json_response:
        return _safe_json_load(formatted_json_response["json_data"]), \
            formatted_json_response.get("data_limit_exceeded", False)

    if isinstance(formatted_json_response, list):
        best = None
        for msg in reversed(formatted_json_response):
            print('===========msg=========', msg)
            if msg.get("role") in ("human", "User", "user"):
                continue
            content = msg.get("content", "")
            print('===========content=========', content)
            content_obj = _safe_literal_eval(content, {})

            raw_outputs = content_obj.get("raw_outputs", {})
            print('===========raw_outputs=========', raw_outputs)
            if not isinstance(raw_outputs, dict) or not raw_outputs:
                raise ValueError("raw_outputs not found or invalid")

            best = _find_first_json_data_in_raw_outputs(raw_outputs)
            if best is not None:
                break
                
        if best is None:
            raise ValueError("No agent output contained json_data")
        _, json_data_value, data_limit_exceeded = best
        return _safe_json_load(json_data_value), data_limit_exceeded

    return [], False


def _find_first_json_data_in_raw_outputs(
        raw_outputs: dict
) -> Optional[Tuple[str, Any, bool]]:
    for agent_name, agent_payload in raw_outputs.items():
        if agent_payload is None:
            continue

        # Usually this is a JSON string
        if isinstance(agent_payload, str):
            try:
                obj = json.loads(agent_payload)
            except Exception:
                continue
        elif isinstance(agent_payload, dict):
            obj = agent_payload
        else:
            continue
        print('===========obj=========', obj)
        if isinstance(obj, dict) and "json_data" in obj:
            return agent_name, obj["json_data"], obj.get("data_limit_exceeded", False)

    return None, None, False


def _safe_json_load(value):
    if isinstance(value, (list, dict)):
        return value

    if isinstance(value, str):
        return json.loads(value)
    return value


def _safe_literal_eval(text: str, default):
    try:
        return ast.literal_eval(text)
    except Exception:
        print("Failed to parse text:", text)
        return default


class ChartAgent(AgentBase[ConversationState]):
    SUCCESS_INDICATOR = 'valid'

    @property
    def name(self) -> str:
        return "Chart_Agent"

    @property
    def description(self) -> str:
        return ("An agent skill that generates chart types and the required coordinates based on the received array of "
                "JSON request.")

    def __init__(self):
        self.final_prompt = None
        self.env = load_env_variables()
        req_env_keys = ['WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'SECRET_NAME']
        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.model_api_key = get_secret(secret_name)

        self.system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")
        self.final_prompt_template = None
        self.llm = None
        self.load_llm_with_mlflow_prompt()

        skill = AgentSkill(
            id='generate_chart_types',
            name='Chart Agent',
            description='An agent skill that analyzes received array of JSON data and identifies possible chart types ( bar, line, histogram, scatter, pie, etc..) along with the data required to plot them. It requires structured data (in JSON format) produced by other agents and uses conversation history to contextualize the request.',
            tags=['Chart']
        )
        super().__init__(llm=self.llm, agent_skill=skill)
        print("--- [ChartAgent __init__] Agent initialization complete. ---")

    def load_llm_with_mlflow_prompt(self, agent_name: str = "Chart"):
        print('===========agent_name========', agent_name)
        try:
            prompt_template = PromptStore(agent_name, f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
            model = prompt_template.get("model", "")
            model_base_url = prompt_template.get("model_base_url", "")
            temperature = prompt_template.get("temperature", "0")
            try:
                temperature = float(temperature)
            except (ValueError, TypeError):
                temperature = 0
            self.final_prompt_template = prompt_template.get("prompt", "")
            print("--- [ChartAgent __init__] Prompt template loaded. ---")

            llm_provider = ModelFactory.create_provider(provider=self.env.get('PROVIDER'), model_name=model,
                                                        base_url=model_base_url, api_key=self.model_api_key,
                                                        temperature=float(temperature))
            self.llm = llm_provider.get_llm()
        except ValueError:
            pass


    @staticmethod
    def has_valid_message(messages: list):
        for message in messages:
            if isinstance(message, ToolMessage) and \
                message.content == ChartAgent.SUCCESS_INDICATOR:
                return True
            if isinstance(message, dict) and \
                message.get('content') == ChartAgent.SUCCESS_INDICATOR:
                return True
            if isinstance(message, tuple) and len(message) > 1 and \
                message[1] == ChartAgent.SUCCESS_INDICATOR:
                return True
        return False
    

    @staticmethod
    def get_latest_message_contents_from_llm(messages: list):
        if isinstance(messages, list):
            for message in reversed(messages):
                if isinstance(message, AIMessage):
                    return extract_text(message)
                if isinstance(message, dict) and message.get('role') == AIMessage.type:
                    content = message.get('content', '')
                    if isinstance(content, list):
                        return ' '.join(
                            block.get('text', '') if isinstance(block, dict) else str(block)
                            for block in content
                        ).strip()
                    return content
                if isinstance(message, tuple) and message[0] == AIMessage.type:
                    return message[1]
        return '[]'


    async def stream(self, request: Any, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("\n--- [stream] Method entered. Starting robust flow... ---")
        start = perf_counter()

        sub_agent = (metadata or {}).get("sub-agent", "Chart")
        print('===========sub_agent========', sub_agent)
        self.load_llm_with_mlflow_prompt(sub_agent)
        if self.llm is None:
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": json.dumps([]),
            }
            return
        self.initialize_graph()

        try:
            raw_history_string = None
            if isinstance(request, dict):
                raw_history_string = request.get("params", {}).get("message", {}).get("parts", [{}])[0].get("text")
            elif isinstance(request, str):
                raw_history_string = request
            else:
                raise TypeError(f"Unsupported request type: {type(request)}")

            if not raw_history_string:
                raise ValueError("Could not find a text payload to process from the input.")

            parsed_data, data_limit_exceeded = latest_data_in_context(raw_history_string)

            if not isinstance(parsed_data, list):
                raise ValueError("Extracted data is not a list. Cannot generate chart.")
            user_query = new_user_query = \
                f"Based on the data given use it to visualize the data and recommend the possible charts"
            if LAST_AGENT_SEPARATOR in raw_history_string:
                new_user_query = raw_history_string.split(LAST_AGENT_SEPARATOR, 1)[0]
            elif user_query == new_user_query:
                user_query_lines = []
                for line in raw_history_string.splitlines():
                    if line.strip().startswith(('{', '[')):
                        break
                    user_query_lines.append(line)
                new_user_query = "\n".join(user_query_lines)
            user_query = new_user_query.strip()

            fields = []
            if parsed_data and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
                fields = list(parsed_data[0].keys())

            data_builder = DataBuilder(data=parsed_data, metadata=metadata, 
                                       env=self.env, data_limit_exceeded=data_limit_exceeded)
            main_prompt_part = self.final_prompt_template.format(
                user_query=user_query,
                sample_data=data_builder.build_data_sample(),
                fields=fields,
            )
            final_prompt = main_prompt_part
            print(f"The final prompt coming from the agent:-------------{final_prompt}")

            state = ChartAgentState(input_data=parsed_data, 
                                    messages=[("user", final_prompt)],
                                    metadata=metadata,
                                    step=0,
                                    remaining_steps=10,
                                    env=self.env,
                                    data_limit_exceeded=data_limit_exceeded)
            config = {'configurable': {'thread_id': thread_id},
                      'recursion_limit': 25}

            async for output in self._agent.astream(state, config):
                messages = output[next(iter(output))]['messages']
                print(f"=====Output from agent: {output}")
                
                if self.has_valid_message(messages):
                    print('=====has valid message')
                    content = ChartAgent.get_latest_message_contents_from_llm(messages)

                    record_response_time((perf_counter() - start) * 1000)
                    message_content = content
                    intermediate_chart_data = \
                        data_builder.build_intermediate_chart_data(message_content)
                    chart_builder = ChartBuilder(intermediate_chart_data)
                    yield {
                        "is_task_complete": True,
                        "require_user_input": False,
                        "content": chart_builder.build(),
                    }
                    break

        except Exception as e:
            error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
            print(error_details)
            print(f"--- [stream] CRITICAL ERROR in stream method: {error_details} ---")
            yield {
                "is_task_complete": True,
                "require_user_input": False,
                "content": json.dumps([]),
            }

    @staticmethod
    def serialize_messages(messages):
        return [{"role": getattr(msg, "type", "unknown"), "content": msg.content} for msg in messages]

    def _build_graph(self):
        main_agent = create_react_agent(
            model=self.llm,
            tools=[validate_llm_output, data_exploration_tool],
            state_schema=ChartAgentState,
        )
        builder = StateGraph(ChartAgentState)
        builder.add_node("main_agent", main_agent)
        builder.set_entry_point("main_agent")
        return builder.compile()

if __name__ == "__main__":
    agent = ChartAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}',
                     path="/v2/agents/chart", dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"),
                     dynatrace_auth_token=dynatrace_auth_token)
