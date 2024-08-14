from typing import List
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
from services.marc_records_comparator import (
    MarcFieldDifference,
    MarcRecordsComparator,
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


@router.get(
    "/{sysno}/skc_difference",
    dependencies=[CanReadCatalogRecords],
    response_model=List[MarcFieldDifference],
)
def get_catalog_record_mzk_skc_diff(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    catalog_record = CatalogRecord.get(session, sysno)
    if catalog_record.skc_record is None:
        raise Exception("SKC record not found")
    return MarcRecordsComparator.evaluate(
        catalog_record.main_record,
        catalog_record.skc_record,
    )


@router.get(
    "/{sysno}/cnb_difference",
    dependencies=[CanReadCatalogRecords],
    response_model=List[MarcFieldDifference],
)
def get_catalog_record_mzk_cnb_diff(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    catalog_record = CatalogRecord.get(session, sysno)
    if catalog_record.cnb_record is None:
        raise Exception("CNB record not found")
    return MarcRecordsComparator.evaluate(
        catalog_record.main_record,
        catalog_record.cnb_record,
    )


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
