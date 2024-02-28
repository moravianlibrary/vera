from sqlalchemy.orm import Session

from catalogs.schemas import Frequency
from documents.models import Document
from tasks.enums import TaskDocumentErrorType
from tasks import crud


# TODO:
# def get_errors_distribution(task_id: int, db: Session):


def run_task(task_id: int, func: callable, db: Session):
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
            func(document)
        except ValueError as e:
            set_document_error(
                document.id,
                TaskDocumentErrorType.ValueError,
                str(e),
            )
        except TypeError as e:
            error_message = str(e)
            print(error_message)
            print("TypeError")
            set_document_error(
                document.id,
                TaskDocumentErrorType.ValueError,
                str(e),
            )
        except Exception as e:
            error_message = str(e)
            print(error_message)
            print("Exception")
            set_document_error(
                document.id,
                TaskDocumentErrorType.UnknownError,
                str(e),
            )
        crud.set_document_processed(task_id, document.id, db)


def predict_volumes_pages(task_id: int, db: Session):
    from predictions.volumes_pages_predictor import VolumesPagesPredictor
    from predictions.frequency_parser import parse_frequency, parse_year

    predictor = VolumesPagesPredictor()

    def predict_volume_pages(document: Document) -> None:
        if document.publishing_year is None:
            raise ValueError("Document is missing a publishing year.")
        if document.publisher is None:
            raise ValueError("Document is missing a publisher.")
        if document.publishing_place is None:
            raise ValueError("Document is missing a publishing places.")
        # if not document.languages:
        #     raise ValueError("Document does not specify any language.")
        pages_count = predictor.predict(
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
        crud.set_predicted_pages_count(
            task_id, document.id, int(pages_count), db
        )

    run_task(task_id, predict_volume_pages, db)


def sync_from_catalog(task_id: int, owner: str, db: Session):
    from catalogs.enums import IdentifierType
    from catalogs.routines import generate_catalog_document
    from catalogs.schemas import Identifier
    from documents.schemas import DocumentCreate

    def update_document_from_catalog(document: Document):
        identifier = (
            Identifier(
                identifier_type=IdentifierType.Barcode, value=document.barcode
            )
            if document.barcode
            else Identifier(
                identifier_type=IdentifierType.Sysno, value=document.sysno
            )
        )

        catalog_response = generate_catalog_document(identifier)
        newDocument = None
        if document.issuance_type:
            issue = [
                issue
                for issue in catalog_response.document.issues
                if issue.barcode == document.barcode
            ][0]
            newDocument = DocumentCreate.from_catalog_issue(
                catalog_response.document, issue, document.category_id
            )
        else:
            newDocument = DocumentCreate.from_catalog_document(
                catalog_response.document, document.category_id
            )
        crud.update_document(document.id, newDocument, owner, db)

    run_task(task_id, update_document_from_catalog, db)


def sync_from_digitization_registry(task_id: int, owner: str, db: Session):
    from catalogs.digitization_registry import get_digitization_state

    def update_document_from_digitization_registry(document: Document):
        state = get_digitization_state(document.barcode, document.cnb)
        crud.update_digitization_state(document.id, state, db)

    run_task(task_id, update_document_from_digitization_registry, db)
