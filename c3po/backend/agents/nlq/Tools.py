import os
import re
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Annotated
from langgraph.prebuilt import InjectedState
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_core.tools import Tool, StructuredTool
from core.util.DataWareHouse import DataWarehouse
from pydantic import BaseModel

from utils.databricks_sql import wrap_query_with_limit

# Matches a string literal (single-quoted) that is the sole argument of a
# fully-qualified TVF call, e.g.  `cat`.`schema`.`tvf`('any value')
# Capture group 1 = everything up to and including the opening paren.
_TVF_STRING_ARG_RE = re.compile(
    r"((?:`[^`]+`|\w+)\.(?:`[^`]+`|\w+)\.(?:`[^`]+`|\w+)\s*\(\s*)'[^']*'(\s*\))",
    re.IGNORECASE,
)



def normalize_tvf_user_args(sql_string: str) -> str:
    """
    Replace string-literal arguments in fully-qualified TVF calls with the
    bare identifier sess_user_email.
      cat.schema.tvf('anything')  →  cat.schema.tvf(sess_user_email)
    Bare sess_user_email identifiers are already correct and are left alone.
    """
    return _TVF_STRING_ARG_RE.sub(r"\1sess_user_email\2", sql_string)


def execute_sql(sql_query: str, user_email: str = ""):
    print('\n=====Executing SQL=====\n' + sql_query + '\n============\n')
    print(f'=====Executing as user: {user_email}=====')
    _client = DataWarehouse(
        host_name=os.getenv("DATABRICKS_SERVER_HOSTNAME"),
        http_path=os.getenv("DATABRICKS_HTTP_PATH"),
        access_token=os.getenv("DATABRICKS_TOKEN"),
        user_email=user_email,
    )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _fetch_data():
        return _client.get_data_from_wareshouse(sql_query)

    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_fetch_data)

    try:
        raw_string_data = future.result(timeout=180)
    finally:
        executor.shutdown(wait=False)

    result = json.loads(raw_string_data)
    return result


def generate_sql_code(sql_query: str, state: Annotated[dict, InjectedState]):
    print('=====generate_sql_code-state=====', state)
    if sql_query:
        print('=======LLM generated sql======', sql_query)
        user_email = state.get('user_email', '')
        json_limit = int(os.getenv('NLQ_JSON_LIMIT', 100))
        final_query = wrap_query_with_limit(sql_query, json_limit)
        final_query = normalize_tvf_user_args(final_query)
        limited_results = execute_sql(final_query, user_email=user_email)
        print('=======limited_results=========', limited_results)
        return json.dumps(limited_results)
    else:
        print('======No SQL query provided to generate_sql_code tool======')
        raise ValueError("No SQL query provided to generate_sql_code tool.")


def build_generate_sql_tool():
    dynamic_description = (
        """
        Useful when you need to write and run the sql query for data analysis.
        This function is for executing the SQL query to figure out the LATEST DATE from the dataset only when the question pertains to date ranges related to Q1TD, Q2TD, Q3TD, Q4TD, R13W, P13W, R4W, P4W, R12M, and P12M. and perform other data manipulations to answer the user question.
        The code generated here must not contain any logic that involves directly calling calculate_date_ranges. Instead, you will first use this function to get the latest date, and then pass it as a parameter to the calculate_date_ranges function.
        The code to be run should be a stand-alone snippet and should not be dependent on the calculate_date_ranges function call unless the question specifically relates to these date ranges.

        CRITICAL NAMING RULE: Every table reference AND every table-valued function (TVF) call in the SQL query MUST be fully qualified using the three-part name format:
            `catalog_name`.`schema_name`.table_or_function_name
        This rule applies equally to regular tables and to TVFs (e.g. job_events_for_user, headcount_for_user).
        NEVER omit the catalog or schema prefix from any table or TVF reference, even if the schema appears obvious from context.
        

        Args:
            sql_query: The SQL code you want to execute, for instance, to find the latest date from a dataset or to do advanced data analysis/processing.
            Must be a valid SQL Query, but should NOT include calculate_date_ranges or other conflicting logic, unless the question is related to the date ranges of Q1TD, Q2TD, Q3TD, Q4TD, R13W, P13W, R4W, P4W, R12M, and P12M.
        """
    )

    return StructuredTool.from_function(
        name="generate_sql_code",
        description=dynamic_description,
        func=generate_sql_code,
    )


class JsonParseArgs(BaseModel):
    tool_input: str | None = None


def json_parse_output(tool_input: str | None = None):
    print('==============json_parse_output================', tool_input)
    if not tool_input:
        raise ValueError("No JSON string provided to json_parse_output tool.")
    return json.loads(tool_input.strip())


def build_json_parse_tool():
    dynamic_description = (
        """
        Useful when you need to VALIDATE and PARSE the final JSON output before returning it to the user.
        This tool MUST be used only AFTER you have finished generating the complete final JSON response.
        Do NOT use this tool while reasoning or while generating intermediate thoughts.
        
        SEQUENCE (MANDATORY):
        1. Generate your FULL final response strictly as valid JSON (no markdown, no explanation, no extra text).
        2. Immediately call this tool with the ENTIRE JSON string you just produced.
        3. If this tool fails to parse the JSON, regenerate the FULL JSON output and call this tool again.
        4. Repeat until the tool successfully parses the JSON.
        
        IMPORTANT RULES:
        - The input MUST be a single string containing the FULL JSON output.
        - Do NOT pass partial JSON.
        - Do NOT call this tool with an empty object {}.
        - Do NOT call this tool without arguments.
        - Do NOT include reasoning, comments, or markdown in the JSON string.
        
        Call example:
        json_parse_output({ "tool_input": "<YOUR ENTIRE JSON OUTPUT STRING>" })
        
        Args:
            tool_input: The complete JSON string that you generated as the final answer.
        """
    )

    return StructuredTool.from_function(
        name="json_parse_output",
        description=dynamic_description,
        func=json_parse_output,
        args_schema=JsonParseArgs,
    )
