"""
Visualization Agent for PowerPoint Generation

This module provides specialized agents for creating data visualizations
optimized for PowerPoint presentations.
"""

import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import io
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
import ast
from enum import Enum
from scipy.interpolate import make_interp_spline
matplotlib.use('Agg')

class VisualizationAgent(BaseTool):
    """
    LangChain tool specialized for creating optimal visualizations for presentations.
    """
    
    name: str = "visualization_agent"
    description: str = """
    An agent that analyzes data and creates the most appropriate visualizations
    for PowerPoint presentations based on data characteristics and LLM recommendations.
    """
    
    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm
        
    def _run(
        self,
        data: pd.DataFrame,
        llm: Optional[Any] = None,
        chart_types: Optional[List[str]] = None,
        max_charts: int = 5,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Generate optimal visualizations for the given data.
        
        Args:
            data: DataFrame containing the data to visualize
            llm: Language model for generating chart recommendations
            chart_types: Specific chart types to include (optional)
            max_charts: Maximum number of charts to generate
            
        Returns:
            List of visualization dictionaries with metadata
        """
        try:
            model = llm or self._llm
            
            # Analyze data structure
            data_profile = self._profile_data(data)
            print("Profiling complete....>>>>>")
            print(data_profile)
            # Get LLM recommendations for visualizations
            viz_recommendations = self._get_viz_recommendations(data_profile, model)
            print("Viz recommendations received....>>>>>")
            print(viz_recommendations)
            # Generate visualizations based on data and recommendations
            visualizations = self._create_recommended_visualizations(
                data, data_profile, viz_recommendations, [], max_charts
            )
            
            return visualizations
            
        except Exception as e:
            return [{"error": f"Error generating visualizations: {str(e)}"}]
    
    def _profile_data(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Create a comprehensive profile of the dataset."""
        profile = {
            'shape': df.shape,
            'columns': list(df.columns),
            'dtypes': df.dtypes.to_dict(),
            'numeric_columns': list(df.select_dtypes(include=[np.number]).columns),
            'categorical_columns': list(df.select_dtypes(include=['object']).columns),
            'datetime_columns': list(df.select_dtypes(include=['datetime64']).columns),
            'missing_values': df.isnull().sum().to_dict(),
            'unique_counts': df.nunique().to_dict(),
            'correlation_strength': {},
            'data_ranges': {},
            'outliers': {}
        }
        
        # Calculate correlation for numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        if len(numeric_df.columns) > 1:
            corr_matrix = numeric_df.corr()
            # Find strong correlations (>0.7 or <-0.7)
            strong_correlations = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if abs(corr_val) > 0.7:
                        strong_correlations.append({
                            'vars': (corr_matrix.columns[i], corr_matrix.columns[j]),
                            'correlation': corr_val
                        })
            profile['correlation_strength'] = strong_correlations
        
        # Calculate data ranges for numeric columns
        for col in profile['numeric_columns']:
            profile['data_ranges'][col] = {
                'min': df[col].min(),
                'max': df[col].max(),
                'mean': df[col].mean(),
                'std': df[col].std(),
                'median': df[col].median()
            }
            
            # Simple outlier detection using IQR
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outlier_count = len(df[(df[col] < Q1 - 1.5*IQR) | (df[col] > Q3 + 1.5*IQR)])
            profile['outliers'][col] = outlier_count
        
        return profile
    
    def _get_viz_recommendations(self, data_profile: Dict[str, Any], llm: Any) -> Dict[str, Any]:
        """Get visualization recommendations from LLM."""
        class ChartType(Enum):
            line: "LINE"
            bar: "BAR"
            scatter: "SCATTER"
            box: "BOX"
            area: "AREA"
        class PromptRecommendationResponse(BaseModel):
            chart_types: str = Field(..., description="Recommended chart types for visualization like line, bar, scatter etc.", examples="line")
            visualization_pairs: Dict[List[str], str] = Field(..., description="Pairs of columns to visualize", examples={"x": ["column1", "column3"], "y": ["column2"]})
            labels: Dict[str, str] = Field(..., description="Labels for the axes", examples={"x_label": "X Axis Label", "y_label": "Y Axis Label"})
            presentation_flow: str = Field(..., description="Recommended flow for the presentation")

        class RecommendationList(BaseModel):
            recommendations: List[PromptRecommendationResponse]

            @classmethod
            def format_instructions(cls):
                schema = cls.model_json_schema()
                fields = schema.get('$defs', {}).get('PromptRecommendationResponse', {}).get('properties', {})
                instructions = ""
                for field, info in fields.items():
                    field_type = info.get('type', 'unknown')
                    field_examples = info.get('examples', [])
                    instructions += f"- {field} ({field_type}), examples {field_examples}\n"
                
                return instructions
        
        prompt = f'''
        Based on the following dataset profile, recommend the best visualizations for a PowerPoint presentation:
        
        Dataset Profile:
        - Shape: {data_profile['shape'][0]} rows, {data_profile['shape'][1]} columns
        - Numeric columns: {data_profile['numeric_columns']}
        - Categorical columns: {data_profile['categorical_columns']}
        - Strong correlations: {data_profile['correlation_strength']}
        - Unique value counts: {data_profile['unique_counts']}
        
        Please recommend:
        1. The top 3-5 most effective chart types for this data. 
        2. visualization_pairs with columns to be used in y and x axis.
        3. What labels should be used in y and x axis as y_label and x_label.
        4. The order of importance for presentation flow

        Response Format:

        [{RecommendationList.format_instructions()},
        {RecommendationList.format_instructions()}]
        Consider that this is for a PowerPoint presentation, so clarity and impact are key.

        

        GUIDELINES:
        ** DO NOT ADD ANY OTHER TEXT APART FROM THE Response Format
        ** DO NOT ADD `json` text before adding response array
        ** DO NOT ADD recommendations (array) text
        '''
        
        try:
            if llm:
                response = llm.invoke(prompt, )
                if hasattr(response, 'content'):
                    recommendations = response.content
                else:
                    recommendations = str(response)
            else:
                recommendations = "LLM not available - using default recommendations"
            if isinstance(recommendations, str):
                recommendations = recommendations.replace("json","")
            
            chart_suggestions, recommendations = self._extract_chart_suggestions(recommendations)
            print("*************")
            return {
                'llm_recommendations': recommendations,
                'suggested_charts': chart_suggestions,
                'priority_variables': self._identify_priority_variables(data_profile)
            }
        except Exception as e:
            return {
                'llm_recommendations': f"Error getting recommendations: {str(e)}",
                'suggested_charts': ['histogram', 'bar', 'scatter'],
                'priority_variables': data_profile['numeric_columns'][:3]
            }
    
    def _extract_chart_suggestions(self, recommendations: dict) -> List[str]:
        """Extract chart type suggestions from LLM response."""
        def find_chart_type(keyword: str, chart_dict: dict) -> str | None:
            keyword = keyword.lower().replace("chart","").replace("plot","").strip(" ")
            
            for chart_type, keywords in chart_dict.items():
                if any(value.lower().replace("_"," ").__contains__(keyword) for value in keywords):
                    return chart_type
            return None
        
        chart_types = []
        
        try:
            recommendations_json = ast.literal_eval(recommendations)
        except Exception as e:
            pass

        try:
            import json
            recommendations_json = json.loads(recommendations)
        except Exception as e:
            recommendations_json = recommendations
        
        if isinstance(recommendations_json, dict):
            recommendations_json = recommendations_json["recommendations"]

        chart_mapping = {
            'histogram': ['histogram', 'distribution', 'frequency'],
            'bar': ['bar chart', 'bar plot', 'categorical', 'grouped bar', 'stacked bar'],
            'scatter': ['scatter', 'correlation', 'relationship'],
            'line': ['line chart', 'trend', 'time series', 'area'],
            'heatmap': ['heatmap', 'correlation matrix', 'heat map'],
            'box': ['box plot', 'outlier', 'quartile'],
            'pie': ['pie chart', 'proportion', 'percentage']
        }
        
        for i, recommendation in enumerate(recommendations_json):
            k = [value for keyword, value in recommendation.items() if keyword=="chart_types"]
            for chart in k:
                c_type = find_chart_type(chart, chart_mapping)
                recommendations_json[i]['orig_chart_types'] = recommendations_json[i]['chart_types']
                recommendations_json[i]['chart_types'] = c_type
                chart_types.append(c_type)

        if not chart_types:
            chart_types = ['histogram', 'bar_chart', 'scatter_plot']
        
        return chart_types, recommendations_json
    
    def _identify_priority_variables(self, data_profile: Dict[str, Any]) -> List[str]:
        """Identify the most important variables to visualize."""
        priority_vars = []
        
        # Prioritize numeric variables with good variance
        for col in data_profile['numeric_columns']:
            if col in data_profile['data_ranges']:
                std_to_mean_ratio = (data_profile['data_ranges'][col]['std'] / 
                                   abs(data_profile['data_ranges'][col]['mean']) 
                                   if data_profile['data_ranges'][col]['mean'] != 0 else 1)
                if 0.1 < std_to_mean_ratio < 10:  # Good variance
                    priority_vars.append(col)
        
        # Add categorical variables with reasonable number of categories
        for col in data_profile['categorical_columns']:
            unique_count = data_profile['unique_counts'].get(col, 0)
            if 2 <= unique_count <= 15:  # Good for visualization
                priority_vars.append(col)
        
        return priority_vars[:5]  # Top 5 priority variables
    
    def _create_recommended_visualizations(
        self,
        df: pd.DataFrame,
        data_profile: Dict[str, Any],
        viz_recommendations: Dict[str, Any],
        chart_types: Optional[List[str]],
        max_charts: int
    ) -> List[Dict[str, Any]]:
        """Create visualizations based on recommendations."""
        visualizations = []
        
        # Use provided chart types or recommended ones
        target_chart_types = chart_types or viz_recommendations['suggested_charts']
        priority_vars = viz_recommendations['priority_variables']
        print("+++++++++++++++")
        print(target_chart_types)
        # Set plotting style
        plt.style.use('default')
        plt.rcParams['figure.figsize'] = (10, 6)
        plt.rcParams['font.size'] = 12
        recommendations = viz_recommendations.get('llm_recommendations', [])
        print("==================")
        print(recommendations)
        chart_count = 0
        for viz_recommend in recommendations:
            print("@@@@@@@@@@@@@@")
            print(viz_recommend["chart_types"])
            # Create correlation heatmap if multiple numeric columns
            if 'heatmap' == viz_recommend["chart_types"] and len(data_profile['numeric_columns']) > 1:
                viz = self._create_correlation_heatmap(df, numeric_cols=data_profile['numeric_columns'], data_profile=data_profile, recommendations=viz_recommend)
                if viz and chart_count < max_charts:
                    visualizations.append(viz)
                    chart_count += 1
            
            # Create histograms for key numeric variables
            if 'histogram' == viz_recommend["chart_types"]:
                for col in priority_vars:
                    if col in data_profile['numeric_columns'] and chart_count < max_charts:
                        viz = self._create_enhanced_histogram(df, col, data_profile, viz_recommend)
                        if viz:
                            visualizations.append(viz)
                            chart_count += 1
            
            # Create bar charts for categorical variables
            if 'bar' == viz_recommend["chart_types"]:
                for col in priority_vars:
                    if col in data_profile['categorical_columns'] and chart_count < max_charts:
                        viz = self._create_enhanced_bar_chart(df, col, data_profile, viz_recommend)
                        if viz:
                            visualizations.append(viz)
                            chart_count += 1
            
            # Create line charts for categorical variables
            if 'line' == viz_recommend["chart_types"]:
                for col in priority_vars:
                    if col in data_profile['categorical_columns'] and chart_count < max_charts:
                        viz = self._create_enhanced_line_chart(df, col, data_profile, viz_recommend)
                        if viz:
                            visualizations.append(viz)
                            chart_count += 1
            
            # Create scatter plots for correlated variables
            if 'scatter' == viz_recommend["chart_types"] and len(data_profile['numeric_columns']) >= 2:
                correlations = data_profile['correlation_strength']
                print("***&&&****data_profile******&&&****")
                print(data_profile)
                print("++++++++correlation++++++++")
                print(correlations)
                if correlations and chart_count < max_charts:
                    # Use the strongest correlation
                    best_corr = max(correlations, key=lambda x: abs(x['correlation']))
                    viz = self._create_enhanced_scatter_plot(
                        df, best_corr['vars'][0], best_corr['vars'][1]
                    )
                    if viz:
                        visualizations.append(viz)
                        chart_count += 1
            
            # Create box plots for outlier analysis
            if 'box' == viz_recommend["chart_types"]:
                for col in priority_vars:
                    if (col in data_profile['numeric_columns'] and 
                        data_profile['outliers'].get(col, 0) > 0 and 
                        chart_count < max_charts):
                        viz = self._create_box_plot(df, col)
                        if viz:
                            visualizations.append(viz)
                            chart_count += 1
            
        return visualizations
    
    def _create_correlation_heatmap(self, df: pd.DataFrame, numeric_cols: List[str], data_profile, recommendations) -> Optional[Dict[str, Any]]:
        """Create an enhanced correlation heatmap."""
        try:
            fig, ax = plt.subplots(figsize=(10, 8))
            correlation_matrix = df[numeric_cols].corr()
            
            # Create heatmap with better styling
            im = ax.imshow(correlation_matrix, cmap='RdBu_r', aspect='auto', vmin=-1, vmax=1)
            
            # Add colorbar
            cbar = plt.colorbar(im, ax=ax)
            cbar.set_label('Correlation Coefficient', rotation=270, labelpad=15)
            
            # Set ticks and labels
            ax.set_xticks(range(len(numeric_cols)))
            ax.set_yticks(range(len(numeric_cols)))
            ax.set_xticklabels(numeric_cols, rotation=45, ha='right')
            ax.set_yticklabels(numeric_cols)
            
            # Add correlation values as text
            for i in range(len(numeric_cols)):
                for j in range(len(numeric_cols)):
                    text = ax.text(j, i, f'{correlation_matrix.iloc[i, j]:.2f}',
                                 ha="center", va="center", color="black", fontweight='bold')
            
            ax.set_title('Variable Correlation Matrix', fontsize=16, fontweight='bold', pad=20)
            plt.tight_layout()
            
            # Save to buffer
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            
            return {
                'type': 'heatmap',
                'title': 'Correlation Analysis',
                'image_buffer': img_buffer,
                'description': 'Correlation matrix showing relationships between numeric variables',
                'insights': 'Strong correlations (>0.7 or <-0.7) indicate related variables'
            }
        except Exception as e:
            print(f"Error creating correlation heatmap: {e}")
            return None
    
    def _create_enhanced_histogram(self, df: pd.DataFrame, column: str, data_profile, recommendation) -> Optional[Dict[str, Any]]:
        """Create an enhanced histogram with statistics."""
        try:
            fig, ax = plt.subplots(figsize=(10, 6))
            
            # Create histogram
            n, bins, patches = ax.hist(df[column], bins=30, alpha=0.7, color='skyblue', edgecolor='black')
            
            # Add statistics lines
            mean_val = df[column].mean()
            median_val = df[column].median()
            
            ax.axvline(mean_val, color='red', linestyle='--', linewidth=2, label=f'Mean: {mean_val:.2f}')
            ax.axvline(median_val, color='orange', linestyle='--', linewidth=2, label=f'Median: {median_val:.2f}')
            
            ax.set_title(f'Distribution of {column}', fontsize=14, fontweight='bold')
            ax.set_xlabel(column)
            ax.set_ylabel('Frequency')
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            # Save to buffer
            img_buffer = io.BytesIO()
            # plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            fig.savefig("x.png", format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            
            return {
                'type': 'histogram',
                'title': f'Distribution of {column}',
                'image_buffer': img_buffer,
                'description': f'Frequency distribution showing the spread of {column} values',
                'insights': f'Mean: {mean_val:.2f}, Median: {median_val:.2f}, Std: {df[column].std():.2f}'
            }
        except Exception as e:
            print(f"Error creating enhanced histogram for {column}: {e}")
            return None
    
    def _create_enhanced_bar_chart(self, df: pd.DataFrame, column: str, data_profile, recommendation) -> Optional[Dict[str, Any]]:
        """Create an enhanced bar chart for categorical data."""

        try:
            print("Plotting Bar chart as per recommendation below ....>>>>>")
            print(recommendation)
            fig, ax = plt.subplots(figsize=(12, 6))
            available_numeric_cols = data_profile['numeric_columns']
            y = recommendation['visualization_pairs'].get("y",[])
            numeric_cols = list(set(available_numeric_cols) & set(y))
            x = range(len(df[column]))
            print(numeric_cols)
            print(column)
            num_bars = len(numeric_cols)
            
            total_bar_space = 0.8
            bar_width = total_bar_space / num_bars

            cmap = plt.colormaps['tab10']
            colors = cmap(np.linspace(0, 1, 10))

            for i, n_col in enumerate(numeric_cols):
                offsets = [pos + (i - num_bars/2)*bar_width + bar_width/2 for pos in x]
                bars = ax.bar(offsets,
                            df[n_col],
                            width=bar_width,
                            label=n_col,
                            color=colors[i],
                            alpha=0.8)
                for bar in bars:
                    height = bar.get_height()
                    if height > 99:
                        break
                    ax.text(
                        bar.get_x() + bar.get_width() / 2,
                        height,
                        f'{height:.1f}',
                        ha='center',
                        va='bottom',
                        fontsize=9,
                        color='black'
                    )
            title = recommendation.get("presentation_flow", "")
            ax.set_title(f'{title}', fontsize=14, fontweight='bold')
            ax.set_xlabel(column)
            ax.set_ylabel(recommendation.get('y_label',"Count"))
            ax.set_xticks(range(len(df[column])))
            ax.set_xticklabels(df[column], rotation=45, ha='right')
            ax.grid(True, alpha=0.3, axis='y')
            ax.legend(loc='upper right')
            plt.tight_layout()
            
            # Save to buffer
            img_buffer = io.BytesIO()
            fig.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            # fig.savefig("x.png", format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            
            total_categories = df[column].nunique()
            percentage_covered = (len(df[numeric_cols[0]]) / total_categories) * 100
                
            return {
                'type': 'bar',
                'title': title,
                'image_buffer': img_buffer,
                'description': f'Bar chart showing the most frequent categories in {column}',
                'insights': f'Top {len(x)} categories represent {percentage_covered:.1f}% of all categories'
            }
        except Exception as e:
            print(f"Error creating enhanced bar chart for {column}: {e}")
            return None

    def _create_enhanced_line_chart(self, df: pd.DataFrame, column: str, data_profile, recommendation) -> Optional[Dict[str, Any]]:
        """Create an enhanced line chart for time series or trend visualization."""
        try:
            # Extract x and y columns from recommendation
            x_cols = recommendation.get('visualization_pairs', {}).get('x', [])
            y_cols = recommendation.get('visualization_pairs', {}).get('y', [])
            x_col = x_cols[0] if x_cols else column
            y_cols = y_cols if y_cols else (data_profile['numeric_columns'] if data_profile['numeric_columns'] else None)
            if y_cols is None:
                raise ValueError('No valid y column found for line chart')

            fig, ax = plt.subplots(figsize=(12, 6))
            cmap = plt.colormaps['tab10']
            colors = cmap(np.linspace(0, 1, 10))

            for i, y_col in enumerate(y_cols):
                ax.plot(df[x_col], df[y_col], marker='o', linestyle='-', color=colors[i % len(colors)], linewidth=2, alpha=0.8)
            title = recommendation.get('presentation_flow', f'{y_col} over {x_col}')
            x_label = recommendation.get('labels', {}).get('x_label', x_col)
            y_label = recommendation.get('labels', {}).get('y_label', y_col)
            ax.set_title(title, fontsize=14, fontweight='bold')
            ax.set_xlabel(x_label)
            ax.set_ylabel(y_label)
            ax.grid(True, alpha=0.3)
            plt.xticks(rotation=45, ha='right')
            ax.legend(loc='upper right')
            plt.tight_layout()
            
            img_buffer = io.BytesIO()
            fig.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            # fig.savefig("x.png", format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            min_val = df[y_col].min()
            max_val = df[y_col].max()
            trend = 'increasing' if df[y_col].iloc[-1] > df[y_col].iloc[0] else 'decreasing'
            return {
                'type': 'line',
                'title': title,
                'image_buffer': img_buffer,
                'description': f'Line chart showing {y_col} over {x_col}',
                'insights': f'Min: {min_val:.2f}, Max: {max_val:.2f}, Overall trend: {trend}'
            }
        except Exception as e:
            print(f"Error creating enhanced line chart for {column}: {e}")
            return None
    
    def _create_enhanced_scatter_plot(self, df: pd.DataFrame, x_col: str, y_col: str) -> Optional[Dict[str, Any]]:
        """Create an enhanced scatter plot with trend line."""
        try:
            fig, ax = plt.subplots(figsize=(10, 8))
            
            # Create scatter plot
            ax.scatter(df[x_col], df[y_col], alpha=0.6, c='blue', s=50)
            
            # Add trend line
            z = np.polyfit(df[x_col], df[y_col], 1)
            p = np.poly1d(z)
            ax.plot(df[x_col], p(df[x_col]), "r--", alpha=0.8, linewidth=2, label='Trend Line')
            
            # Calculate and display correlation
            correlation = df[x_col].corr(df[y_col])
            
            ax.set_title(f'{x_col} vs {y_col}\nCorrelation: {correlation:.3f}', 
                        fontsize=14, fontweight='bold')
            ax.set_xlabel(x_col)
            ax.set_ylabel(y_col)
            ax.legend()
            ax.grid(True, alpha=0.3)
            
            # Save to buffer
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            
            # Interpret correlation strength
            if abs(correlation) > 0.8:
                strength = "very strong"
            elif abs(correlation) > 0.6:
                strength = "strong"
            elif abs(correlation) > 0.4:
                strength = "moderate"
            else:
                strength = "weak"
            
            return {
                'type': 'scatter',
                'title': f'{x_col} vs {y_col}',
                'image_buffer': img_buffer,
                'description': f'Scatter plot showing relationship between {x_col} and {y_col}',
                'insights': f'{strength.capitalize()} {"positive" if correlation > 0 else "negative"} correlation (r={correlation:.3f})'
            }
        except Exception as e:
            print(f"Error creating enhanced scatter plot: {e}")
            return None
    
    def _create_box_plot(self, df: pd.DataFrame, column: str) -> Optional[Dict[str, Any]]:
        """Create a box plot for outlier analysis."""
        try:
            fig, ax = plt.subplots(figsize=(8, 6))
            
            box_plot = ax.boxplot(df[column], patch_artist=True)
            box_plot['boxes'][0].set_facecolor('lightblue')
            
            ax.set_title(f'Box Plot of {column}', fontsize=14, fontweight='bold')
            ax.set_ylabel(column)
            ax.grid(True, alpha=0.3)
            
            # Calculate outlier statistics
            Q1 = df[column].quantile(0.25)
            Q3 = df[column].quantile(0.75)
            IQR = Q3 - Q1
            outliers = df[(df[column] < Q1 - 1.5*IQR) | (df[column] > Q3 + 1.5*IQR)]
            
            # Save to buffer
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=300, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close()
            
            return {
                'type': 'box_plot',
                'title': f'Box Plot Analysis - {column}',
                'image_buffer': img_buffer,
                'description': f'Box plot showing distribution and outliers in {column}',
                'insights': f'Detected {len(outliers)} outliers ({len(outliers)/len(df)*100:.1f}% of data)'
            }
        except Exception as e:
            print(f"Error creating box plot for {column}: {e}")
            return None

    async def _arun(self, *args, **kwargs):
        """Async version of the tool (not implemented)."""
        raise NotImplementedError("Async version not implemented")
