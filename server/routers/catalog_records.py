from typing import List
from fastapi import APIRouter, Path, Query
from sqlalchemy.orm import Session
from models import (
    CatalogRecord,
    Task,
    TaskDocument,
    CatalogRecordFieldDifference,
)
from datatypes import TaskType, CatalogSource
from exceptions import ObjectMissingRequiredFieldException
from schemas import CatalogRecordResponse, Page
from worker import run_task
from .utils.permissions import CanReadCatalogRecords, CanReviewCatalogRecords
from .utils.dependencies import (
    DependsOnDbSession,
    DependsOnCallerUsername,
)
from services.marc_comparator import (
    MarcFieldDifference,
    MarcRecordsComparator,
)
from logic import update_catalog_record as update_catalog_record_logic
from services.external.aleph import AlephResponseStatus


router = APIRouter(prefix="/catalog_records", tags=["Catalog records"])


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


@router.post(
    "/{sysno}/update",
    dependencies=[CanReadCatalogRecords],
    response_model=CatalogRecordResponse,
)
def update_catalog_record(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    catalog_record, status = update_catalog_record_logic.update_catalog_record(
        session, sysno
    )
    if status != AlephResponseStatus.Success:
        raise Exception(f"Failed to update catalog record {sysno}: {status}")
    return catalog_record


@router.post(
    "/{sysno}/update_differences",
    dependencies=[CanReadCatalogRecords],
    response_model=CatalogRecordResponse,
)
def update_catalog_record_differences(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    catalog_record = CatalogRecord.get(session, sysno)
    update_catalog_record_logic.update_catalog_record_differences(
        session, catalog_record
    )
    return catalog_record


# TODO: Implement differences getter with filtering
@router.get(
    "/differences",
    dependencies=[CanReadCatalogRecords],
    response_model=Page[MarcFieldDifference],
)
def get_catalog_record_differences(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    session: Session = DependsOnDbSession,
):
    pass


@router.patch(
    "/differences/{difference_id}/approve",
    dependencies=[CanReviewCatalogRecords],
    response_model=CatalogRecordResponse,
)
def approve_catalog_record_difference(
    difference_id: int = Path(...),
    approved_by: str = DependsOnCallerUsername,
    session: Session = DependsOnDbSession,
):
    difference = CatalogRecordFieldDifference.get(
        session, difference_id
    ).approve(session, approved_by)
    catalog_record: CatalogRecord = difference.catalog_record

    # Catalog record validity was not changed, no need to reindex documents
    if (
        difference.is_skc_difference
        and not catalog_record.has_valid_main_record
    ) or (difference.is_cnb_difference and not catalog_record.has_valid_cnb):
        return difference

    # Catalog record validity was changed, reindexing documents
    task = Task(
        task_type=TaskType.Reindex,
        owner=approved_by,
    ).save(session)
    for document_id in catalog_record.document_ids:
        TaskDocument(task_id=task.id, document_id=document_id).save(session)
    run_task.delay(task_id=task.id)

    return difference


@router.get(
    "/{sysno}/differences/{catalog_source}",
    dependencies=[CanReadCatalogRecords],
    response_model=List[MarcFieldDifference],
)
def get_catalog_record_difference(
    sysno: str = Path(...),
    catalog_source: CatalogSource = Path(...),
    session: Session = DependsOnDbSession,
):
    catalog_record = CatalogRecord.get(session, sysno)
    compare_to = (
        catalog_record.skc_record
        if catalog_source == CatalogSource.SKC
        else catalog_record.cnb_record
    )

    if compare_to is None:
        raise ObjectMissingRequiredFieldException(
            "Catalog record",
            sysno,
            (
                "SKC record"
                if catalog_source == CatalogSource.SKC
                else "CNB record"
            ),
        )

    return MarcRecordsComparator().evaluate(
        catalog_record.main_record, compare_to
    )
