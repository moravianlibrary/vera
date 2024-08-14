from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from models import CatalogRecord, Task, TaskDocument
from datatypes import TaskType
from schemas import CatalogRecordResponse, Page
from worker import run_task
from .utils.permissions import CanReadCatalogRecords, CanReviewCatalogRecords
from .utils.dependencies import (
    DependsOnDbSession,
    DependsOnCallerUsername,
)


router = APIRouter(prefix="/catalog_records")


@router.get(
    "",
    dependencies=[CanReadCatalogRecords],
    response_model=Page[CatalogRecordResponse],
)
def get_catalog_records(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    return CatalogRecord.get_page(session, page, page_size)


@router.get(
    "/{sysno}",
    dependencies=[CanReadCatalogRecords],
    response_model=CatalogRecordResponse,
)
def get_catalog_record(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    return CatalogRecord.get(session, sysno)


@router.patch(
    "/{sysno}/approve_difference/{difference_id}",
    dependencies=[CanReviewCatalogRecords],
    response_model=CatalogRecordResponse,
)
def approve_catalog_record_difference(
    sysno: str = Path(...),
    difference_id: int = Path(...),
    approved_by: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
):
    catalog_record = CatalogRecord.get(session, sysno).approve_difference(
        session, difference_id, approved_by
    )

    task = Task(
        task_type=TaskType.Reindex,
        owner=approved_by,
    ).save(session)
    for document_id in catalog_record.document_ids:
        TaskDocument(task_id=task.id, document_id=document_id).save(session)
    run_task.delay(task_id=task.id)

    return catalog_record
