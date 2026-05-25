import os
from fastapi import APIRouter, HTTPException
from utils.s3 import read_s3_file

router = APIRouter()


@router.get("/sources")
async def get_available_sources():
    """
    Retrieve available data source display names from S3 source mapping config.
    """
    try:
        feature_flag = os.getenv("VITE_ENABLE_SOURCE_SELECTOR", "false")
        if feature_flag.lower() != "true":
            return {"sources": []}
        bucket = os.getenv("WORKSPACE_BUCKET_NAME")
        key = os.getenv("SUB_AGENT_MAPPING")
        mapping = read_s3_file(bucket=bucket, key=key)
        if not mapping:
            raise HTTPException(status_code=500, detail="Source mapping config not found on S3")
        return {"sources": list(mapping["sub_agents"].keys())}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Sources] Error fetching sources: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching sources: {str(e)}")
