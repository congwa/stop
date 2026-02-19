import os
from datetime import date, datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "dev-admin-token-change-in-production")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "dev-admin-password-change-in-production")
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/stop_license.db")
PORT: int = int(os.getenv("PORT", "17771"))
HOST: str = os.getenv("HOST", "0.0.0.0")
KEY_EPOCH_DATE: date = date.fromisoformat(os.getenv("KEY_EPOCH_DATE", "2025-01-01"))

BEIJING_TZ = ZoneInfo("Asia/Shanghai")


def beijing_now() -> datetime:
    """返回当前北京时间（带时区信息）"""
    return datetime.now(BEIJING_TZ)


def beijing_today() -> date:
    """返回当前北京日期"""
    return datetime.now(BEIJING_TZ).date()
