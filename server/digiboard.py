from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from os import environ

import auth.router as auth_router
import categories.router as categories_router
import departments.router as departments_router
import documents.router as documents_router
import extractions.router as extractions_router
import roles.router as roles_router
import tasks.router as tasks_router
import users.router as users_router


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=(environ.get("ALLOW_ORIGINS").split(",")),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: add support to log editing of documents
# TODO: add checking unique before insert and update


@app.on_event("startup")
async def on_startup():
    from services.database import get_db
    from auth.crud import get_user_by_username
    from auth.auth import create_user
    from users.crud import update_user
    from auth.schemas import UserCreate
    from users.schemas import UserUpdate

    admin_username = environ.get("ADMIN_USERNAME")
    admin_password = environ.get("ADMIN_PASSWORD")

    if admin_username and admin_password:
        db = next(get_db())
        db_user = get_user_by_username("admin", db)
        if db_user is None:
            db_user = create_user(UserCreate(
                username=admin_username,
                password=admin_password
            ), db)
            update_user(UserUpdate(
                id=db_user.id,
                username=db_user.username,
                department_id=None,
                role_id=1
            ), db)


app.include_router(auth_router.router)
app.include_router(categories_router.router)
app.include_router(departments_router.router)
app.include_router(documents_router.router)
app.include_router(extractions_router.router)
app.include_router(roles_router.router)
app.include_router(tasks_router.router)
app.include_router(users_router.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
