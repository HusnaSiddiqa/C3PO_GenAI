import plotly.express as px
from agents.llm_utils import generate

CHART_KEYS = {"CHART_TYPE", "CHART_TITLE", "X_COLUMN", "Y_COLUMN"}


def _build_history_text(history: list) -> str:
    if len(history) <= 1:
        return ""
    recent = history[:-1][-4:]
    lines = "\n".join(f"{m['role'].title()}: {m['content']}" for m in recent)
    return f"\nConversation history:\n{lines}\n"


def _parse_chart_instructions(text: str) -> dict:
    result = {}
    for line in text.split("\n"):
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            if key in CHART_KEYS:
                result[key] = val.strip()
    return result


def _build_chart(instructions: dict, df):
    chart_type = instructions.get("CHART_TYPE", "bar").lower()
    title = instructions.get("CHART_TITLE", "Chart")
    x_col = instructions.get("X_COLUMN", df.columns[0])
    y_col = instructions.get("Y_COLUMN", df.columns[1] if len(df.columns) > 1 else df.columns[0])

    if x_col not in df.columns or y_col not in df.columns:
        return None

    builders = {"bar": px.bar, "line": px.line, "scatter": px.scatter}
    if chart_type == "pie":
        return px.pie(df, names=x_col, values=y_col, title=title)
    return builders.get(chart_type, px.bar)(df, x=x_col, y=y_col, title=title)


def _strip_chart_lines(text: str) -> str:
    return "\n".join(
        line for line in text.split("\n")
        if not any(line.strip().startswith(k) for k in CHART_KEYS)
    ).strip()


def data_agent_response(query: str, df, client, history: list) -> tuple[str, any, any]:
    df_info = ""
    if df is not None:
        df_info = f"""
Available dataset:
- Columns: {list(df.columns)}
- Shape: {df.shape[0]} rows × {df.shape[1]} columns
- Sample (first 3 rows):
{df.head(3).to_string()}
- Summary statistics:
{df.describe().to_string()}
"""

    chart_instruction = """
If a chart would help answer this question and data is available, include these lines at the very top of your response:
CHART_TYPE: bar|line|scatter|pie
CHART_TITLE: descriptive title
X_COLUMN: exact_column_name
Y_COLUMN: exact_column_name

Then provide your analysis below the chart instructions."""

    history_text = _build_history_text(history)
    prompt = f"""You are a data analysis assistant.{df_info}
{chart_instruction if df is not None else ""}
{history_text}
User question: {query}

Provide a clear, insightful analysis."""

    text = generate(client, prompt)

    chart = None
    if df is not None and any(k in text for k in CHART_KEYS):
        try:
            instructions = _parse_chart_instructions(text)
            if instructions:
                chart = _build_chart(instructions, df)
                text = _strip_chart_lines(text)
        except Exception:
            pass

    return text, chart, df if df is not None else None
