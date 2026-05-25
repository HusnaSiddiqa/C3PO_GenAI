"""Pydantic model for chart data structure."""

from typing import List, Literal

from pydantic import BaseModel

Number = int | float

class IntermediateChartData(BaseModel):
    """Pydantic model representing intermediate chart data with multiple series."""

    legend: List[str]
    """List of legend labels for each data series."""

    x: List[str] | List[Number]
    """List of x-axis values."""

    y: List[List[Number]] | List[Number]
    """List of y-axis values, where each inner list represents a series."""

    x_label: str
    """Label for the x-axis."""

    y_label: str
    """Label for the y-axis."""

    label: str
    """Title/label for the chart."""

    chart_types: List[Literal['bar', 'line', 'scatter', 'histogram', 'pie']]
    """List of chart types (e.g., ['line', 'bar'])."""
