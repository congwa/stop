from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import ADMIN_TOKEN

_bearer = HTTPBearer()


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if credentials.credentials != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")
    return credentials.credentials
