import os
from datetime import date
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "dev-admin-token-change-in-production")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "dev-admin-password-change-in-production")
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/stop_license.db")
PORT: int = int(os.getenv("PORT", "17771"))
HOST: str = os.getenv("HOST", "0.0.0.0")
KEY_EPOCH_DATE: date = date.fromisoformat(os.getenv("KEY_EPOCH_DATE", "2025-01-01"))
