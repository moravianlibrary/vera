from sqlalchemy.orm import Session

from catalogs.schemas import Frequency
from models import Document
from tasks.tasks.documents_processing import run_task


def predict_periodicals_pages(task_id: int, db: Session):
    from predictions.volumes_pages_predictor import VolumesPagesPredictor
    from predictions.frequency_parser import parse_frequency, parse_year

    predictor = VolumesPagesPredictor()

    def predict_volume_pages(document: Document) -> None:
        if document.year is None:
            raise ValueError("Document is missing a volume year")
        if document.publisher is None:
            raise ValueError("Document is missing a publisher")
        if document.publishing_place is None:
            raise ValueError("Document is missing a publishing places")
        if not document.languages:
            raise ValueError("Document is missing language information")
        pages_count = predictor.predict(
            name=document.title,
            year=parse_year(document.year),
            publisher=document.publisher,
            origin=document.publishing_place,
            language=document.languages[0],
            frequency=parse_frequency(
                document.year,
                [Frequency(**freq) for freq in document.frequencies],
            ),
        )
        document.pages_count_predicted = pages_count
        db.commit()

    run_task(task_id, predict_volume_pages, db)
