from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from services.database import get_db
import crud.tasks as crud
import schemas.tasks as schemas
from tasks.types import TaskType
from schemas.security import CurrentUser
from security.api import CallerUsername
from routers.security import get_current_user
from schemas.documents_query import DocumentsQuery
from celery_worker import run_task
from tasks.permissions import CanPlanTask, CanManageTask


router = APIRouter(prefix="/tasks")


@router.post("", dependencies=[CanPlanTask], response_model=schemas.Task)
def create_task(
    task_type: TaskType = Query(...),
    query: Optional[DocumentsQuery] = None,
    username: str = CallerUsername(),
    db: Session = Depends(get_db),
):
    if query is None:
        task = crud.create_task(task_type, username, db)
    else:
        # TODO: fix
        documents_ids = []
        # documents_ids = [
        #     row[0] for row in get_documents_ids_query_base(db, query).all()
        # ]
        task = crud.create_query_task(
            task_type,
            documents_ids,
            username,
            query.model_dump_json(),
            db,
        )
    run_task.delay(task_id=task.id)
    return crud.get_task(task.id, db)


@router.put(
    "/{id}/kill", dependencies=[CanManageTask], response_model=schemas.Task
)
def kill_task(
    id: int = Path(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pass


@router.get("/{id}", dependencies=[CanPlanTask], response_model=schemas.Task)
def get_task(
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.get_task(id, db)


@router.get(
    "/{id}/documents",
    dependencies=[CanPlanTask],
    response_model=List[schemas.TaskDocument],
)
def get_task_documents(
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.get_task(id, db).documents


@router.get(
    "/{task_id}/dataset",
    dependencies=[CanPlanTask],
    response_model=schemas.Dataset,
)
def get_task_dataset(
    task_id: int = Path(...),
    db: Session = Depends(get_db),
):
    return crud.get_task(task_id, db).dataset


@router.get("", dependencies=[CanPlanTask], response_model=List[schemas.Task])
def get_tasks(
    offset: int = Query(0, description="Pagination page offset"),
    limit: int = Query(50, description="Pagination page size"),
    db: Session = Depends(get_db),
):
    return crud.get_tasks(db, offset, limit)
