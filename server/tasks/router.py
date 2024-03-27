from fastapi import APIRouter, Depends, Path, Response, Query
from sqlalchemy.orm import Session
import tempfile
from fastapi.responses import FileResponse
from typing import List, Optional

from services.database import get_db
from tasks import crud, schemas
from tasks.enums import TaskType
from auth.schemas import CurrentUser
from auth.router import get_current_user
from documents.schemas import DocumentsQuery
from documents.crud import get_documents_ids_query_base
from celery_worker import run_task


router = APIRouter(prefix="/tasks")


@router.post("", response_model=schemas.Task)
def create_task(
    task_type: TaskType = Query(...),
    query: Optional[DocumentsQuery] = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if query is None:
        task = crud.create_task(task_type, user.username, db)
    else:
        documents_ids = [
            row[0] for row in get_documents_ids_query_base(db, query).all()
        ]
        task = crud.create_query_task(
            task_type,
            documents_ids,
            user.username,
            query.model_dump_json(),
            db,
        )
    run_task.delay(task_id=task.id)
    return crud.get_task(task.id, db)


@router.put("/{id}", response_model=schemas.Task)
def kill_task(
    id: int = Path(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pass


@router.get("/{id}", response_model=schemas.Task)
def get_task(
    id: int = Path(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_task(id, db)


@router.get("/{id}/documents", response_model=List[schemas.TaskDocument])
def get_task_documents(
    id: int = Path(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_task_documents(id, db)


@router.get("/{task_id}/csv")
def get_task_result(
    task_id: int = Path(...),
    db: Session = Depends(get_db),
):
    csv_text = crud.get_task_csv_text(task_id, db)
    if csv_text:
        with tempfile.NamedTemporaryFile(
            mode="w+", delete=False, suffix=".csv"
        ) as temp_file:
            temp_file.write(csv_text)
            temp_file_path = temp_file.name

        return FileResponse(temp_file_path, filename=f"task_{task_id}.csv")
    else:
        return Response(status_code=404)


@router.get("", response_model=List[schemas.Task])
def get_tasks(
    offset: int = Query(0, description="Pagination page offset"),
    limit: int = Query(50, description="Pagination page size"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return crud.get_tasks(db, offset, limit)
