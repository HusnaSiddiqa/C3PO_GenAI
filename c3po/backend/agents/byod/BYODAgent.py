import os
import sys
import boto3
from collections.abc import AsyncIterator
from typing import Any, Dict

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from langgraph.graph import StateGraph

from langgraph.checkpoint.memory import MemorySaver

from langgraph.prebuilt import create_react_agent

from langchain_core.messages import AIMessage, ToolMessage, BaseMessage

from core.prompt.SystemPrompt import SystemPrompt

from langchain_aws import BedrockEmbeddings

from core.agent.Agent import AgentBase

from core.model_provider.factory import ModelFactory

from core.agent.ConversationState import ConversationState

from core.memory.memory_store import MemoryStore

from core.util.ConfigLoader import load_env_variables, get_secret

from core.prompt.PromptStore import PromptStore

from utils.constants import Region_NAME, EMBEDDING_MODEL

from a2a.types import AgentSkill

from agents.byod.Tools import Tools, EnhancedRetriever, set_retriever_instance, retrieve_file_content

from traceloop_wrapper.metrics import record_response_time
from time import perf_counter

memory = MemorySaver()


class BYODAgent(AgentBase[ConversationState]):
    @property
    def name(self) -> str:
        return "BYOD_Agent"

    @property
    def description(self) -> str:
        return "An agent that analyzes user-uploaded documents and answers natural language questions based on their content. This agent is self-sufficient and does not rely on prior outputs or chat history to fulfill user queries."

    def __init__(self):
        self.env = load_env_variables()
        req_env_keys = [
            'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME', 'SECRET_NAME',
            'DATABRICKS_SERVER_HOSTNAME'
        ]
        missing_keys = [key for key in req_env_keys if key not in self.env]
        if missing_keys:
            raise KeyError(f"Missing required Databricks environment variable(s): {', '.join(missing_keys)}")

        secret_name = self.env['SECRET_NAME']
        self.model_api_key = get_secret(secret_name)

        system_prompts = SystemPrompt(self.env['WORKSPACE_BUCKET_NAME'], "system_prompts")
        self.system_prompt_template = system_prompts.get_system_prompt("BYOD_Final_Template.txt")

        embedding_model = BedrockEmbeddings(
            client=boto3.client("bedrock-runtime", region_name=Region_NAME),
            model_id=EMBEDDING_MODEL
        )

        self.memory_store = MemoryStore(bucket_name=self.env['WORKSPACE_BUCKET_NAME'], prefix="agent_memory")
        self.tools = Tools.retrieve_document_content
        self.retriever = EnhancedRetriever(embedding_model)
        set_retriever_instance(self.retriever)
        self.final_prompt_str = None
        self.admin_prompt_template = None
        self._chat_model = None
        self.load_llm_with_mlflow_prompt()

        self.active_documents: Dict[str, str] = {}

        skill = AgentSkill(
            id='retrieve_document_content',
            name='Answers the user\'s question from the provided content.',
            description=(
                "Use this agent to answer questions, summarize, or analyze the content of a specific document provided by the user. "
                "This agent is the best choice for any query that seems to refer to a file that was just uploaded or is the current topic of conversation, "
                "even if the user does not explicitly say 'based on the document'. For example, if a user uploads a financial report and then asks "
                "'What were the total revenues?', this agent should be used."
                "This agent is self-sufficient and does not rely on prior outputs or chat history to fulfill user queries."
            ),
            tags=[
                'document analysis',
                'file Q&A',
                'contextual analysis',
                'user-provided content',
                'summarization',
                'information extraction',
                'RAG',
                'document_s3_path'
            ]
        )
        super().__init__(llm=self._chat_model, agent_skill=skill)

    def load_llm_with_mlflow_prompt(self):
        try:
            prompt_config = PromptStore("BYOD", f"{self.env['WORKSPACE_NAME']}/agents").load_prompt()
            model = prompt_config.get("model")
            model_base_url = prompt_config.get("model_base_url")
            temperature = prompt_config.get("temperature", "")
            self.admin_prompt_template = prompt_config.get("prompt", "")

            llm_provider = ModelFactory.create_provider(
                provider=self.env.get('PROVIDER'),
                model_name=model,
                base_url=model_base_url,
                api_key=self.model_api_key,
                temperature=float(temperature)
            )
            self._chat_model = llm_provider.get_llm()
        except ValueError:
            pass

    @staticmethod
    def serialize_messages(messages: list[BaseMessage]):
        return [{"role": msg.type, "content": msg.content} for msg in messages]

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        start = perf_counter()
        self.initialize_graph()
        if not metadata:
            metadata = {}

        new_s3_path = metadata.get('document_s3_path')
        user_id = metadata.get('user_id')
        conversation_id = metadata.get('conversation_id')

        if not all([user_id, conversation_id]):
            missing_keys = [k for k, v in {'user_id': user_id, 'conversation_id': conversation_id}.items() if not v]
            yield {'is_task_complete': True,
                   'content': f"Error: Missing required keys in metadata: {', '.join(missing_keys)}."}
            return

        if new_s3_path:
            self.active_documents[conversation_id] = new_s3_path
            document_s3_path = new_s3_path
        else:
            document_s3_path = self.active_documents.get(conversation_id)

        if not document_s3_path:
            document_s3_path = retrieve_file_content(conversation_id)

        if not document_s3_path:
            yield {'is_task_complete': True, 'content': "Error: Please provide a document S3 path to begin."}
            return
        general_instructions = metadata.get('general_instructions', '')
        common_business_rules = metadata.get('common_business_rules', '')
        data_handling_rules = metadata.get('data_handling_rules', '')

        past_messages_str = self.memory_store.search(
            user_name=user_id, agent_name=self.name, conversation_id=conversation_id, last_n=10
        )
        self.load_llm_with_mlflow_prompt()
        final_prompt_str = self.system_prompt_template.format(
            general_instructions=general_instructions,
            common_business_rules=common_business_rules,
            data_handling_rules=data_handling_rules,
            admin_prompt=self.admin_prompt_template,
            chat_history=past_messages_str
        )
        print(final_prompt_str)
        initial_user_message = (
            f"Based on the document at '{document_s3_path}', answer the following question: {query}")
        initial_messages = [("system", final_prompt_str), ("user", initial_user_message)]
        state = ConversationState(messages=initial_messages, metadata=metadata)
        config = {'configurable': {'thread_id': thread_id}}

        final_state_messages = []
        async for output in self._agent.astream(state, config):
            messages = output[next(iter(output))]['messages']
            final_state_messages = messages
            latest_message = messages[-1]

            if isinstance(latest_message, AIMessage) and latest_message.tool_calls:
                tool_name = latest_message.tool_calls[0]['name']
                yield {'is_task_complete': False, 'require_user_input': False,
                       'content': f"Thinking... Using tool: `{tool_name}`"}
            elif isinstance(latest_message, ToolMessage):
                yield {'is_task_complete': False, 'require_user_input': False,
                       'content': "Processing document content to find the answer..."}
            else:
                self.memory_store.save(
                    messages=self.serialize_messages(final_state_messages),
                    user_name=user_id, agent_name=self.name, conversation_id=conversation_id
                )
                record_response_time((perf_counter() - start) * 1000)
                yield {'is_task_complete': True, 'require_user_input': False, 'content': latest_message.content}
                break

    def _build_graph(self):

        main_agent = create_react_agent(
            model=self._chat_model,
            tools=[self.tools],
            checkpointer=memory
        )

        builder = StateGraph(ConversationState)
        builder.add_node("main_agent", main_agent)
        builder.set_entry_point("main_agent")
        builder.set_finish_point("main_agent")

        return builder.compile()


if __name__ == "__main__":
    print("🚀 Starting BYOD Agent server...")
    try:
        agent = BYODAgent()
        base_url = os.getenv("AGENT_BASE_URL")
        agent_port = os.getenv("AGENT_BASE_PORT")
        dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
        agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}',
                         path="/v2/agents/byod", dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)
    except Exception as e:
        print(f"ERROR: Failed to start agent server. {e}")
        sys.exit(1)
