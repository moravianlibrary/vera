from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import logging
from os import environ
import time
from typing import Any

DB_NAME = "vera"
DB_USER = "veraAdmin"
DB_PASSWORD = "password"
DB_HOST = environ.get("POSTGRES_HOST")
DB_PORT = "5432"

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}" f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

logger = logging.getLogger("uvicorn")


def check_connection():
    from sqlalchemy.exc import OperationalError

    retries = 5
    for attempt in range(retries):
        try:
            with engine.connect():
                return True
        except OperationalError:
            logger.error(
                f"Attempt {attempt + 1}/{retries}: "
                f"Failed to connect to the database. Retrying."
            )
            time.sleep(2**attempt)

    return False


def check_database_revision():
    from alembic.command import upgrade
    from alembic.config import Config

    from alembic.script import ScriptDirectory

    alembic_cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    heads = script_dir.get_revisions("head")
    latest_revision = heads[0] if heads else None

    upgrade(alembic_cfg, "head")

    revision = latest_revision.revision if latest_revision else None
    logger.info(
        f"Using database revision {revision}.",
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create(db: Session, db_item: Any):
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
