from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base, DeclarativeMeta
from sqlalchemy.orm import sessionmaker, Session
import logging
from os import environ
import time
import yaml

DB_NAME = "vera"
DB_USER = "veraAdmin"
DB_PASSWORD = "password"
DB_HOST = environ.get("POSTGRES_HOST")
DB_PORT = "5432"

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}" f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
engine = create_engine(
    DATABASE_URL,
    pool_size=20,  # Adjust the pool size as needed
    max_overflow=0,  # Adjust the overflow size as needed
    pool_timeout=30,  # Timeout for getting a connection from the pool
    pool_recycle=1800,  # Recycle connections after 30 minutes
    pool_pre_ping=True,  # Enable pre-ping to check connection validit
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base: DeclarativeMeta = declarative_base()

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


def get_actual_revision():
    from sqlalchemy import text

    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT version_num FROM alembic_version;")
            )
            row = result.fetchone()
            if row is not None:
                return row[0]
    except Exception:
        return None


def check_database_revision():
    from alembic.command import upgrade
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    alembic_cfg = Config("alembic.ini")
    script_dir = ScriptDirectory.from_config(alembic_cfg)
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    heads = script_dir.get_revisions("head")
    latest_revision = heads[0].revision if heads else None

    if get_actual_revision() != latest_revision:
        upgrade(alembic_cfg, "head")

    logger.info(
        f"Using database revision {latest_revision}.",
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_all_models():
    return [mapper.class_ for mapper in Base.registry.mappers]


def get_model_by_tablename(tablename: str):
    models = get_all_models()
    for model in models:
        if model.__tablename__ == tablename:
            return model
    raise Exception(f"Table with name {tablename} does not exists")


def export_to_yaml(session: Session, model) -> str:
    # TODO: use ModelBase all
    instances = session.query(model).all()
    tablename = model.__tablename__
    return yaml.dump(
        {tablename: [instance.to_dict() for instance in instances]},
        default_flow_style=False,
        sort_keys=False,
    )


def import_to_yaml(session: Session, yaml_string: str):
    for tablename, data in yaml.safe_load(yaml_string):
        model = get_model_by_tablename(tablename)
        model.from_dict(data)
