from sqlalchemy.orm import Session

from catalogs.schemas import Frequency
from documents.models import Document
from tasks.enums import TaskDocumentErrorType
from tasks import crud


# TODO:
# def get_errors_distribution(task_id: int, db: Session):


def predict_volumes_pages(task_id: int, db: Session):
    from predictions.volumes_pages_predictor import VolumesPagesPredictor
    from predictions.frequency_parser import parse_frequency, parse_year

    predictor = VolumesPagesPredictor()

    def predict_volume_pages(document: Document) -> float:
        if document.publishing_year is None:
            raise ValueError("Document is missing a publishing year.")
        if document.publisher is None:
            raise ValueError("Document is missing a publisher.")
        if document.publishing_place is None:
            raise ValueError("Document is missing a publishing places.")
        # if not document.languages:
        #     raise ValueError("Document does not specify any language.")
        return predictor.predict(
            name=document.title,
            year=parse_year(document.publishing_year),
            publisher=document.publisher,
            origin=document.publishing_place,
            language=document.languages[0] if document.languages else "cze",
            frequency=parse_frequency(
                document.publishing_year,
                [Frequency(**freq) for freq in document.frequencies],
            ),
        )

    def set_document_error(
        document_id: int,
        error_type: TaskDocumentErrorType,
        error_message: str,
    ):
        crud.set_document_error(
            task_id,
            document_id,
            error_type,
            error_message,
            db,
        )

    for document in crud.get_unprocessed_task_documents(task_id, db):
        print(f"Processing document with id {document.id}")
        try:
            pages_count = predict_volume_pages(document)
            crud.set_predicted_pages_count(
                task_id, document.id, int(pages_count), db
            )
        except ValueError as e:
            set_document_error(
                document.id,
                TaskDocumentErrorType.ValueError,
                e.args[0],
            )
        except TypeError as e:
            set_document_error(
                document.id,
                TaskDocumentErrorType.ValueError,
                e.args[0],
            )
        except Exception as e:
            set_document_error(
                document.id,
                TaskDocumentErrorType.ValueError,
                e.args[0],
            )
        crud.set_document_processed(task_id, document.id, db)


def sync_from_catalog(task_id: int, owner: str, db: Session):
    from documents.routines import update_document_from_catalog

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
