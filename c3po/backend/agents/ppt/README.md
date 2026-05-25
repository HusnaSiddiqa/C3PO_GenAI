# PowerPoint Generation Tool

A comprehensive LangChain-based tool for automatically generating PowerPoint presentations from CSV data with intelligent visualizations and AI-powered summaries.

## Features

- **Automated Data Analysis**: Intelligent parsing and analysis of CSV data
- **Smart Visualizations**: Automatic generation of appropriate charts and graphs
- **AI-Powered Insights**: LLM-generated summaries, insights, and recommendations
- **Professional Formatting**: Consistent, modern PowerPoint styling
- **Template Support**: Use custom PowerPoint templates
- **Data Quality Assessment**: Comprehensive data validation and quality metrics

## Quick Start

### Basic Usage

```python
from ppt_generator import create_ppt_from_csv

# Simple usage
result = create_ppt_from_csv(
    template_path="template.pptx",
    csv_path="data.csv", 
    output_path="output.pptx",
    llm=your_llm_instance
)
print(result)
```

### Advanced Usage with Individual Components

```python
from ppt_generator import PPTGenerator
from visualization_agent import VisualizationAgent
from summary_agent import SummaryAgent
import pandas as pd

# Load your data
df = pd.read_csv("data.csv")

# Generate visualizations
viz_agent = VisualizationAgent(llm=your_llm)
visualizations = viz_agent._run(df, llm=your_llm)

# Generate summary and insights
summary_agent = SummaryAgent(llm=your_llm)
summary = summary_agent._run(df, llm=your_llm)

# Create presentation
generator = PPTGenerator(llm=your_llm)
result = generator._run(
    template_path="template.pptx",
    csv_path="data.csv",
    output_path="presentation.pptx",
    llm=your_llm
)
```

## Components

### 1. PPTGenerator (Main Tool)

The primary LangChain tool that orchestrates the entire presentation generation process.

**Key Features:**
- Template-based presentation creation
- Automated data loading and analysis
- Integration with visualization and summary agents
- Professional slide layouts
- Error handling and validation

### 2. VisualizationAgent

Specialized agent for creating optimal data visualizations.

**Supported Chart Types:**
- Correlation heatmaps
- Distribution histograms
- Bar charts for categorical data
- Scatter plots for relationships
- Box plots for outlier analysis

**Features:**
- Automatic chart type selection based on data characteristics
- LLM-powered visualization recommendations
- Professional styling and formatting
- Statistical annotations and insights

### 3. SummaryAgent

AI-powered agent for generating comprehensive data summaries and insights.

**Capabilities:**
- Executive summaries
- Statistical analysis
- Data quality assessment
- Business insights and recommendations
- Key metrics extraction

### 4. Utility Modules

#### CSVParser
- Enhanced CSV reading with encoding detection
- Automatic data type detection and conversion
- Data quality validation
- Preprocessing and cleaning

#### PPTXHelper  
- Professional PowerPoint styling
- Consistent formatting across slides
- Layout management
- Image and content integration

## Installation

1. Install required dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure you have a compatible LLM instance (e.g., from langchain)

## Configuration

### Supported File Formats
- **Input**: CSV files (with automatic encoding detection)
- **Templates**: PowerPoint (.pptx) files
- **Output**: PowerPoint (.pptx) presentations

### LLM Requirements
The tool requires a LangChain-compatible LLM instance for:
- Generating data insights and summaries
- Recommending appropriate visualizations
- Creating executive summaries
- Providing business recommendations

Compatible LLM providers include:
- OpenAI GPT models
- Anthropic Claude
- Local models via Ollama
- Any LangChain-compatible LLM

## Slide Types Generated

1. **Title Slide**: Overview of the analysis
2. **Data Overview**: Basic dataset statistics and structure
3. **Visualization Slides**: Charts and graphs with insights
4. **Insights Slide**: Key findings and recommendations
5. **Metrics Dashboard**: Important metrics in visual format

## Data Quality Features

- **Completeness Assessment**: Missing value analysis
- **Consistency Checks**: Duplicate detection and outlier identification
- **Type Validation**: Automatic data type detection and conversion
- **Quality Scoring**: Overall data quality metrics

## Customization Options

### Visualization Preferences
```python
# Specify preferred chart types
visualizations = viz_agent._run(
    data=df,
    chart_types=['histogram', 'scatter_plot', 'heatmap'],
    max_charts=5
)
```

### Summary Types
```python
# Choose summary focus
summary = summary_agent._run(
    data=df,
    summary_type='executive',  # 'executive', 'technical', 'comprehensive'
    focus_areas=['trends', 'outliers', 'correlations']
)
```

## Error Handling

The tool includes comprehensive error handling for:
- File format issues
- Data quality problems
- Template loading errors
- LLM connectivity issues
- PowerPoint generation failures

## Best Practices

1. **Data Preparation**:
   - Ensure CSV files have proper headers
   - Clean obvious data quality issues beforehand
   - Use consistent date formats

2. **Template Usage**:
   - Use professional PowerPoint templates
   - Ensure templates have standard slide layouts
   - Test with your specific template before production use

3. **LLM Configuration**:
   - Use models with sufficient context length
   - Configure appropriate temperature settings
   - Ensure stable connectivity for LLM calls

## Examples

### Example 1: Sales Data Analysis
```python
result = create_ppt_from_csv(
    template_path="corporate_template.pptx",
    csv_path="sales_data.csv",
    output_path="sales_analysis.pptx", 
    llm=openai_llm
)
```

### Example 2: Survey Results
```python
result = create_ppt_from_csv(
    template_path="survey_template.pptx",
    csv_path="survey_responses.csv",
    output_path="survey_analysis.pptx",
    llm=anthropic_llm
)
```

## Troubleshooting

### Common Issues

1. **"LLM model is required"**: Ensure you pass a valid LLM instance
2. **"CSV file not found"**: Check file path and permissions
3. **"Template not found"**: Verify template path or let tool create default presentation
4. **Poor visualizations**: Check data quality and consider data preprocessing

### Performance Tips

- For large datasets, consider sampling with `sample_size` parameter
- Use SSD storage for better I/O performance
- Ensure adequate memory for data processing
- Consider using local LLMs for faster response times

## Contributing

This tool is designed to be extensible. You can:
- Add new visualization types to `VisualizationAgent`
- Enhance summary capabilities in `SummaryAgent`
- Extend PowerPoint styling in `PPTXHelper`
- Improve data parsing in `CSVParser`

## License

This project is part of the commercial-us-sbx-iidd-genai package and follows the same licensing terms.
