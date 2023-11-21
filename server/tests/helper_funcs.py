def setUpEnv():
    from os import environ
    environ["POSTGRES_HOST"] = "localhost"
    environ["JWT_SECRET_KEY"] = "MJJLWBd3FGfDddqkUC4qE+VX5HYexVK6hLkieod5aGQ="
    environ["JWT_ALGORITHM"] = "HS256"
    environ["ALLOW_ORIGINS"] = "http://localhost:3000"
    environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "300"
    environ["TIMEZONE"] = "Europe/Prague"
    environ["ADMIN_USERNAME"] = "admin"
    environ["ADMIN_PASSWORD"] = "digiboardAdmin"


def get_admin_token() -> str:
    from fastapi.testclient import TestClient
    from digiboard import app

    client = TestClient(app)
    response = client.post("/auth/login", json={
        "username": "admin",
        "password": "digiboardAdmin"
    })

    if response.status_code == 401:
        register_admin()
        return get_admin_token()

    return response.json()['access_token']


def register_admin():
    from digiboard import app
    from fastapi.testclient import TestClient
    from services.database import get_db
    from users.crud import update_user
    from users.schemas import UserUpdate

    client = TestClient(app)

    response = client.post("/auth/register", json={
        "username": "admin",
        "password": "digiboardAdmin"
    })
    user = response.json()

    update_user(user['id'],
                UserUpdate(
        username=user['username'],
        department_id=None,
        role_id=1
    ), next(get_db()))
