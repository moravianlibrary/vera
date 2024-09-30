from sqlalchemy.orm import Session
from models import Document
from tasks.documents_processing import run_task
from schemas import IndexDocument
from services.predictor import Predictor
from services.elasticsearch import get_es_session


def PredictPeriodicalPageCount(session: Session, task_id: int):
    predictor = Predictor.get_instance()
    es_session = next(get_es_session())

    def predict_volume_pages(document: Document) -> None:
        document.pages_count_predicted = (
            predictor.predict_periodical_page_count(document)
        )
        document.save(session)

        IndexDocument.model_validate(document).save(es_session)

    run_task(session, task_id, predict_volume_pages)
