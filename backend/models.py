from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field
from config import beijing_now


class License(SQLModel, table=True):
    __tablename__ = "licenses"

    id: Optional[int] = Field(default=None, primary_key=True)
    key_hash: str = Field(unique=True, index=True)
    expiry_date: Optional[date] = Field(default=None)
    machine_id: Optional[str] = Field(default=None, index=True)
    activated_at: Optional[datetime] = Field(default=None)
    is_revoked: bool = Field(default=False)
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=beijing_now)
    key_type: str = Field(default="30d")
    plain_key: Optional[str] = Field(default=None)


class LicenseCreate(SQLModel):
    key_type: str = "30d"
    count: int = 1
    note: Optional[str] = None


class LicenseRead(SQLModel):
    id: int
    key_hash: str
    expiry_date: Optional[date]
    machine_id: Optional[str]
    activated_at: Optional[datetime]
    is_revoked: bool
    note: Optional[str]
    created_at: datetime
    key_type: str
    plain_key: Optional[str]


class ActivateRequest(SQLModel):
    key: str
    machine_id: str


class VerifyRequest(SQLModel):
    key: str
    machine_id: str


class ActivateResponse(SQLModel):
    valid: bool
    expiry_date: Optional[date]
    server_time: str
    message: str = ""


class VerifyResponse(SQLModel):
    valid: bool
    expiry_date: Optional[date]
    server_time: str
    message: str = ""


class TimeResponse(SQLModel):
    server_time: str
    signature: str


class StatsResponse(SQLModel):
    total: int
    activated: int
    revoked: int
    expired: int
    today_activated: int
    expiring_soon: int
