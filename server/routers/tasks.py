from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datatypes import TaskType, ElasticsearchParams
from routers.security import get_current_user
from worker import run_task
from .utils.permissions import CanPlanTask, CanManageTask
from .utils.dependencies import (
    DependsOnCallerUsername,
    DependsOnDbSession,
    DependsOnDocumentsIndexer,
)
from services.documents_indexer import DocumentsIndexer
from models import Task, TaskDocument
from schemas import (
    CurrentUser,
    TaskDefinition,
    TaskOverview,
    TaskDocumentResponse,
    Dataset,
    Page,
)

router = APIRouter(prefix="/tasks")


@router.post("", dependencies=[CanPlanTask], response_model=TaskDefinition)
def create_task(
    task_type: TaskType = Query(...),
    query_params: Optional[ElasticsearchParams] = None,
    owner: str = DependsOnCallerUsername,
    db: Session = DependsOnDbSession,
    indexer: DocumentsIndexer = DependsOnDocumentsIndexer,
):
    if query_params is None:
        task = Task(task_type=task_type, owner=owner).save(db)
    else:
        task = Task(
            task_type=task_type,
            query=query_params,
            owner=owner,
        ).save(db)
        for document_id in indexer.get_document_ids(query_params):
            TaskDocument(task_id=task.id, document_id=document_id).save(db)
    run_task.delay(task_id=task.id)
    return task


@router.put(
    "/{id}/kill", dependencies=[CanManageTask], response_model=TaskDefinition
)
def kill_task(
    id: int = Path(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = DependsOnDbSession,
):
    pass


@router.get("/{id}", dependencies=[CanPlanTask], response_model=TaskOverview)
def get_task(
    id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return Task.get(db, id)


@router.get(
    "/{id}/documents",
    dependencies=[CanPlanTask],
    response_model=List[TaskDocumentResponse],
)
def get_task_documents(
    id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return Task.get(db, id).documents


@router.get(
    "/{task_id}/dataset",
    dependencies=[CanPlanTask],
    response_model=Dataset,
)
def get_task_dataset(
    task_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return Task.get(db, id).dataset


@router.get("", dependencies=[CanPlanTask], response_model=Page[TaskOverview])
def get_tasks(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    db: Session = DependsOnDbSession,
):
    return Task.get_page(db, page, page_size)
