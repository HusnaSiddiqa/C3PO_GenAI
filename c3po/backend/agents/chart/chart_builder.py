from itertools import starmap
from typing import List

from agents.chart.charts import Chart, ChartData, Charts
from agents.chart.intermediate_chart_data import IntermediateChartData


class ChartBuilder:
    CHART_TYPES = 'chart_types'
    X = 'x'
    Y = 'y'
    X_LABEL = 'x_label'
    Y_LABEL = 'y_label'
    PRIORITY = 'priority'
    DATA = 'data'


    def __init__(self, data: List[IntermediateChartData], error_log_fn = print):
        self.data = data
        self.error_log_fn = error_log_fn


    def x_y_count_validation(self, chart: IntermediateChartData):
        y_count = len(chart.y)
        x_count = len(chart.x)
        
        if y_count != x_count:
            raise ValueError("X and Y count must match")
    

    def multi_series_legend_validation(self, chart: IntermediateChartData):
        for series in chart.y:
            if len(series) != len(chart.legend):
                raise ValueError("All Y series must have the same number of "
                                 "data points as legend entries")
    

    def is_multi_series(self, chart: IntermediateChartData):
        return isinstance(chart.y[0], list)
    

    def validate_chart_data(self, chart: IntermediateChartData):
        self.x_y_count_validation(chart)
        
        if self.is_multi_series(chart):
            self.multi_series_legend_validation(chart)
    

    def is_valid_scatter_chart(self, chart: IntermediateChartData):
        if self.is_multi_series(chart):
            return False

        for value in [*chart.x, *chart.y]:
            if isinstance(value, str) and not value.isnumeric():
                return False
        
        return True
    

    def build_chart(self, chart, chart_type):
        chart_dump = chart.model_dump(exclude=[self.CHART_TYPES])

        return Chart(
                type=chart_type,
                data=ChartData(**chart_dump)
            )
    

    def build_charts(self, chart: IntermediateChartData):
        charts = []

        for chart_type in chart.chart_types:
            if chart_type == "scatter" and not self.is_valid_scatter_chart(chart):
                continue
            elif chart_type in ['bar', 'line', 'histogram', 'scatter', 'pie']:
                charts.append(self.build_chart(chart, chart_type))
        
        return charts
    

    def build(self):
        final_charts: List[Chart] = []

        for chart in self.data:
            try:
                self.validate_chart_data(chart)
                final_charts.extend(self.build_charts(chart))
            except Exception as e:
                self.error_log_fn(f"Error validating chart data for {chart}: {e}")
        
        def assign_priority(chart_iter: int, chart: Chart):
            return Chart(
                **chart.model_dump(exclude=[self.DATA]),
                data=ChartData(
                    **chart.data.model_dump(exclude=[self.PRIORITY]),
                    priority=chart_iter + 1))
        
        final_charts = list(starmap(assign_priority, enumerate(final_charts)))
        
        return Charts(final_charts).model_dump_json()