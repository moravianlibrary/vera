from os import environ


def setUpEnv():
    environ["POSTGRES_HOST"] = "localhost"
    environ["JWT_SECRET_KEY"] = "MJJLWBd3FGfDddqkUC4qE+VX5HYexVK6hLkieod5aGQ="
    environ["JWT_ALGORITHM"] = "HS256"
    environ["ALLOW_ORIGINS"] = "http://localhost:3000"
    environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "300"
    environ["TIMEZONE"] = "Europe/Prague"
    environ["ADMIN_USERNAME"] = "admin"
    environ["ADMIN_PASSWORD"] = "digiboardAdmin"
