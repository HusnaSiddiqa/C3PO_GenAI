import io
import json
from typing import Annotated, Any, Dict

import duckdb
from langchain.tools import tool
from langgraph.prebuilt import InjectedState
import pandas as pd

from agents.chart.chart_builder import ChartBuilder
from agents.chart.data_builder import DataBuilder


@tool
def data_exploration_tool(query: str, state: Annotated[Dict[str, Any], InjectedState]):
    '''
    Use this tool to explore data via DuckDB SQL queries. Once your logic is refined, use the validate_llm_output tool to verify the final query.
    '''
    data_builder = DataBuilder(data=state.get("input_data"), env=state.get("env"),
                               metadata=state.get("metadata"),
                               data_limit_exceeded=state.get("data_limit_exceeded"))
    
    with duckdb.connect() as conn:
        for table_iter, table_data in enumerate(data_builder.build):
            table_name = f'{DataBuilder.TABLE_PREFIX}_{table_iter}'
            df = pd.DataFrame(table_data)
            conn.register(table_name, df)
        
        sql_table_output = conn.sql(query).to_df().to_markdown(index=False)

        print(f'\n=====data exploration tool input:\n{query}\n')
        print(f"=====Result:\n{sql_table_output}\n\n")

        return sql_table_output



@tool
def validate_llm_output(output_query, state: Annotated[Dict[str, Any], InjectedState]):
    '''
    Returns "valid" if LLM output is valid, else returns the error message.
    '''
    output_query_str = json.dumps(output_query)
    print(f'=====tool input: {output_query}')
    print(f"=====Validating LLM output: {state}")

    error_prefix = 'Encountered an error while processing the LLM output. ' \
        'Please review the error message:\n'

    with io.StringIO() as builder:
        error_log_fn = lambda error: builder.write(error + '\n\n')

        data_builder = DataBuilder(data=state.get("input_data"), env=state.get("env"),
                                metadata=state.get("metadata"),
                                data_limit_exceeded=state.get("data_limit_exceeded"),
                                error_log_fn=error_log_fn)
        data_grouping = data_builder.build_intermediate_chart_data(output_query_str)

        error_str = builder.getvalue()
        
        if error_str:
            output = error_prefix + error_str
            print('=====LLM output is invalid', output)
            return output
        
        chart_builder = ChartBuilder(data_grouping, error_log_fn)
        chart_builder.build()

        error_str = builder.getvalue()
        
        if error_str:
            output = error_prefix + error_str
            print('=====LLM output is invalid', output)
            return output
        
        print(f"=====LLM output is valid.")
        return "valid"