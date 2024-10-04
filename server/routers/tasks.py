from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datatypes import (
    TaskType,
    ElasticsearchParams,
    JsonBase,
    is_catalog_records_task,
    is_documents_task,
    TaskItemType,
)
from worker import run_task
from .utils.permissions import CanPlanTask, CanManageTask
from .utils.dependencies import (
    DependsOnCallerUsername,
    DependsOnDbSession,
    DependsOnEsSession,
)
from models import Task, TaskItem, PeriodicTask
from schemas import (
    TaskDefinition,
    TaskOverview,
    TaskItemResponse,
    Page,
    PeriodicTaskResponse,
    IndexDocument,
    IndexCatalogRecord,
    EsSession,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("", dependencies=[CanPlanTask], response_model=TaskDefinition)
def create_task(
    task_type: TaskType = Query(...),
    query_params: Optional[ElasticsearchParams] = None,
    owner: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
    db: Session = DependsOnDbSession,
):
    task = Task(
        task_type=task_type,
        query_params=query_params,
        owner=owner,
    ).save(db)

    if is_catalog_records_task(task_type):
        for catalog_record_sysno in IndexCatalogRecord.search_source_ids(
            es_session, query_params
        ):
            TaskItem(
                task_id=task.id,
                item_id=catalog_record_sysno,
                item_type=TaskItemType.CatalogRecord,
            ).save(db)
    elif is_documents_task(task_type):
        for document_id in IndexDocument.search_source_ids(
            es_session, query_params
        ):
            TaskItem(
                task_id=task.id,
                item_id=str(document_id),
                item_type=TaskItemType.Document,
            ).save(db)

    run_task.delay(task_id=task.id)
    return task


@router.put(
    "/{id}/kill", dependencies=[CanManageTask], response_model=TaskDefinition
)
def kill_task(
    id: int = Path(...),
    owner: str = DependsOnCallerUsername,
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
    "/{id}/items",
    dependencies=[CanPlanTask],
    response_model=List[TaskItemResponse],
)
def get_task_documents(
    id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return Task.get(db, id).items


@router.get(
    "/{task_id}/dataset",
    dependencies=[CanPlanTask],
    response_model=JsonBase,
)
def get_task_dataset(
    task_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return Task.get(db, task_id).dataset.data


@router.get("", dependencies=[CanPlanTask], response_model=Page[TaskOverview])
def get_tasks(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    db: Session = DependsOnDbSession,
):
    return Task.get_page(db, page, page_size)


@router.post(
    "/periodic",
    dependencies=[CanManageTask],
    response_model=PeriodicTaskResponse,
)
def create_periodic_task(
    task_type: TaskType = Query(...),
    minute: int = Query(...),
    hour: Optional[int] = Query(...),
    day_of_week: Optional[int] = Query(...),
    day_of_month: Optional[int] = Query(...),
    query_params: Optional[ElasticsearchParams] = None,
    session: Session = DependsOnDbSession,
):
    return PeriodicTask(
        task_type=task_type,
        query_params=query_params,
        minute=minute,
        hour=hour,
        day_of_week=day_of_week,
        day_of_month=day_of_month,
    ).save(session)


@router.put(
    "/periodic/{id}/query",
    dependencies=[CanManageTask],
    response_model=PeriodicTaskResponse,
)
def update_periodic_task_query(
    id: int = Path(...),
    query_params: Optional[ElasticsearchParams] = None,
    session: Session = DependsOnDbSession,
):
    periodic_task = PeriodicTask.get(session, id)
    periodic_task.query_params = query_params
    return periodic_task.save(session)


@router.put(
    "/periodic/{id}/schedule",
    dependencies=[CanManageTask],
    response_model=PeriodicTaskResponse,
)
def update_periodic_task_schedule(
    id: int = Path(...),
    minute: int = Query(...),
    hour: Optional[int] = Query(...),
    day_of_week: Optional[int] = Query(...),
    day_of_month: Optional[int] = Query(...),
    session: Session = DependsOnDbSession,
):
    periodic_task = PeriodicTask.get(session, id)
    periodic_task.minute = minute
    periodic_task.hour = hour
    periodic_task.day_of_week = day_of_week
    periodic_task.day_of_month = day_of_month
    return periodic_task.save(session)


@router.delete(
    "/periodic/{id}",
    dependencies=[CanManageTask],
    response_model=PeriodicTaskResponse,
)
def delete_periodic_task(
    id: int = Path(...), session: Session = DependsOnDbSession
):
    return PeriodicTask.get(session, id).delete(session)


@router.get(
    "/periodic/{id}",
    dependencies=[CanPlanTask],
    response_model=PeriodicTaskResponse,
)
def get_periodic_task(
    id: int = Path(...), session: Session = DependsOnDbSession
):
    return PeriodicTask.get(session, id)


@router.get(
    "/search/periodic",
    dependencies=[CanPlanTask],
    response_model=Page[PeriodicTaskResponse],
)
def get_periodic_tasks(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return PeriodicTask.get_page(session, page, page_size)
