from dotenv import load_dotenv
import os

load_dotenv()
WORKSPACE_NAME = os.getenv("WORKSPACE_NAME")
DOMAIN = os.getenv("DOMAIN")

API_VERSION_PREFIX = "/v2/chat-manager"
API_VERSION_ADMIN_PREFIX = "/v2/admin"
BACKEND_API_VERSION="v2"
FILE_SIZE= 10 * 1024 * 1024  # 10 MB
FILE_TYPE = ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv", "application/json", "text/plain", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
ONBOARDING_TABLE = f"{WORKSPACE_NAME}-onboarding"
CLICKABLE_QUESTIONS_TABLE = f"{WORKSPACE_NAME}-clickable_questions"
LAST_AGENT_SEPARATOR = "--last_agent_response--"
INSTRUCTIONS_TABLE = f"{WORKSPACE_NAME}-instructions"
ADMIN_CONFIG_TABLE = f"{WORKSPACE_NAME}-config"
CONVERSATION_STORE_TABLE = f"{WORKSPACE_NAME}-conversation_store"
BYOD_FILES_TABLE = f"{WORKSPACE_NAME}-byod_files"
SCHEMA_CONFIG_TABLE = f"{WORKSPACE_NAME}-{DOMAIN}_scheme_config"
SYNC_TABLE_CONTROL_TABLE = f"{WORKSPACE_NAME}-sync_table_control"
PPT_FILE_TEMPLATE_NAME = "ppt_file_template.pptx"
Region_NAME = "us-west-2"
DATABRICKS_SECRET = f"{WORKSPACE_NAME}/app-secret"
EMBEDDING_MODEL = "amazon.titan-embed-text-v1"
PRECANNED_JOB_FILE="precanned_deck_agent/job_list.json"
PROMPT_PATH = f"{WORKSPACE_NAME}/agents"
DEFAULT_CATALOG = "commercial-us-apo-onc-iia-dev"
DEFAULT_SCHEMA = "setuserv_adhocs"
BYOD_PATH = f"/{WORKSPACE_NAME}/agents/BYOD"
NLQ_PATH = f"/{WORKSPACE_NAME}/agents/NLQ"
BATCH_SIZE = 2
MAX_RETRIES = 3
OVERALL_BENCHMARKING_PATH = f"/{WORKSPACE_NAME}/agents/Overall_Agent_Benchmark"
mock_stream_message = [{
    "PK": "CONVERSATION#a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "SK": "MESSAGE#2025-07-20T18:07:13.391790Z#ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "event": "synthetic",
    "conversation_id": "a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "role": "system",
    "message_id": "ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "is_final": "false",
    "timestamp": "2025-07-20T18:07:13.408655Z",
    "stage": "thinking",
    "message": "Analyzing your query..."
},
{
    "PK": "CONVERSATION#a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "SK": "MESSAGE#2025-07-20T18:07:13.391790Z#ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "event": "status-update",
    "conversation_id": "a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "role": "system",
    "message_id": "ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "is_final": "false",
    "timestamp": "2025-07-20T18:07:17.572429Z",
    "stage": "agent-routing",
    "agent_message": "Following agents have been selected for processing your query: ['NLQ Agent']"
},
{
    "PK": "CONVERSATION#a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "SK": "MESSAGE#2025-07-20T18:07:13.391790Z#ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "event": "status-update",
    "conversation_id": "a1537a70-03a9-46f2-b6a9-52c38ad19189",
    "role": "system",
    "message_id": "ad77d5fa-20cf-4a51-8b73-dd62dbad985e",
    "is_final": "false",
    "timestamp": "2025-07-20T18:08:27.934885Z",
    "stage": "working",
    "agent_message": "NLQ Agent in progress...",
    "contextId": "539983a0-fffd-49d1-b887-da1c32fd1d39",
    "taskId": "7a033501-eedc-49e6-9ef6-b84dd102e28e"
},
{
    "PK": "CONVERSATION#9e211976-ca69-473a-8a70-58e55c3b9d04",
    "SK": "MESSAGE#2025-07-26T03:54:20.216966Z#cd0ecbbb-e84d-4334-ae8c-920c968fbe17",
    "conversation_id": "9e211976-ca69-473a-8a70-58e55c3b9d04",
    "role": "assistant",
    "type": "sql_result",
    "message_id": "cd0ecbbb-e84d-4334-ae8c-920c968fbe17",
    "timestamp": "2025-07-26T03:56:59.616468Z",
    "stage": "artifact",
    "artifactId": "5a751ed5-e545-441d-a394-8696f270ca44",
    "artifact_name": "response",
    "contextId": "7361a4d5-7df1-4fb2-bd92-177bd6a47f50",
    "taskId": "ed9f95fc-dc71-49ab-aada-703ba0b0e360",
    "summary": "The data shows Trodelvy market share among key accounts in the Southeast region over a 31-week period. The share percentage fluctuates between 5.87% and 10.99%, with an average around 7.5%. Notable points include:\n\n- A significant peak of 10.99% in week ending 1750982400000 (highest share)\n- A low point of 5.87% in week ending 1736467200000 (lowest share)\n- Another high point of 9.07% in week ending 1737676800000\n\nThe overall trend shows volatility rather than a consistent upward or downward pattern, with share percentages generally ranging between 6.5% and 8.5%. There appears to be no strong seasonal pattern, though occasional spikes and dips occur throughout the period. The most recent data point shows a 7.04% share, which is slightly below the apparent average.",
    "result": "[{\"week_end_date\":1734048000000,\"total_trodelvy_sales\":749.0,\"total_market_sales\":8676.0,\"trodelvy_share_percentage\":8.63},{\"week_end_date\":1734652800000,\"total_trodelvy_sales\":642.0,\"total_market_sales\":9617.0,\"trodelvy_share_percentage\":6.68},{\"week_end_date\":1735257600000,\"total_trodelvy_sales\":597.0,\"total_market_sales\":7518.0,\"trodelvy_share_percentage\":7.94},{\"week_end_date\":1735862400000,\"total_trodelvy_sales\":540.0,\"total_market_sales\":8098.0,\"trodelvy_share_percentage\":6.67},{\"week_end_date\":1736467200000,\"total_trodelvy_sales\":695.0,\"total_market_sales\":11837.0,\"trodelvy_share_percentage\":5.87},{\"week_end_date\":1737072000000,\"total_trodelvy_sales\":538.0,\"total_market_sales\":7394.0,\"trodelvy_share_percentage\":7.28},{\"week_end_date\":1737676800000,\"total_trodelvy_sales\":647.0,\"total_market_sales\":7131.0,\"trodelvy_share_percentage\":9.07},{\"week_end_date\":1738281600000,\"total_trodelvy_sales\":611.0,\"total_market_sales\":8031.0,\"trodelvy_share_percentage\":7.61},{\"week_end_date\":1738886400000,\"total_trodelvy_sales\":759.0,\"total_market_sales\":9146.0,\"trodelvy_share_percentage\":8.3},{\"week_end_date\":1739491200000,\"total_trodelvy_sales\":520.0,\"total_market_sales\":7924.0,\"trodelvy_share_percentage\":6.56},{\"week_end_date\":1740096000000,\"total_trodelvy_sales\":625.0,\"total_market_sales\":8553.0,\"trodelvy_share_percentage\":7.31},{\"week_end_date\":1740700800000,\"total_trodelvy_sales\":623.0,\"total_market_sales\":7984.0,\"trodelvy_share_percentage\":7.8},{\"week_end_date\":1741305600000,\"total_trodelvy_sales\":670.0,\"total_market_sales\":9467.0,\"trodelvy_share_percentage\":7.08},{\"week_end_date\":1741910400000,\"total_trodelvy_sales\":678.0,\"total_market_sales\":9105.0,\"trodelvy_share_percentage\":7.45},{\"week_end_date\":1742515200000,\"total_trodelvy_sales\":651.0,\"total_market_sales\":8432.0,\"trodelvy_share_percentage\":7.72},{\"week_end_date\":1743120000000,\"total_trodelvy_sales\":651.0,\"total_market_sales\":8229.0,\"trodelvy_share_percentage\":7.91},{\"week_end_date\":1743724800000,\"total_trodelvy_sales\":643.0,\"total_market_sales\":7713.0,\"trodelvy_share_percentage\":8.34},{\"week_end_date\":1744329600000,\"total_trodelvy_sales\":558.0,\"total_market_sales\":7741.0,\"trodelvy_share_percentage\":7.21},{\"week_end_date\":1744934400000,\"total_trodelvy_sales\":648.0,\"total_market_sales\":8120.0,\"trodelvy_share_percentage\":7.98},{\"week_end_date\":1745539200000,\"total_trodelvy_sales\":589.0,\"total_market_sales\":8073.0,\"trodelvy_share_percentage\":7.3},{\"week_end_date\":1746144000000,\"total_trodelvy_sales\":706.0,\"total_market_sales\":9046.0,\"trodelvy_share_percentage\":7.8},{\"week_end_date\":1746748800000,\"total_trodelvy_sales\":604.0,\"total_market_sales\":8545.0,\"trodelvy_share_percentage\":7.07},{\"week_end_date\":1747353600000,\"total_trodelvy_sales\":529.0,\"total_market_sales\":8137.0,\"trodelvy_share_percentage\":6.5},{\"week_end_date\":1747958400000,\"total_trodelvy_sales\":633.0,\"total_market_sales\":8299.0,\"trodelvy_share_percentage\":7.63},{\"week_end_date\":1748563200000,\"total_trodelvy_sales\":555.0,\"total_market_sales\":7166.0,\"trodelvy_share_percentage\":7.74},{\"week_end_date\":1749168000000,\"total_trodelvy_sales\":612.0,\"total_market_sales\":9223.0,\"trodelvy_share_percentage\":6.64},{\"week_end_date\":1749772800000,\"total_trodelvy_sales\":667.0,\"total_market_sales\":8084.0,\"trodelvy_share_percentage\":8.25},{\"week_end_date\":1750377600000,\"total_trodelvy_sales\":549.0,\"total_market_sales\":8139.0,\"trodelvy_share_percentage\":6.75},{\"week_end_date\":1750982400000,\"total_trodelvy_sales\":993.0,\"total_market_sales\":9038.0,\"trodelvy_share_percentage\":10.99},{\"week_end_date\":1751587200000,\"total_trodelvy_sales\":565.0,\"total_market_sales\":7385.0,\"trodelvy_share_percentage\":7.65},{\"week_end_date\":1752192000000,\"total_trodelvy_sales\":604.0,\"total_market_sales\":8578.0,\"trodelvy_share_percentage\":7.04}]"
},{
    "PK": "CONVERSATION#4aafb558-3989-40b5-bcf5-9b82b6efd9ea",
    "SK": "MESSAGE#2025-07-26T05:37:18.872830Z#8b07a3b8-e9a6-47e0-b4fd-8a7221bbca54",
    "conversation_id": "4aafb558-3989-40b5-bcf5-9b82b6efd9ea",
    "role": "system",
    "type": "summary",
    "message_id": "8b07a3b8-e9a6-47e0-b4fd-8a7221bbca54",
    "timestamp": "2025-07-26T05:37:38.514309Z",
    "stage": "completed",
    "is_final": True,
    "message": "Stream completed successfully"
}]
DATABRICKS_SYNC_TABLE_CONTROL = [
    {
        'PK': 'table#commercial-us-apo-onc-iia-dev#setuserv_adhocs#onc_claims_data',
        'SK': 'META',
        'catalog': 'commercial-us-apo-onc-iia-dev',
        'db_name': 'setuserv_adhocs',
        'table_name': 'onc_claims_data',
        'source': 'databricks'
    },
    {
        'PK': 'table#commercial-us-apo-onc-iia-dev#setuserv_adhocs#ddd_data_for_genie_filtered_dates',
        'SK': 'META',
        'catalog': 'commercial-us-apo-onc-iia-dev',
        'db_name': 'setuserv_adhocs',
        'table_name': 'ddd_data_for_genie_filtered_dates',
        'source': 'databricks'
    },
    {
        'PK': 'table#commercial-us-apo-onc-iia-dev#setuserv_adhocs#867_data_drug_trodelvy_for_genie_filtered_dates',
        'SK': 'META',
        'catalog': 'commercial-us-apo-onc-iia-dev',
        'db_name': 'setuserv_adhocs',
        'table_name': '867_data_drug_trodelvy_for_genie_filtered_dates',
        'source': 'databricks'
    }
]
# GLUE_SYNC_TABLE_CONTROL = [
#     {
#         'PK': 'table#analytics#customers',
#         'db_name': 'analytics',
#         'table_name': 'customers',
#         'source': 'glue'
#     },
#     {
#         'PK': 'table#analytics#transactions',
#         'db_name': 'analytics',
#         'table_name': 'transactions',
#         'source': 'glue'
#     }
# ]