from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base, DeclarativeMeta
from sqlalchemy.orm import sessionmaker, Session
import yaml
from config import VeraConfig

DatabaseUrl = (
    f"postgresql://"
    f"{VeraConfig.Postgres.User}:{VeraConfig.Postgres.Password}"
    f"@{VeraConfig.Postgres.Host}:{VeraConfig.Postgres.Port}"
    f"/{VeraConfig.Postgres.DatabaseName}"
)

Engine = create_engine(
    url=DatabaseUrl,
    pool_size=VeraConfig.Postgres.PoolSize,
    max_overflow=VeraConfig.Postgres.MaxOverflow,
    pool_timeout=VeraConfig.Postgres.PoolTimeout,
    pool_recycle=VeraConfig.Postgres.PoolRecycle,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=Engine)

Base: DeclarativeMeta = declarative_base()


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_all_models():
    return [mapper.class_ for mapper in Base.registry.mappers]


def get_model_by_tablename(tablename: str):
    models = get_all_models()
    for model in models:
        if model.__tablename__ == tablename:
            return model
    raise Exception(f"Table with name {tablename} does not exists")


def import_from_yaml(session: Session, yaml_string: str):
    for tablename, items in yaml.safe_load(yaml_string).items():
        model = get_model_by_tablename(tablename)
        for item in items:
            db_item = model.from_dict(item)
            if db_item.is_persisted(session):
                continue
            db_item.merge(session)
