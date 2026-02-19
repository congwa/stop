import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from config import DATABASE_URL

os.makedirs("data", exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

_MIGRATIONS = [
    "ALTER TABLE licenses ADD COLUMN plain_key TEXT",
]


def _run_migrations():
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(licenses)"))}
        for sql in _MIGRATIONS:
            col = sql.split("ADD COLUMN ")[1].split()[0]
            if col not in existing:
                conn.execute(text(sql))
        conn.commit()


def init_db():
    SQLModel.metadata.create_all(engine)
    _run_migrations()


def get_session():
    with Session(engine) as session:
        yield session
