import streamlit as st
from google import genai
import pandas as pd

from agents.orchestrator import classify_intent, AGENT_DESCRIPTIONS, AGENT_ICONS
from agents.general_agent import general_agent_response
from agents.document_agent import document_agent_response, extract_text
from agents.data_agent import data_agent_response

st.set_page_config(
    page_title="C3PO — Multi-Agent AI Demo",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
.routing-banner {
    background: #161b22;
    border-left: 3px solid #58a6ff;
    padding: 8px 14px;
    margin: 6px 0 10px 0;
    border-radius: 0 6px 6px 0;
    font-size: 13px;
    color: #8b949e;
}
.agent-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 0;
    font-size: 13px;
}
.agent-card b { color: #e6edf3; }
.agent-card small { color: #8b949e; }
.pill {
    display: inline-block;
    background: #1f6feb33;
    border: 1px solid #1f6feb;
    color: #58a6ff;
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 12px;
    font-weight: 600;
}
</style>
""", unsafe_allow_html=True)

# ── Sidebar ──────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("## 🤖 C3PO Demo")
    st.caption("Multi-agent AI · Powered by Google Gemini")
    st.divider()

    # API key — prefer Streamlit Cloud secret, fall back to user input
    try:
        api_key = st.secrets["GEMINI_API_KEY"]
        st.success("API key loaded from secrets", icon="🔑")
    except Exception:
        api_key = st.text_input(
            "Google Gemini API Key",
            type="password",
            placeholder="AIza...",
            help="Free key at aistudio.google.com — 1,500 requests/day",
        )
        if not api_key:
            st.info("Enter your Gemini API key above to start chatting.")
            st.markdown("[Get free API key →](https://aistudio.google.com/apikey)")

    st.divider()
    st.markdown("### Agents")

    for agent, desc in AGENT_DESCRIPTIONS.items():
        st.markdown(
            f'<div class="agent-card">'
            f'{AGENT_ICONS[agent]} <b>{agent.replace("_", " ").title()}</b><br>'
            f'<small>{desc}</small>'
            f'</div>',
            unsafe_allow_html=True,
        )

    st.divider()
    uploaded_file = st.file_uploader(
        "Upload a document (optional)",
        type=["pdf", "txt", "csv"],
        help="PDF, TXT, or CSV — ask questions about it",
    )

    if uploaded_file:
        st.success(f"Loaded: {uploaded_file.name}", icon="📎")

    if st.button("🗑️ Clear chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.document_text = None
        st.session_state.df = None
        st.rerun()

# ── Session state ─────────────────────────────────────────────────────────────

if "messages" not in st.session_state:
    st.session_state.messages = []
if "document_text" not in st.session_state:
    st.session_state.document_text = None
if "df" not in st.session_state:
    st.session_state.df = None

# Process newly uploaded file
if uploaded_file and st.session_state.document_text is None:
    if uploaded_file.name.endswith(".csv"):
        st.session_state.df = pd.read_csv(uploaded_file)
        st.session_state.document_text = st.session_state.df.to_string()
    else:
        st.session_state.document_text = extract_text(uploaded_file)

# ── Header ────────────────────────────────────────────────────────────────────

col1, col2 = st.columns([3, 1])
with col1:
    st.markdown("# 🤖 C3PO — Multi-Agent Chat")
    st.caption("The orchestrator automatically routes each message to the best-suited agent.")
with col2:
    if st.session_state.document_text:
        st.markdown('<span class="pill">📎 Document loaded</span>', unsafe_allow_html=True)
    if not api_key:
        st.warning("No API key")

# ── Chat history ──────────────────────────────────────────────────────────────

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        if msg["role"] == "assistant" and "routing" in msg:
            r = msg["routing"]
            icon = AGENT_ICONS.get(r["agent"], "🤖")
            st.markdown(
                f'<div class="routing-banner">'
                f'🔀 Routed to: {icon} <b>{r["agent"].replace("_", " ").title()} Agent</b>'
                f' &nbsp;·&nbsp; {r["reason"]}'
                f'</div>',
                unsafe_allow_html=True,
            )
        st.markdown(msg["content"])
        if msg.get("chart") is not None:
            st.plotly_chart(msg["chart"], use_container_width=True)
        if msg.get("dataframe") is not None:
            st.dataframe(msg["dataframe"], use_container_width=True)

# ── Chat input ────────────────────────────────────────────────────────────────

if prompt := st.chat_input("Ask anything…", disabled=not api_key):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    client = genai.Client(api_key=api_key)

    has_doc = st.session_state.document_text is not None
    agent_type, reason = classify_intent(prompt, has_doc, client)

    history = [
        {"role": m["role"], "content": m["content"]}
        for m in st.session_state.messages
    ]

    with st.chat_message("assistant"):
        icon = AGENT_ICONS.get(agent_type, "🤖")
        st.markdown(
            f'<div class="routing-banner">'
            f'🔀 Routed to: {icon} <b>{agent_type.replace("_", " ").title()} Agent</b>'
            f' &nbsp;·&nbsp; {reason}'
            f'</div>',
            unsafe_allow_html=True,
        )

        with st.spinner("Thinking…"):
            try:
                if agent_type == "document" and has_doc:
                    response_text, chart, table = document_agent_response(
                        prompt, st.session_state.document_text, client, history
                    )
                elif agent_type == "data_analysis":
                    response_text, chart, table = data_agent_response(
                        prompt, st.session_state.df, client, history
                    )
                else:
                    response_text, chart, table = general_agent_response(
                        prompt, client, history, agent_type
                    )
            except RuntimeError as e:
                st.warning(str(e))
                st.stop()
            except Exception as e:
                st.warning(f"Something went wrong: {e}")
                st.stop()

        st.markdown(response_text)
        if chart is not None:
            st.plotly_chart(chart, use_container_width=True)
        if table is not None:
            st.dataframe(table, use_container_width=True)

    saved = {
        "role": "assistant",
        "content": response_text,
        "routing": {"agent": agent_type, "reason": reason},
    }
    if chart is not None:
        saved["chart"] = chart
    if table is not None:
        saved["dataframe"] = table

    st.session_state.messages.append(saved)
