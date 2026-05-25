from pydantic import BaseModel


class ConfigResponse(BaseModel):
    admin_ad_group: str
    admin_secret: str
    app_default_user_id: str
    app_title: str
    chat_mgr_secret: str
    okta_auth_url: str
    okta_client_id: str
    okta_redirect_uri: str
    support_email: str
    enable_source_selector: str