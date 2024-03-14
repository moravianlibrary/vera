from typing import Any, List, Optional

from auth.schemas import CurrentUser


TOKEN_CALL = (
    "{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/token"
)


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
    from auth.dependencies import get_current_user

    app.dependency_overrides[get_current_user] = lambda: user


def cleanUpDependencyOverrides():
    from vera import app

    app.dependency_overrides = {}


def createTestClient():
    from fastapi.testclient import TestClient
    from vera import app

    return TestClient(app)


def createTestUser(actions=[]):
    return CurrentUser(
        username="test_user",
        department_id=10,
        department_name="test_department",
        role_id=7,
        role_name="test_role",
        actions=actions,
    )


def get_all_actions_except(actions):
    from roles.types import ActionType

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
    count_documents_with_pages: int = 0,
    count_documents_without_cnb: int = 0,
    count_documents: int = 0,
):
    from categories.schemas import CategoryNode

    return CategoryNode(
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
