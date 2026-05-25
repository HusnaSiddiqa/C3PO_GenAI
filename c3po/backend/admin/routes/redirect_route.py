import os

import httpx
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from utils.okta_auth import user_in_group, create_jwt
from utils.generic import get_secret
from utils.constants import DATABRICKS_SECRET, Region_NAME


router = APIRouter()

# Okta config
OKTA_DOMAIN = os.getenv("OKTA_DOMAIN")
OKTA_CLIENT_ID = os.getenv("OKTA_CLIENT_ID")
OKTA_CLIENT_SECRET = get_secret(DATABRICKS_SECRET, region_name=Region_NAME)['OKTA_CLIENT_SECRET']
OKTA_REDIRECT_URI = os.getenv("OKTA_REDIRECT_URI")
OKTA_TOKEN_URL = os.getenv("OKTA_TOKEN_ENDPOINT")
OKTA_USERINFO_URL = os.getenv("OKTA_USER_INFO_ENDPOINT")
CLIENT_BASE_URL = os.getenv("CLIENT_BASE_URL", "http://localhost:3000")
ADMIN_GROUP = os.getenv("OKTA_ADMIN_GROUP", "APP_genai_app_admin_user")
USER_GROUP = os.getenv("OKTA_USER_GROUP", "APP_genai_app_user")
DISABLE_USER_GROUP_VALIDATION = os.getenv("DISABLE_USER_GROUP_VALIDATION", "false")

@router.get("/callback")
async def callback(request: Request):
    code = request.query_params.get("code")
    if not code:
        print("Callback received without code parameter.")
        redirect_url = f"{CLIENT_BASE_URL}/callback?error=403"
        return RedirectResponse(url=redirect_url)
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            OKTA_TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": OKTA_REDIRECT_URI,
                "client_id": OKTA_CLIENT_ID,
                "client_secret": OKTA_CLIENT_SECRET
            }
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Token exchange failed")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")

    # Get user info
    async with httpx.AsyncClient() as client:
        userinfo_resp = await client.get(
            OKTA_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch user info")

        userinfo = userinfo_resp.json()
        print("User Info:", userinfo)
        userinfo["id_token"] = id_token

    if DISABLE_USER_GROUP_VALIDATION.strip().lower() == "false":
        valid_groups = [ADMIN_GROUP, USER_GROUP]
        if not user_in_group(userinfo, valid_groups):
            redirect_url = f"{CLIENT_BASE_URL}/callback?error=403"
            return RedirectResponse(url=redirect_url)

    token = create_jwt(userinfo)
    redirect_url = f"{CLIENT_BASE_URL}/callback?token={token}"
    return RedirectResponse(url=redirect_url)
