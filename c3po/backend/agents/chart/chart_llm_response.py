"""Pydantic models for chart LLM response structure."""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field, RootModel

class SuitableChart(BaseModel):
    """Model representing a suitable chart configuration."""
    y_columns: List[str] = Field(..., description="List of columns for y-axis (can be single or multiple)")
    x_column: str = Field(..., description="Column for x-axis")
    chart_types: List[str] = Field(..., description="List of suitable chart types for data representation")
    chart_label: str = Field(..., description="Label describing what the chart is about")
    y_label: Optional[str] = Field(None, description="Label for y-axis (mandatory when multiple y_columns exist)")

class ChartLLMResponseItem(BaseModel):
    """Model representing a single item in the chart LLM response."""
    sql: str = Field(..., description="SQL query to run on ingested data")
    suitable_charts: List[SuitableChart] = Field(..., description="List of suitable chart configurations")
    column_mapping: Dict[str, str] = Field(..., description="Mapping of column names to their labels")

class ChartLLMResponse(RootModel[List[ChartLLMResponseItem]]):
    """Model representing the complete chart LLM response structure."""
    pass
