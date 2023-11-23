from sqlalchemy.orm import Session
from typing import List

from predictions.predict_items_pages import ItemsPagesPredictor
from tasks import crud
from tasks.enums import TaskDocumentErrorType


def parse_volume_number(volume_number: str):
    return int(volume_number)


def parse_item_number(item_number: str):
    return int(item_number)


def parse_publishers(publishers: List[str]):
    return publishers[0]


def predict_items_pages(task_id: int,
                        preserve_pages_count: bool,
                        db: Session):
    predicator = ItemsPagesPredictor()
    for document in crud.get_task_documents(task_id, db):
        if document.volume_number is None:
            crud.set_document_error_type(
                document, TaskDocumentErrorType.MISING_VOLUME, db)
        elif document.item_number is None:
            crud.set_document_error_type(
                document, TaskDocumentErrorType.MISING_ITEM, db)
        elif document.pages_count is not None and preserve_pages_count:
            crud.set_document_error_type(
                document, TaskDocumentErrorType.CONFLICT_PAGES_COUNT, db)
        else:
            pages_count = predicator.predict(
                name=document.title,
                year=parse_volume_number(document.volume_number),
                issue=parse_item_number(document.item_number),
                publisher=parse_publishers(document.publishers),
            )
            crud.set_document_pages_count(
                document.id, pages_count, db)
