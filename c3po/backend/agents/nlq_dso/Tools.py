import os
import json
from langchain_core.tools import Tool
from core.util.DataWareHouse import DataWarehouse
from pydantic import BaseModel, Field


def generate_sql_code(sql_query: str):
    if sql_query:
        try:
            _client = DataWarehouse(host_name=os.getenv("DATABRICKS_SERVER_HOSTNAME"),
                                    http_path=os.getenv("DATABRICKS_HTTP_PATH"),
                                    access_token=os.getenv("DATABRICKS_TOKEN"))
            result = _client.get_data_from_wareshouse(sql_query)
            return result
        except Exception as e:
            function_response = f"Here is the error : {e}"
            return function_response


def build_generate_sql_tool():
    dynamic_description = (
        """
        Useful when you need to write and run the sql query for data analysis.
        This function is for executing the SQL query to figure out the LATEST DATE from the dataset only when the question pertains to date ranges related to Q1TD, Q2TD, Q3TD, Q4TD, R13W, P13W, R4W, P4W, R12M, and P12M. and perform other data manipulations to answer the user question.
        The code generated here must not contain any logic that involves directly calling calculate_date_ranges. Instead, you will first use this function to get the latest date, and then pass it as a parameter to the calculate_date_ranges function.
        The code to be run should be a stand-alone snippet and should not be dependent on the calculate_date_ranges function call unless the question specifically relates to these date ranges.
        
        Args:
            sql_query: The SQL code you want to execute, for instance, to find the latest date from a dataset or to do advanced data analysis/processing.
            Must be a valid SQL Query, but should NOT include calculate_date_ranges or other conflicting logic, unless the question is related to the date ranges of Q1TD, Q2TD, Q3TD, Q4TD, R13W, P13W, R4W, P4W, R12M, and P12M.
        """
    )

    return Tool(
        name="generate_sql_code",
        description=dynamic_description,
        func=generate_sql_code,
    )

def json_parse_output(content: str):
    print('==============json_parse_output================', content)
    return json.loads(content.strip())


def build_json_parse_tool():
    dynamic_description = (
        """
        Use this tool to validate that your output is correct JSON and fully matches the required schema.
        
        MANDATORY STEPS:
        1. After generating your JSON response, immediately call this tool with your entire output string.  
        2. If the tool returns a JSON error, regenerate the response as a valid JSON object ONLY (no extra text, no explanation).  
        3. Repeat until the tool confirms success.  
        
        Args:
            content: The JSON string that needs to be validated for correct syntax and parseability.
        """
    )

    return Tool(
        name="json_parse_output",
        description=dynamic_description,
        func=json_parse_output
    )