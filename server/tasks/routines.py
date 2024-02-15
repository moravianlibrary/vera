from sqlalchemy.orm import Session

from predictions.volumes_pages_predictor import VolumesPagesPredictor
from predictions.frequency_parser import parse_frequency, parse_year
from tasks.enums import TaskDocumentErrorType
from tasks import crud
from documents.models import Document
from documents.routines import update_document_from_catalog


# TODO:
# def get_errors_distribution(task_id: int, db: Session):


def predict_volume_pages(
    predictor: VolumesPagesPredictor, document: Document, db: Session
) -> float:
    if document.publishing_date is None:
        raise ValueError("Document is missing publishing date.")
    if not document.publishers:
        raise ValueError("Document does not have any publishers.")
    if not document.publishing_places:
        raise ValueError("Document does not have any publishing places.")
    if not document.languages:
        raise ValueError("Document does not specify any languages.")
    return predictor.predict(
        name=document.title,
        year=parse_year(document.publishing_date),
        publishers=document.publishers[0],
        publishing_places=document.publishing_places[0],
        languages=document.languages[0],
        frequencies=parse_frequency(
            document.publishing_date, document.frequencies
        ),
    )


def predict_volumes_pages(task_id: int, db: Session):
    predictor = VolumesPagesPredictor()
    for document in crud.get_unprocessed_task_documents(task_id, db):
        print(f"Processing document with id {document.id}")
        try:
            pages_count = predict_volume_pages(predictor, document, db)
            crud.set_predicted_pages_count(
                task_id, document.id, int(pages_count), db
            )
        except ValueError as e:
            crud.set_document_error(
                task_id,
                document.id,
                TaskDocumentErrorType.ValueError,
                e.args[0],
                db,
            )
        except Exception as e:
            crud.set_document_error(
                task_id,
                document.id,
                TaskDocumentErrorType.UnknownError,
                e.message,
                db,
            )
        crud.set_document_processed(task_id, document.id, db)


def sync_from_catalog(task_id: int, owner: str, db: Session):
    for document in crud.get_unprocessed_task_documents(task_id, db):
        try:
            update_document_from_catalog(document.id, owner, db)
        except Exception as e:
            crud.set_document_error(
                task_id,
                document.id,
                TaskDocumentErrorType.UnknownError,
                e.message,
                db,
            )
        crud.set_document_processed(task_id, document.id, db)
