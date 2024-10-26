from typing import List
from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from models import (
    CatalogRecord,
    Task,
    TaskItem,
    CatalogRecordFieldDifference,
)
from datatypes import TaskType, CatalogSource
from exceptions import ObjectMissingRequiredFieldException
from schemas import EsSession, IndexCatalogRecord
from worker import run_task
from .utils.permissions import CanReadCatalogRecords, CanReviewCatalogRecords
from .utils.dependencies import (
    DependsOnDbSession,
    DependsOnCallerUsername,
    DependsOnEsSession,
)
from services.marc_comparator import (
    MarcFieldDifference,
    MarcRecordsComparator,
)
from datatypes import ElasticsearchParams, TaskItemType


router = APIRouter(prefix="/catalog_records", tags=["Catalog records"])


@router.post(
    "/search",
    dependencies=[CanReadCatalogRecords],
    response_model=None,
)
def search_catalog_records(
    query_params: ElasticsearchParams,
    es_session: EsSession = DependsOnEsSession,
):
    return IndexCatalogRecord.search(es_session, query_params)


@router.get(
    "/{sysno}",
    dependencies=[CanReadCatalogRecords],
    response_model=IndexCatalogRecord,
)
def get_catalog_record(
    sysno: str = Path(...),
    session: Session = DependsOnDbSession,
):
    return CatalogRecord.get(session, sysno)


# TODO: Implement differences getter with filtering


@router.patch(
    "/differences/{difference_id}/approve",
    dependencies=[CanReviewCatalogRecords],
    response_model=IndexCatalogRecord,
)
def approve_catalog_record_difference(
    difference_id: int = Path(...),
    approved_by: str = DependsOnCallerUsername,
    es_session: EsSession = DependsOnEsSession,
    session: Session = DependsOnDbSession,
):
    difference = CatalogRecordFieldDifference.get(
        session, difference_id
    ).approve(session, approved_by)
    catalog_record: CatalogRecord = difference.catalog_record

    record = IndexCatalogRecord.model_validate(catalog_record)
    record.save(es_session, True)

    # Catalog record validity was not changed, no need to reindex documents
    if (
        difference.is_skc_difference
        and not catalog_record.has_valid_main_record
    ) or (difference.is_cnb_difference and not catalog_record.has_valid_cnb):
        return record

    # Catalog record validity was changed, reindexing documents
    task = Task(
        task_type=TaskType.ReindexCatalogRecords,
        owner=approved_by,
    ).save(session)
    for document_id in catalog_record.document_ids:
        TaskItem(
            task_id=task.id,
            item_id=str(document_id),
            item_type=TaskItemType.Document,
        ).save(session)
    run_task.delay(task_id=task.id)

    return record


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
