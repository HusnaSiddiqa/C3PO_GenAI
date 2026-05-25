import os
import sys
print(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from collections.abc import AsyncIterator
from typing import Any
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import ToolMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from core.model_provider.factory import ModelFactory
from core.agent.ConversationState import ConversationState
from core.agent.Agent import AgentBase
from core.memory.memory_store import MemoryStore
from generate_ppt_tool import build_tool_for_ppt_generation, build_tool_for_data_extraction
from langgraph.graph import StateGraph
from core.util.ConfigLoader import load_env_variables, get_secret
from langgraph.checkpoint.memory import MemorySaver
from a2a.types import AgentSkill
from pydantic import BaseModel
from langchain_core.output_parsers import PydanticOutputParser
from utils.constants import BACKEND_API_VERSION
from utils.generic import get_secret
import uuid
from traceloop_wrapper.metrics import record_response_time
from time import perf_counter


memory = MemorySaver()


class DeckOutput(BaseModel):
    message: str
    file_url: str

deck_output_parser = PydanticOutputParser(pydantic_object=DeckOutput)
example_response = DeckOutput(message="Deck created successfully", file_url="s3://bucket/path/to/deck.pptx")

class DeckRefreshAgent(AgentBase[ConversationState]):

    @property
    def name(self) -> str:
        return "PPT_Creation_Agent"

    @property
    def description(self) -> str:
        return "An agent that generates PowerPoint presentations based on natural language queries. It requires structured data (in JSON format) produced by other agents and uses conversation history to contextualize the request."

    def __init__(self):
        req_env_keys = ['PROVIDER', 'MODEL', 'MODEL_BASE_URL', 'SECRET_NAME', 'DATABRICKS_SERVER_HOSTNAME', 'WORKSPACE_NAME', 'WORKSPACE_BUCKET_NAME']

        env = load_env_variables()

        missing_keys = [key for key in req_env_keys if key not in env]
        if missing_keys:
            raise KeyError(f"Missing required environment variable(s): {', '.join(missing_keys)}")
        provider = env['PROVIDER']
        model = env['MODEL']
        model_base_url = env['MODEL_BASE_URL']
        secret_name = env['SECRET_NAME']
        model_api_key = get_secret(secret_name)
        

        llm_provider = ModelFactory.create_provider(provider=provider, model_name=model,
                                                    base_url=model_base_url,
                                                    api_key=model_api_key)

        llm = llm_provider.get_llm()
        self.final_prompt = "create a deck with the data in the dataframe. Use the default template for the deck. " \
            "To get the latest data from the input use 'LatestDataInContext' tool by passing user request" \
            "if the tool 'LatestDataInContext' returns None then return response 'No data in context to generate the PPT." \
            " without invoking tool 'PPTTool'" \
            "If no dataset is available, then do not create a deck and return response that 'No data in context to generate the PPT." \
            "if 'LatestDataInContext' returns data, Use tool 'PPTTool' to generate the ppt. " \
            "Pass the data as df and {s3_path} as deck_path as dict in the tool call to tool 'PPTTool' as one argument parameter. " \
            "Return the s3 path url where the presentation is uploaded" \


        self.tools = [build_tool_for_ppt_generation(), build_tool_for_data_extraction()]
        skill = AgentSkill(
            id="PPT creation Agent",
            name=self.name,
            description=self.description,
            tags=['Deck', 'PPT', 'Presentation', 'pptx']
        )
        super().__init__(llm=llm, agent_skill=skill)

    async def stream(self, query: str, thread_id: str, metadata: dict = None) -> AsyncIterator[dict[str, Any]]:
        print("Streaming PPT agent...")
        start = perf_counter()
        self.initialize_graph()
        env = load_env_variables()
        user_id = metadata['user_id']
        conversation_id = metadata['conversation_id']
        file_name = uuid.uuid4().hex + ".pptx"
        s3_path = f"s3://{env['WORKSPACE_BUCKET_NAME']}/generated_ppt/users/{user_id}/{conversation_id}/{file_name}"
        self.final_prompt = self.final_prompt.format(s3_path=s3_path)
        state = ConversationState(
            messages=[("user", f"{query} at {s3_path}")],
            metadata={}
        )
        config = {'configurable': {'thread_id': thread_id}}
        async for output in self._agent.astream(state, config):
            print(output)
            if 'state_store' in output.keys():
                final_output = output['state_store']
            else:
                final_output = next(reversed(output.values()))
            
            messages = final_output['messages']
            
            tool_message = None
            ai_message = None
            for msg in reversed(messages):
                tool_message = None
                ai_message = None
                if isinstance(msg, ToolMessage):
                    tool_message = msg
                    break
                elif isinstance(msg, AIMessage):
                    ai_message = msg
                    break
            
            if tool_message:   
                yield {
                    "is_task_complete": False,
                    "require_user_input": False,
                    "content": tool_message.content
                }
                
            if ai_message and ai_message.response_metadata.get('finish_reason') == 'stop':
                
                def state_store(content: str) -> str:
                    """
                    Store the conversation state in memory.
                    """

                    prompt = ChatPromptTemplate.from_template("""
                        You're a helpful assistant. Find valid values with text message and deck path.
                        if the question has mention of no matching job found, then put deck_path as ''
                        Respond in the following format:
                        {format_instruction}
                        DO NOT ADD ANYTHING ELSE TO THE RESPONSE EXCEPT the FORMATTED RESPONSE.
                        Example response: {example_response}

                        Question: {question}
                        Answer:
                        """)

                    chain = prompt | self.llm
                    response = chain.invoke({"question": content, "format_instruction": deck_output_parser.get_format_instructions(), "example_response": example_response})
                    output = response.content
                    return output

                record_response_time((perf_counter() - start) * 1000)
                yield {
                    "is_task_complete": True,
                    "require_user_input": False,
                    "content": state_store(ai_message.content)
                }
                

    @staticmethod
    def serialize_messages(messages):
        return [{"role": "AI", "content": msg} for msg in messages]

    def _build_graph(self):

        main_agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            checkpointer=memory,
            prompt=self.final_prompt
        )
        
        
        builder = StateGraph(ConversationState)
        builder.add_node("main_agent", main_agent)
        builder.set_entry_point("main_agent")

        return builder.compile()


if __name__ == "__main__":
    agent = DeckRefreshAgent()
    base_url = os.getenv("AGENT_BASE_URL")
    agent_port = os.getenv("AGENT_BASE_PORT")
    dynatrace_auth_token = get_secret(os.getenv("APP_SECRET_NAME"))["DYNATRACE_AUTH"]
    agent.run_server(host="0.0.0.0", port=8000, host_base_url=f'http://{base_url}:{agent_port}', path="/v2/agents/ppt",
                     dynatrace_endpoint=os.getenv("DYNATRACE_ENDPOINT"), dynatrace_auth_token=dynatrace_auth_token)