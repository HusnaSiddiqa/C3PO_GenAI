from typing import List, Literal, Optional, Union
from pydantic import BaseModel, RootModel

Number = int | float
StringOrNumber = str | Number

class ChartData(BaseModel):
    """Pydantic model representing chart data."""

    legend: List[str]
    """List of legend labels for each data series."""

    x: Union[List[List[StringOrNumber]], List[StringOrNumber]]
    """List of x-axis values."""

    y: Union[List[List[StringOrNumber]], List[StringOrNumber]]
    """List of y-axis values."""

    x_label: str
    """Label for the x-axis."""

    y_label: str
    """Label for the y-axis."""

    label: str
    """Title/label for the chart."""

    priority: Optional[int] = None
    """Priority for the chart, used for ordering in UI."""


class Chart(BaseModel):
    type: Literal['bar', 'line', 'scatter', 'histogram', 'pie']
    """Type of chart to be rendered."""

    data: ChartData


class Charts(RootModel[List[Chart]]):
    pass