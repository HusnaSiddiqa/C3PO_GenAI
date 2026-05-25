"""
Summary Agent for PowerPoint Generation

This module provides specialized agents for generating data summaries
and insights optimized for PowerPoint presentations.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from langchain.tools import BaseTool


class SummaryAgent(BaseTool):
    """
    LangChain tool specialized for creating comprehensive data summaries and insights.
    """
    
    name: str = "summary_agent"
    description: str = """
    An agent that analyzes data and generates executive summaries, key insights,
    and recommendations suitable for PowerPoint presentations.
    """
    
    def __init__(self, llm=None, **kwargs):
        super().__init__(**kwargs)
        self._llm = llm
        
    def _run(
        self,
        data: pd.DataFrame,
        llm: Optional[Any] = None,
        summary_type: str = "comprehensive",
        focus_areas: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate comprehensive summary and insights for the given data.
        
        Args:
            data: DataFrame containing the data to analyze
            llm: Language model for generating insights
            summary_type: Type of summary ('executive', 'comprehensive', 'technical')
            focus_areas: Specific areas to focus on (optional)
            
        Returns:
            Dictionary containing various summary components
        """
        try:
            model = llm or self._llm
            
            # Generate statistical summary
            statistical_summary = self._generate_statistical_summary(data)
            
            # Generate data quality assessment
            quality_assessment = self._assess_data_quality(data)
            
            # Generate insights using LLM
            llm_insights = self._generate_llm_insights(
                data, statistical_summary, quality_assessment, model, summary_type
            )
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                data, statistical_summary, quality_assessment, model
            )
            
            # Create executive summary
            executive_summary = self._create_executive_summary(
                statistical_summary, llm_insights, recommendations, model
            )
            
            return {
                'executive_summary': executive_summary,
                'statistical_summary': statistical_summary,
                'quality_assessment': quality_assessment,
                'insights': llm_insights,
                'recommendations': recommendations,
                'key_metrics': self._extract_key_metrics(data),
                'data_story': self._create_data_story(data, model)
            }
            
        except Exception as e:
            return {"error": f"Error generating summary: {str(e)}"}
    
    def _generate_statistical_summary(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Generate comprehensive statistical summary of the dataset."""
        summary = {
            'basic_info': {
                'total_records': len(df),
                'total_columns': len(df.columns),
                'memory_usage': f"{df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB",
                'column_names': list(df.columns)
            },
            'data_types': {
                'numeric_columns': list(df.select_dtypes(include=[np.number]).columns),
                'categorical_columns': list(df.select_dtypes(include=['object']).columns),
                'datetime_columns': list(df.select_dtypes(include=['datetime64']).columns),
                'boolean_columns': list(df.select_dtypes(include=['bool']).columns)
            },
            'missing_data': {
                'total_missing': df.isnull().sum().sum(),
                'missing_percentage': (df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100,
                'columns_with_missing': df.columns[df.isnull().any()].tolist(),
                'missing_by_column': df.isnull().sum().to_dict()
            },
            'numeric_summary': {},
            'categorical_summary': {},
            'unique_values': df.nunique().to_dict()
        }
        
        # Detailed numeric analysis
        numeric_cols = summary['data_types']['numeric_columns']
        if numeric_cols:
            numeric_df = df[numeric_cols]
            summary['numeric_summary'] = {
                'descriptive_stats': numeric_df.describe().to_dict(),
                'correlations': numeric_df.corr().to_dict() if len(numeric_cols) > 1 else {},
                'skewness': numeric_df.skew().to_dict(),
                'kurtosis': numeric_df.kurtosis().to_dict()
            }
        
        # Detailed categorical analysis
        categorical_cols = summary['data_types']['categorical_columns']
        if categorical_cols:
            summary['categorical_summary'] = {}
            for col in categorical_cols[:5]:  # Limit to first 5 categorical columns
                value_counts = df[col].value_counts()
                summary['categorical_summary'][col] = {
                    'unique_count': len(value_counts),
                    'most_frequent': value_counts.index[0] if len(value_counts) > 0 else None,
                    'most_frequent_count': value_counts.iloc[0] if len(value_counts) > 0 else 0,
                    'top_5_values': value_counts.head().to_dict()
                }
        
        return summary
    
    def _assess_data_quality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Assess the quality of the dataset."""
        quality = {
            'completeness_score': 0,
            'consistency_score': 0,
            'validity_score': 0,
            'overall_quality': 'Unknown',
            'issues': [],
            'recommendations': []
        }
        
        # Completeness assessment
        total_cells = len(df) * len(df.columns)
        missing_cells = df.isnull().sum().sum()
        completeness = ((total_cells - missing_cells) / total_cells) * 100
        quality['completeness_score'] = completeness
        
        if completeness < 90:
            quality['issues'].append(f"Data completeness is {completeness:.1f}% - significant missing values detected")
            quality['recommendations'].append("Consider data imputation or collection improvement")
        
        # Consistency assessment (basic checks)
        consistency_issues = 0
        
        # Check for duplicate rows
        duplicates = df.duplicated().sum()
        if duplicates > 0:
            consistency_issues += 1
            quality['issues'].append(f"Found {duplicates} duplicate rows ({duplicates/len(df)*100:.1f}%)")
            quality['recommendations'].append("Remove or investigate duplicate records")
        
        # Check for extreme outliers in numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outlier_columns = []
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            extreme_outliers = len(df[(df[col] < Q1 - 3*IQR) | (df[col] > Q3 + 3*IQR)])
            if extreme_outliers > len(df) * 0.05:  # More than 5% extreme outliers
                outlier_columns.append(col)
                consistency_issues += 1
        
        if outlier_columns:
            quality['issues'].append(f"High number of outliers in columns: {', '.join(outlier_columns)}")
            quality['recommendations'].append("Investigate and validate outlier values")
        
        consistency = max(0, 100 - (consistency_issues * 20))  # Deduct 20 points per issue
        quality['consistency_score'] = consistency
        
        # Validity assessment (basic format checks)
        validity_issues = 0
        
        # Check for negative values where they might not make sense
        for col in numeric_cols:
            if 'count' in col.lower() or 'quantity' in col.lower() or 'amount' in col.lower():
                negative_count = (df[col] < 0).sum()
                if negative_count > 0:
                    validity_issues += 1
                    quality['issues'].append(f"Negative values in {col} (count/quantity field)")
        
        validity = max(0, 100 - (validity_issues * 25))  # Deduct 25 points per issue
        quality['validity_score'] = validity
        
        # Overall quality score
        overall_score = (completeness + consistency + validity) / 3
        if overall_score >= 90:
            quality['overall_quality'] = 'Excellent'
        elif overall_score >= 75:
            quality['overall_quality'] = 'Good'
        elif overall_score >= 60:
            quality['overall_quality'] = 'Fair'
        else:
            quality['overall_quality'] = 'Poor'
        
        quality['overall_score'] = overall_score
        
        return quality
    
    def _generate_llm_insights(
        self, 
        df: pd.DataFrame, 
        statistical_summary: Dict[str, Any], 
        quality_assessment: Dict[str, Any],
        llm: Any,
        summary_type: str
    ) -> Dict[str, Any]:
        """Generate insights using LLM."""
        if not llm:
            return {"insights": "LLM not available for generating insights"}
        
        # Prepare data context for LLM
        data_context = self._prepare_data_context(df, statistical_summary, quality_assessment)
        
        # Create prompts based on summary type
        if summary_type == "executive":
            prompt = self._create_executive_prompt(data_context)
        elif summary_type == "technical":
            prompt = self._create_technical_prompt(data_context)
        else:  # comprehensive
            prompt = self._create_comprehensive_prompt(data_context)
        
        try:
            response = llm.invoke(prompt)
            if hasattr(response, 'content'):
                insights_text = response.content
            else:
                insights_text = str(response)
            
            # Parse insights into structured format
            parsed_insights = self._parse_insights(insights_text)
            
            return {
                'raw_insights': insights_text,
                'parsed_insights': parsed_insights,
                'key_findings': self._extract_key_findings(insights_text),
                'actionable_items': self._extract_actionable_items(insights_text)
            }
            
        except Exception as e:
            return {"insights": f"Error generating LLM insights: {str(e)}"}
    
    def _prepare_data_context(
        self, 
        df: pd.DataFrame, 
        statistical_summary: Dict[str, Any], 
        quality_assessment: Dict[str, Any]
    ) -> str:
        """Prepare comprehensive data context for LLM."""
        context = f"""
Dataset Overview:
- Records: {statistical_summary['basic_info']['total_records']:,}
- Variables: {statistical_summary['basic_info']['total_columns']}
- Data Quality: {quality_assessment['overall_quality']} ({quality_assessment['overall_score']:.1f}/100)

Variable Types:
- Numeric: {len(statistical_summary['data_types']['numeric_columns'])} columns
- Categorical: {len(statistical_summary['data_types']['categorical_columns'])} columns
- Datetime: {len(statistical_summary['data_types']['datetime_columns'])} columns

Data Quality Issues:
{chr(10).join(['- ' + issue for issue in quality_assessment['issues'][:5]])}

Sample Data (first 5 rows):
{df.head().to_string()}

Key Statistics:
"""
        
        # Add numeric statistics
        if statistical_summary['numeric_summary']:
            context += "\nNumeric Variables Summary:\n"
            for col in list(statistical_summary['data_types']['numeric_columns'])[:3]:
                if col in statistical_summary['numeric_summary']['descriptive_stats']:
                    stats = statistical_summary['numeric_summary']['descriptive_stats'][col]
                    context += f"- {col}: Mean={stats.get('mean', 0):.2f}, Std={stats.get('std', 0):.2f}, Range=[{stats.get('min', 0):.2f}, {stats.get('max', 0):.2f}]\n"
        
        # Add categorical statistics
        if statistical_summary['categorical_summary']:
            context += "\nCategorical Variables Summary:\n"
            for col, stats in list(statistical_summary['categorical_summary'].items())[:3]:
                context += f"- {col}: {stats['unique_count']} unique values, most frequent: '{stats['most_frequent']}' ({stats['most_frequent_count']} times)\n"
        
        return context
    
    def _create_executive_prompt(self, data_context: str) -> str:
        """Create executive-level analysis prompt."""
        return f"""
As a senior data analyst, provide an executive summary of this dataset for a business presentation.

{data_context}

Please provide:
1. Executive Summary (3-4 sentences highlighting the most important business insights)
2. Key Business Metrics (top 3-5 metrics that matter most)
3. Strategic Implications (what this data means for business decisions)
4. Risk Assessment (potential data quality or business risks)
5. Recommended Actions (top 3 actionable recommendations)

Focus on business value and strategic implications rather than technical details.
"""
    
    def _create_technical_prompt(self, data_context: str) -> str:
        """Create technical analysis prompt."""
        return f"""
As a data scientist, provide a technical analysis of this dataset.

{data_context}

Please provide:
1. Data Quality Assessment (technical evaluation of data reliability)
2. Statistical Insights (key statistical patterns and relationships)
3. Modeling Recommendations (what types of analysis or models would be appropriate)
4. Data Processing Needs (preprocessing, cleaning, or transformation requirements)
5. Technical Risks (potential technical issues or limitations)

Focus on statistical rigor and technical accuracy.
"""
    
    def _create_comprehensive_prompt(self, data_context: str) -> str:
        """Create comprehensive analysis prompt."""
        return f"""
As a senior data analyst, provide a comprehensive analysis of this dataset suitable for a presentation.

{data_context}

Please provide:
1. Executive Summary (business-focused overview)
2. Key Patterns and Trends (important data patterns discovered)
3. Data Quality Insights (assessment of data reliability and completeness)
4. Statistical Highlights (most interesting statistical findings)
5. Business Implications (what this data suggests for business operations)
6. Recommendations (actionable insights and next steps)
7. Visualization Suggestions (what charts would best represent key insights)

Balance business insights with technical accuracy for a mixed audience.
"""
    
    def _parse_insights(self, insights_text: str) -> Dict[str, List[str]]:
        """Parse LLM insights into structured format."""
        parsed = {
            'executive_summary': [],
            'key_findings': [],
            'patterns': [],
            'recommendations': [],
            'risks': []
        }
        
        # Simple parsing based on common patterns
        lines = insights_text.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Identify sections
            lower_line = line.lower()
            if any(keyword in lower_line for keyword in ['executive', 'summary', 'overview']):
                current_section = 'executive_summary'
            elif any(keyword in lower_line for keyword in ['finding', 'insight', 'key', 'highlight']):
                current_section = 'key_findings'
            elif any(keyword in lower_line for keyword in ['pattern', 'trend', 'correlation']):
                current_section = 'patterns'
            elif any(keyword in lower_line for keyword in ['recommend', 'action', 'next step']):
                current_section = 'recommendations'
            elif any(keyword in lower_line for keyword in ['risk', 'concern', 'limitation']):
                current_section = 'risks'
            
            # Add content to current section
            if current_section and line.startswith(('•', '-', '*', '1.', '2.', '3.', '4.', '5.')):
                content = line.lstrip('•-*123456789. ')
                if content:
                    parsed[current_section].append(content)
        
        return parsed
    
    def _extract_key_findings(self, insights_text: str) -> List[str]:
        """Extract key findings from insights text."""
        findings = []
        lines = insights_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith(('•', '-', '*')) or line[0].isdigit() if line else False:
                content = line.lstrip('•-*123456789. ')
                if len(content) > 20 and any(keyword in content.lower() for keyword in 
                    ['significant', 'important', 'notable', 'key', 'major', 'critical']):
                    findings.append(content)
        
        return findings[:5]  # Top 5 findings
    
    def _extract_actionable_items(self, insights_text: str) -> List[str]:
        """Extract actionable recommendations from insights text."""
        actions = []
        lines = insights_text.split('\n')
        
        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in 
                   ['recommend', 'should', 'consider', 'suggest', 'action', 'implement']):
                content = line.lstrip('•-*123456789. ')
                if len(content) > 15:
                    actions.append(content)
        
        return actions[:5]  # Top 5 actions
    
    def _generate_recommendations(
        self, 
        df: pd.DataFrame, 
        statistical_summary: Dict[str, Any], 
        quality_assessment: Dict[str, Any],
        llm: Any
    ) -> Dict[str, List[str]]:
        """Generate specific recommendations for the dataset."""
        recommendations = {
            'data_quality': [],
            'analysis': [],
            'visualization': [],
            'business': []
        }
        
        # Data quality recommendations
        if quality_assessment['completeness_score'] < 95:
            recommendations['data_quality'].append("Investigate and address missing data issues")
        
        if quality_assessment['issues']:
            recommendations['data_quality'].extend(quality_assessment['recommendations'][:3])
        
        # Analysis recommendations
        numeric_cols = statistical_summary['data_types']['numeric_columns']
        if len(numeric_cols) > 1:
            recommendations['analysis'].append("Conduct correlation analysis between numeric variables")
        
        if len(numeric_cols) > 2:
            recommendations['analysis'].append("Consider principal component analysis for dimensionality reduction")
        
        categorical_cols = statistical_summary['data_types']['categorical_columns']
        if categorical_cols:
            recommendations['analysis'].append("Perform categorical analysis and segmentation")
        
        # Visualization recommendations
        if len(numeric_cols) >= 2:
            recommendations['visualization'].append("Create scatter plots to show variable relationships")
        
        if categorical_cols:
            recommendations['visualization'].append("Use bar charts for categorical distributions")
        
        recommendations['visualization'].append("Include correlation heatmap for numeric variables")
        
        # Business recommendations (generic)
        recommendations['business'].append("Establish data governance policies for quality assurance")
        recommendations['business'].append("Implement regular data quality monitoring")
        recommendations['business'].append("Create dashboards for ongoing data insights")
        
        return recommendations
    
    def _create_executive_summary(
        self, 
        statistical_summary: Dict[str, Any], 
        llm_insights: Dict[str, Any],
        recommendations: Dict[str, List[str]],
        llm: Any
    ) -> str:
        """Create executive summary combining all insights."""
        # Extract key information
        total_records = statistical_summary['basic_info']['total_records']
        total_columns = statistical_summary['basic_info']['total_columns']
        
        # Start with basic overview
        summary = f"Analysis of dataset containing {total_records:,} records across {total_columns} variables. "
        
        # Add LLM insights if available
        if 'parsed_insights' in llm_insights and llm_insights['parsed_insights']['executive_summary']:
            summary += " ".join(llm_insights['parsed_insights']['executive_summary'][:2])
        else:
            # Fallback summary
            numeric_count = len(statistical_summary['data_types']['numeric_columns'])
            categorical_count = len(statistical_summary['data_types']['categorical_columns'])
            summary += f"The dataset includes {numeric_count} numeric and {categorical_count} categorical variables. "
            
            missing_pct = statistical_summary['missing_data']['missing_percentage']
            if missing_pct > 5:
                summary += f"Data completeness is a concern with {missing_pct:.1f}% missing values. "
            else:
                summary += "Data quality is generally good with minimal missing values. "
        
        # Add top recommendation
        if recommendations['business']:
            summary += f"Key recommendation: {recommendations['business'][0]}"
        
        return summary
    
    def _extract_key_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract key metrics for dashboard display."""
        metrics = {
            'total_records': len(df),
            'total_variables': len(df.columns),
            'completeness_rate': ((df.size - df.isnull().sum().sum()) / df.size * 100),
            'numeric_variables': len(df.select_dtypes(include=[np.number]).columns),
            'categorical_variables': len(df.select_dtypes(include=['object']).columns)
        }
        
        # Add specific metrics based on data
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            metrics['avg_numeric_value'] = df[numeric_cols].mean().mean()
            metrics['total_variance'] = df[numeric_cols].var().sum()
        
        return metrics
    
    def _create_data_story(self, df: pd.DataFrame, llm: Any) -> str:
        """Create a narrative story about the data."""
        if not llm:
            return "Data story generation requires LLM capability."
        
        # Create a brief context for story generation
        story_prompt = f"""
        Create a brief, engaging narrative about this dataset that could be used in a presentation:
        
        Dataset: {len(df)} records, {len(df.columns)} variables
        Key variables: {', '.join(df.columns[:5])}
        
        Write 2-3 sentences that tell the story of what this data represents and why it matters.
        Make it engaging and business-focused.
        """
        
        try:
            response = llm.invoke(story_prompt)
            if hasattr(response, 'content'):
                return response.content
            else:
                return str(response)
        except Exception as e:
            return f"Unable to generate data story: {str(e)}"

    async def _arun(self, *args, **kwargs):
        """Async version of the tool (not implemented)."""
        raise NotImplementedError("Async version not implemented")
