"""
Sample usage script for PowerPoint Generation Tool

This script demonstrates how to use the PPT generation tool with different scenarios.
"""
import os
import sys
import re
print(sys.path)
import pandas as pd
import numpy as np
from ppt_generator import create_ppt_from_csv, PPTGenerator
from visualization_agent import VisualizationAgent
from summary_agent import SummaryAgent
import os
from core.util.ConfigLoader import load_env_variables
from core.model_provider.factory import ModelFactory
from langchain.agents import Tool
import ast
import json
from utils.s3 import upload_to_s3_path
from utils.generic import get_secret
import uuid


def advanced_ppt(llm, df, deck_path):
    """Example 2: Advanced usage with individual components."""
    print("Advanced PPT generation started")
    parsed_data = None
    
    if isinstance(df, str):
        df = df.replace("'","\"")
        parsed_data = ast.literal_eval(df)
    elif isinstance(df, list):
        parsed_data = df
    print("parsing complete")
    df = pd.DataFrame(parsed_data)
    if df is not None and isinstance(df, pd.DataFrame):
        if not df.empty:
            print(f"Generated sample data: {len(df)} rows, {len(df.columns)} columns")
            
            print("\nGenerating visualizations...")
            viz_agent = VisualizationAgent(llm=llm)
            visualizations = viz_agent._run(
                data=df,
                chart_types=['histogram', 'scatter', 'heatmap', 'bar'],
                max_charts=4
            )
            print(f"Generated {len(visualizations)} visualizations")
            print("\nGenerating summary and insights...")
            summary_agent = SummaryAgent(llm=llm)
            summary = summary_agent._run(
                data=df,
                summary_type='comprehensive'
            )
            print("Summary generated successfully")
            print("\nCreating presentation...")
            generator = PPTGenerator(llm=llm)
            local_file_name=uuid.uuid4().hex + ".pptx"
            
            try:
                result = generator._run(
                    template_path="",  # Use default template
                    df=df,
                    output_path=local_file_name,
                    llm=llm,
                    visualizations=visualizations,
                    summary=summary
                )
                print("Generation complete, uploading to s3")
                try:
                    with open(local_file_name, "rb") as f:
                        file_content = f.read()
                        upload_to_s3_path(file_content, deck_path)
                finally:
                    os.remove(local_file_name)
                    # pass
                print(f"Result: {result}")
                
            finally:
                pass

def LatestDataInContext(query: str):
    """Tool to extract List of dict from data"""
    print("###LatestDataInContext tool called with query###")
    
    env = load_env_variables()
    provider = env['PROVIDER']
    model_api_key = get_secret(os.environ["SECRET_NAME"])
    model = env['MODEL']
    model_base_url = env['MODEL_BASE_URL']
    prompt = "create a list of dict of stringified json array. create valid python dict structure." \
            "Remove any nested escape characters from the dict." \
            "DO NOT ADD ANY NEW TAGS AND JUST RETURN LIST OF DICT FROM THE INPUT." \
            "Input: " + query + \
            "Output: "
    llm_provider = ModelFactory.create_provider(provider=provider, model_name=model,
                                                    base_url=model_base_url,
                                                    api_key=model_api_key)
    llm = llm_provider.get_llm()
    response = llm.invoke(prompt=prompt)

    if response:
        data = response.content
    else:
        data = None
    return data

def main(df, deck_path):
    """Main function to run all examples."""
    print("PowerPoint Generation Tool - Sample Usage")
    print("=" * 60)
    env = load_env_variables()
    provider = env['PROVIDER']
    model_api_key = get_secret(os.environ["SECRET_NAME"])
    model = env['MODEL']
    model_base_url = env['MODEL_BASE_URL']
    llm_provider = ModelFactory.create_provider(provider=provider, model_name=model,
                                                    base_url=model_base_url,
                                                    api_key=model_api_key)
    llm = llm_provider.get_llm()
    try:
        
        advanced_ppt(llm, df, deck_path)
        
    except Exception as e:
        print(f"Error running PPT tool: {e}")

def build_tool_for_ppt_generation():
    df_tool = Tool(
        name="PPTTool",
        func=lambda x: main(**json.loads(x)),
        description="""Use this tool to generate PowerPoint presentations from a DataFrame.
            Input: 
                df: A stringified json data with array of dictionaries representing the DataFrame.
                deck_path: The path where the generated PowerPoint file will be saved.
            """
    )
    return df_tool

def build_tool_for_data_extraction():
    df_tool = Tool(
        name="LatestDataInContext",
        func=lambda x: LatestDataInContext(**json.loads(x)),
        description="""Use this tool to extract the latest data from the context.
            Input: 
                query: A stringified json data with array of dictionaries representing the DataFrame.
            """
    )
    return df_tool

