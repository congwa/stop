from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status
from sqlmodel import SQLModel
from jose import jwt

from config import SECRET_KEY, ADMIN_PASSWORD

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24


class LoginRequest(SQLModel):
    private_key: str


class TokenResponse(SQLModel):
    token: str
    expires_in: int


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    if body.private_key != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="私钥错误",
        )
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": "admin", "exp": expire, "iat": datetime.utcnow()}
    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return TokenResponse(token=token, expires_in=JWT_EXPIRE_HOURS * 3600)
