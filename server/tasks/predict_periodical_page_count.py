from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from schemas import IndexDocument
from services.predictor import Predictor


def PredictPeriodicalPageCount(session: Session, task_id: int):
    predictor = Predictor.get_instance()
    indexer = IndexDocument.get_indexer_instance()

    def predict_volume_pages(document: Document) -> None:
        document.pages_count_predicted = (
            predictor.predict_periodical_page_count(document)
        )
        document.save(session)

        indexer.index(document)

    run_task(session, task_id, predict_volume_pages)
