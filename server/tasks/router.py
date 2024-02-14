from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List

from services.database import get_db
from tasks import crud, schemas
from auth.schemas import CurrentUser
from auth.router import get_current_user
from documents.schemas import DocumentsQuery
from documents.crud import get_documents_ids_query_base
from celery_worker import run_task


router = APIRouter()


@router.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate,
                query: DocumentsQuery,
                user: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    documents_ids = [row[0] for row in
                     get_documents_ids_query_base(db, query).all()]
    task = crud.create_task(task, documents_ids, user.username,
                            query.model_dump_json(), db)
    run_task.delay(task_id=task.id)
    return crud.get_task(task.id, db)


@router.put("/tasks/{id}", response_model=schemas.Task)
def kill_task(id: int = Path(...),
              user: CurrentUser = Depends(get_current_user),
              db: Session = Depends(get_db)):
    pass


@router.get("/tasks/{id}", response_model=schemas.Task)
def get_task(id: int = Path(...),
             user: CurrentUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    return crud.get_task(id, db)


@router.get("/tasks/{id}/documents", response_model=List[schemas.TaskDocument])
def get_task_documents(id: int = Path(...),
                       user: CurrentUser = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    return crud.get_task_documents(id, db)


@router.get("/tasks", response_model=List[schemas.Task])
def get_tasks(offset: int = Query(0, description="Pagination page offset"),
              limit: int = Query(50, description="Pagination page size"),
              user: CurrentUser = Depends(get_current_user),
              db: Session = Depends(get_db)):
    return crud.get_tasks(db, offset, limit)
