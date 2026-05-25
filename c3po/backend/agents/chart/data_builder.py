from functools import cached_property
import json
import re
import traceback
from typing import Any, List, Optional
import duckdb
import pandas as pd

from agents.chart.intermediate_chart_data import IntermediateChartData
from agents.chart.chart_llm_response import ChartLLMResponse, SuitableChart


class DataBuilder:
    TABLE_PREFIX = 'data_table'

    def __init__(self, *, data: list, env: dict, 
                 metadata: Optional[dict] = None, 
                 data_limit_exceeded: bool = False,
                 error_log_fn = print):
        self.data = data
        self.metadata = metadata
        self.env = env
        self.data_limit_exceeded = data_limit_exceeded
        self.error_log_fn = error_log_fn
    
    @cached_property
    def build(self):
        if not isinstance(self.data, list):
            return []

        data_grouping: dict[frozenset, list] = {}

        for data_item in self.data:
            if isinstance(data_item, dict):
                keys = frozenset(data_item.keys())
                
                if keys not in data_grouping:
                    data_grouping[keys] = []
                
                data_grouping[keys].append(data_item)
           
        return list(map(self.get_dataframe, data_grouping.values()))


    def get_dataframe(self, dataset: list[dict[str, Any]]):
        df = pd.DataFrame(dataset)
        df_length = len(df)

        for column in df.select_dtypes(include=['object']).columns:
            if df[column].nunique() / df_length < 0.2:
                df[column] = df[column].astype('category')
            elif df[column].dtype == 'object':
                df[column] = df[column].astype('string')
        
        return df
    

    @staticmethod
    def get_categorical_summary_md(df):
        # 1. Identify categorical or object columns
        cat_cols = df.select_dtypes(include=['category']).columns
        
        # 2. Build a list of data for the new DataFrame
        summary_data = []
        for col in cat_cols:
            unique_vals = df[col].unique()
            # Clean up: convert to list of strings and join
            vals_str = ", ".join(map(str, unique_vals))
            
            summary_data.append({
                "Column Name": col,
                "Unique Values": vals_str
            })
        
        # 3. Create the summary DataFrame
        summary_df = pd.DataFrame(summary_data)
        
        # 4. Return as a Markdown table (requires 'tabulate' library)
        return summary_df.to_markdown(index=False)
    

    @staticmethod
    def get_llm_prompt_context(df: pd.DataFrame):
        output = ''
        # 1. Basic Info (Dimensions & Columns)
        output += f"Dataset Shape: {df.shape}\n"
        output += "\nColumns and Types:\n"
        output += df.dtypes.to_markdown() + '\n'

        categorical_summary = DataBuilder.get_categorical_summary_md(df)
        if categorical_summary:
            output += "\nUnique values in each category:\n"
            output += categorical_summary + '\n'

        # 2. Statistical Summary (Helps LLM understand ranges/outliers)
        output += "\nSummary Statistics:\n"
        output += df.describe().to_markdown() + '\n'

        # 3. Data Sample (Random rows are better than head() to show variety)
        output += "\nData Sample (Random 5 rows):\n"
        output += df.sample(min(len(df), 5)).astype(str).replace("nan", "").to_markdown(index=False) + '\n'

        return output
    

    def build_data_sample(self, n=10):
        built_data = self.build

        sample_string = ''
        
        for sample_iter, df in enumerate([table_data[:n] for table_data in built_data]):
            sample_string += f'#### Description of `{self.TABLE_PREFIX}_{sample_iter}` table:\n'
            sample_string += DataBuilder.get_llm_prompt_context(df)
            sample_string += '\n'
        
        return sample_string
    

    def build_intermediate_chart_data(self, raw_data_from_llm: str):
        try:
            match = re.search(r'\[.*\]', raw_data_from_llm, re.DOTALL)
            trimmed_text = match.group(0)

            pattern = r'[\x00-\x1f\x7f]'
            cleaned_text = re.sub(pattern, ' ', trimmed_text)

            parsed_json = json.loads(cleaned_text)
            response = ChartLLMResponse(parsed_json)
            print(f"LLM Response JSON: {json.dumps(parsed_json)}")
        except Exception as e:
            self.error_log_fn("Error parsing LLM Response JSON - " + 
                  raw_data_from_llm.replace('\n', ' ') + f': {e}')
            return []
        
        conn = duckdb.connect()

        tables_names = []
        
        for table_iter, table_data in enumerate(self.build):
            table_name = f'{self.TABLE_PREFIX}_{table_iter}'
            tables_names.append(table_name)
            df = pd.DataFrame(table_data)
            conn.register(table_name, df)
        
        all_chart_data: List[IntermediateChartData] = []
        
        for item in response.root:
            try:
                df = conn.sql(item.sql).to_df()
            except Exception as e:
                self.error_log_fn(f"Error executing SQL {item.sql}: {e}")
                continue

            for chart in item.suitable_charts:
                try:
                    x_label = item.column_mapping[chart.x_column]
                    x = df[chart.x_column].to_list()
                    y_label = chart.y_label if len(chart.y_columns) > 1 else \
                        item.column_mapping[chart.y_columns[0]]
                    y = self.transpose_columns_to_series(df, chart)
                    legend = list(map(lambda col: item.column_mapping[col], chart.y_columns))
                    
                    all_chart_data.append(IntermediateChartData(
                        legend=legend,
                        x=x,
                        y=y,
                        x_label=x_label,
                        y_label=y_label,
                        label=chart.chart_label,
                        chart_types=chart.chart_types,
                    ))
                except Exception as e:
                    self.error_log_fn(
                        f'Error processing chart: {chart}\n'
                        f'Error: {e}\n'
                        f'Stack trace: {traceback.format_exc()}\n'
                    )
                    continue

        for table_name in tables_names:
            conn.unregister(table_name)
        
        conn.close()
        
        return all_chart_data


    def transpose_columns_to_series(self, df: pd.DataFrame, chart: SuitableChart):
        if len(chart.y_columns) == 1:
            return df[chart.y_columns[0]].to_list()
        else:
            return list(map(list, zip(*[df[col].to_list() for col in chart.y_columns])))
