from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from services.documents_indexer import DocumentsIndexer
from services.predictor import Predictor


def PredictPeriodicalPageCount(session: Session, task_id: int):
    predictor = Predictor.get_instance()
    indexer = DocumentsIndexer.get_instance()

    def predict_volume_pages(document: Document) -> None:
        if document.year is None:
            raise ValueError("Document is missing a volume year")
        if document.publisher is None:
            raise ValueError("Document is missing a publisher")
        if document.publishing_place is None:
            raise ValueError("Document is missing a publishing places")
        if not document.languages:
            raise ValueError("Document is missing language information")

        page_count = predictor.predict_periodical_page_count(document)
        if page_count is None:
            raise ValueError("Failed to predict page count")

        document.pages_count_predicted = page_count
        document.save(session)

        indexer.index(document)

    run_task(session, task_id, predict_volume_pages)
