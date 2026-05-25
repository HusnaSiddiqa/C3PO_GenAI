import os
from utils.s3 import read_s3_file


def get_source_context(metadata: dict) -> str | None:
    feature_flag = os.getenv("VITE_ENABLE_SOURCE_SELECTOR", "false")
    if feature_flag.lower() != "true":
        return None
    selected_source = metadata.get("selected_source")
    if not selected_source:
        return None
    bucket = os.getenv("WORKSPACE_BUCKET_NAME")
    key = os.getenv("SUB_AGENT_MAPPING")
    sub_agent_mapping = read_s3_file(bucket=bucket, key=key)
    sub_agent_mapping_agents = sub_agent_mapping.get("sub_agents", "")
    entry = sub_agent_mapping_agents.get(selected_source, "")
    if not entry:
        return None
    sub_agent_source = entry.get("sub_agent", "")
    context = sub_agent_mapping.get("context", "").format(sub_agent_source=sub_agent_source)
    return context


def override_sub_agent_mapping(metadata: dict, agent_names: list[str], sub_agent_mapping: dict | None) -> dict | None:
    feature_flag = os.getenv("VITE_ENABLE_SOURCE_SELECTOR", "false")
    selected_source = metadata.get("selected_source")
    if feature_flag.lower() != "true" or not selected_source:
        return sub_agent_mapping
    try:
        bucket = os.getenv("WORKSPACE_BUCKET_NAME", "")
        key = os.getenv("SUB_AGENT_MAPPING", "")
        source_mapping = read_s3_file(bucket=bucket, key=key)
        source_mapping = source_mapping.get("sub_agents", "")
        entry = source_mapping.get(selected_source)
        if entry and entry["agent_type"] in agent_names:
            if sub_agent_mapping is None:
                sub_agent_mapping = {}
            orchestrator_decision = sub_agent_mapping.get(entry["agent_type"])
            print(f"Overriding sub-agent decision {orchestrator_decision} with user-selected source {selected_source}")
            sub_agent_mapping[entry["agent_type"]] = entry["sub_agent"]
            print(f"[Orchestrator] Source override: {selected_source} → {entry['sub_agent']}")
        elif entry:
            print(f"[Orchestrator] Source '{selected_source}' agent_type '{entry['agent_type']}' not in decision {agent_names}, skipping override")
        else:
            print(f"[Orchestrator] Source '{selected_source}' not found in source_mapping")
    except Exception as e:
        print(f"[Orchestrator] Source override failed: {e}, using LLM decision")
    return sub_agent_mapping
