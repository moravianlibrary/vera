import ast
import csv
import json
from sqlalchemy import select
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Any, List, Optional

from schemas import CurrentUser, DocumentResponse
from tests import test_crud  # noqa: F401
from models import Document


TOKEN_CALL = (
    "{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/token"
)

MOCK_DOCUMENTS_FILE = "tests/mock_documents.csv"
engine = None


def mockClsEnv(cls):
    from os import environ
    from unittest.mock import patch

    cls.mock_env_vars = {
        "POSTGRES_HOST": "localhost",
        "ALLOW_ORIGINS": "*",
        # "ALLOW_ORIGINS": "http://localhost:3000",
        "KEYCLOAK_CLIENT_ID": "vera-backend",
        "KEYCLOAK_ISSUER_CLIENT_ID": "vera",
    }
    cls.patcher = patch.dict(environ, cls.mock_env_vars)
    cls.patcher.start()


def mockUser(user: CurrentUser):
    from vera import app
    from routers.utils.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: user


def mock_db(items: List[Any] = []):
    from vera import app
    from services.database import Base, get_db

    DB_NAME = "vera-test"
    DB_USER = "veraAdmin"
    DB_PASSWORD = "password"
    DB_HOST = "localhost"
    DB_PORT = "5433"

    DATABASE_URL = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,  # Adjust the pool size as needed
        max_overflow=0,  # Adjust the overflow size as needed
        pool_timeout=30,  # Timeout for getting a connection from the pool
        pool_recycle=1800,  # Recycle connections after 30 minutes
        pool_pre_ping=True,  # Enable pre-ping to check connection validit
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    for item in items:
        try:
            session.add(item)
            session.commit()
        except Exception as e:
            session.rollback()
            raise Exception(f"Error seeding database: {e}")
        finally:
            session.close()

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db


def mock_index(session, indexer):
    for document in Document.all(session):
        indexer.index(document)


def get_test_db():
    from vera import app
    from services.database import get_db

    return next(app.dependency_overrides[get_db]())


def cleanUpDependencyOverrides():
    from vera import app

    app.dependency_overrides = {}


def createTestClient():
    from fastapi.testclient import TestClient
    from vera import app

    return TestClient(app)


def createTestUser(actions=[], department_id=10, settings={}):
    return CurrentUser(
        username="test_user",
        department_id=department_id,
        department_name="test_department",
        role_id=1,
        role_name="test_role",
        actions=actions,
        settings=settings,
    )


def get_all_actions_except(actions):
    from datatypes import ActionType

    return [action for action in ActionType if action not in actions]


def createTestCategoryNode(
    id: int = 1,
    name: str = "Test Category",
    description: Optional[str] = "Test Category Description",
    parent_id: Optional[int] = None,
    level: int = 0,
    assignable: bool = False,
    percentage: float = 0,
    extract_whole: bool = False,
    disabled: bool = False,
    departments: List[int] = [],
    children: List[Any] = [],
    count_pages: int = 0,
    count_pages_extractable: int = 0,
    count_documents_extractable: int = 0,
    count_documents_with_pages: int = 0,
    count_documents_without_cnb: int = 0,
    count_documents: int = 0,
):
    from schemas import CategoryResponse

    return CategoryResponse(
        id=id,
        name=name,
        description=description,
        parent_id=parent_id,
        level=level,
        assignable=assignable,
        percentage=percentage,
        extract_whole=extract_whole,
        disabled=disabled,
        departments=departments,
        children=children,
        count_pages=count_pages,
        count_pages_extractable=count_pages_extractable,
        count_documents_extractable=count_documents_extractable,
        count_documents_with_pages=count_documents_with_pages,
        count_documents_without_cnb=count_documents_without_cnb,
        count_documents=count_documents,
    )


def get_admin_token() -> str:
    from os import environ
    import requests

    body = {
        "client_id": environ.get("KEYCLOAK_ISSUER_CLIENT_ID"),
        "username": environ.get("VERA_USERNAME"),
        "password": environ.get("VERA_PASSWORD"),
        "grant_type": "password",
    }

    response = requests.post(
        TOKEN_CALL.format(
            KEYCLOAK_HOST=environ.get("KEYCLOAK_SERVER_URL"),
            REALM_NAME=environ.get("KEYCLOAK_REALM"),
        ),
        data=body,
    )

    return response.json()["access_token"]


def get_test_user_token() -> str:
    from os import environ
    import requests

    body = {
        "client_id": environ.get("KEYCLOAK_ISSUER_CLIENT_ID"),
        "username": "vera_user",
        "password": "vera_user",
        "grant_type": "password",
    }

    response = requests.post(
        TOKEN_CALL.format(
            KEYCLOAK_HOST=environ.get("KEYCLOAK_SERVER_URL"),
            REALM_NAME=environ.get("KEYCLOAK_REALM"),
        ),
        data=body,
    )

    return response.json()["access_token"]


def parse_str_list(data):
    parsed_list = ast.literal_eval(data)
    if isinstance(parsed_list, list):
        return parsed_list
    else:
        raise ValueError("Input is not a valid list")


def parse_frequency_list(data):
    parsed_list = json.loads(data.replace("'", '"').replace("None", "null"))
    if isinstance(parsed_list, list):
        return parsed_list
    else:
        raise ValueError("Input is not a valid list")


def get_mock_document_view_documents():
    mock_documents = []
    with open(MOCK_DOCUMENTS_FILE, "r", newline="") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            mock_document = DocumentResponse(
                id=int(row["id"]),
                sysno=row["sysno"],
                volume=row.get("volume"),
                barcode=row["barcode"],
                category_id=(
                    int(row["category_id"]) if row.get("category_id") else None
                ),
                category_name=row.get("category_name"),
                cnb=row.get("cnb"),
                isbn_issn=row.get("isbn_issn"),
                signature=row.get("signature"),
                material_type=(
                    row.get("material_type")
                    if row.get("material_type")
                    else None
                ),
                issuance_type=(
                    row.get("issuance_type")
                    if row.get("issuance_type")
                    else None
                ),
                title=row.get("title"),
                digitization_state=row.get("digitization_state"),
                year=row.get("year"),
                bundle=row.get("bundle"),
                pages_count=(
                    int(row.get("pages_count"))
                    if row.get("pages_count")
                    else None
                ),
                pages_count_predicted=(
                    int(row.get("pages_count_predicted"))
                    if row.get("pages_count_predicted")
                    else None
                ),
                pages_count_manual=(
                    int(row.get("pages_count_manual"))
                    if row.get("pages_count_manual")
                    else None
                ),
                size=row.get("size"),
                locationUri=row.get("locationUri"),
                publisher=row.get("publisher"),
                publishing_place=row.get("publishing_place"),
                publishing_year=row.get("publishing_year"),
                languages=(
                    parse_str_list(row.get("languages"))
                    if row.get("languages")
                    else None
                ),
                frequencies=(
                    parse_frequency_list(row.get("frequencies"))
                    if row.get("frequencies")
                    else None
                ),
                dedicated_scanner=row.get("dedicated_scanner"),
                created_at=row.get("created_at"),
                creator=row.get("creator"),
                extraction_id=(
                    int(row.get("extraction_id"))
                    if row.get("extraction_id")
                    else None
                ),
                extractor=row.get("extractor"),
                extracted_at=row.get("extracted_at"),
            )
            mock_documents.append(mock_document)
    return select(mock_documents)
