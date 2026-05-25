import os
from fastapi import APIRouter, HTTPException


from ..models.config_models import ConfigResponse
from core.util.S3Utils import S3Utils


router = APIRouter()

@router.get('/config', response_model=ConfigResponse)
def ui_config():
    return ConfigResponse(
        admin_ad_group=os.environ.get('VITE_ADMIN_AD_GROUP', ''),
        app_default_user_id=os.environ.get('VITE_APP_DEFAULT_USER_ID', ''),
        app_title=os.environ.get('VITE_APP_TITLE', ''),
        okta_auth_url=os.environ.get('VITE_OKTA_AUTH_URL', ''),
        okta_client_id=os.environ.get('VITE_OKTA_CLIENT_ID', ''),
        okta_redirect_uri=os.environ.get('VITE_OKTA_REDIRECT_URI', ''),
        support_email=os.environ.get('VITE_SUPPORT_EMAIL', ''),
        admin_secret=os.environ.get('VITE_ADMIN_SECRET', ''),
        chat_mgr_secret=os.environ.get('VITE_CHAT_MGR_SECRET', ''),
        enable_source_selector=os.environ.get('VITE_ENABLE_SOURCE_SELECTOR', 'false'),
    )


@router.get('/readme')
def readme():
    bucket_name = os.getenv("WORKSPACE_BUCKET_NAME")
    
    if not bucket_name:
        raise Exception("BUCKET_NAME is not set in environment variables")
    
    s3_utils = S3Utils()
    file_path = 'ui/README.md'
    raw_readme_text = s3_utils.get_object(bucket_name, file_path)
    
    if not raw_readme_text:
        raise HTTPException(status_code=404, detail="README not found")
    
    content = raw_readme_text.decode("utf-8")
    return content
