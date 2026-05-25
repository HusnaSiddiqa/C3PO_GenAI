import os
from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from jose import jwt
from utils.generic import get_secret
from utils.constants import DATABRICKS_SECRET, Region_NAME


OKTA_ISSUER = os.environ.get("OKTA_ISSUER")
OKTA_AUDIENCE = os.environ.get("OKTA_AUDIENCE")
OKTA_DOMAIN = os.environ.get("OKTA_DOMAIN")
JWKS_URL = f"{OKTA_DOMAIN}/oauth2/default/v1/keys"
SECRET_KEY = get_secret(DATABRICKS_SECRET, region_name=Region_NAME)["SECRET_KEY"]
ALGORITHM = "HS256"

bearer_scheme = HTTPBearer()


async def get_jwks():
    async with httpx.AsyncClient() as client:
        resp = await client.get(JWKS_URL)
        resp.raise_for_status()
        return resp.json()


async def verify_okta_jwt(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    token = credentials.credentials
    jwks = await get_jwks()
    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=OKTA_AUDIENCE,
            issuer=OKTA_ISSUER,
            options={"verify_at_hash": False}
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication: {str(e)}"
        )


def user_in_group(user: dict, valid_groups: []) -> bool:
    user_groups = user.get("Groups", [])
    user_groups.extend(user.get("groups", []))
    for group in user_groups:
        if group in valid_groups:
            return True
    return False


def create_jwt(userinfo):
    payload = {
        "sub": userinfo["email"],
        "userinfo": userinfo,
        "groups": userinfo.get("Groups", []).extend(userinfo.get("groups", [])),
        "exp": datetime.utcnow() + timedelta(minutes=60)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
