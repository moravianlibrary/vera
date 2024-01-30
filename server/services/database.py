from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from os import environ
from typing import Any

DB_NAME = "vera"
DB_USER = "veraAdmin"
DB_PASSWORD = "password"
DB_HOST = environ.get("POSTGRES_HOST")
DB_PORT = "5432"

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}" \
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def create_tables():
    Base.metadata.create_all(engine)


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
