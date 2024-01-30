from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from os import environ

import auth.router as auth_router
import categories.router as categories_router
import categories.quotas.router as quotas_router
import departments.router as departments_router
import documents.router as documents_router
import extractions.router as extractions_router
import roles.router as roles_router
import tasks.router as tasks_router


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
    from services.database import create_tables, get_db
    from roles.crud import get_role, create_role
    from roles.enums import ActionType
    from roles.schemas import RoleCreate

    create_tables()

    db = next(get_db())

    db_role = get_role(1, db)
    if db_role is None:
        create_role(RoleCreate(
            name="Admin",
            actions=list(ActionType)
        ), db)


app.include_router(auth_router.router)
app.include_router(categories_router.router)
app.include_router(quotas_router.router)
app.include_router(departments_router.router)
app.include_router(documents_router.router)
app.include_router(extractions_router.router)
app.include_router(roles_router.router)
app.include_router(tasks_router.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
