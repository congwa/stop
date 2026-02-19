from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import SECRET_KEY, ADMIN_TOKEN

_bearer = HTTPBearer()
JWT_ALGORITHM = "HS256"


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    token = credentials.credentials
    # Support legacy static token for backward compat (dev only)
    if token == ADMIN_TOKEN:
        return token
    # Verify JWT
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("sub") != "admin":
            raise ValueError("not admin")
        return token
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期，请重新登录",
        )
