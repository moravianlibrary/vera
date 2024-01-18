from sqlalchemy.orm import Session

from predictions.volumes_pages_predictor import VolumesPagesPredictor
from tasks import crud
from tasks.enums import TaskDocumentErrorType


# TODO:
# def get_errors_distribution(task_id: int, db: Session):


def parse_volume_number(volume_number: str):
    return int(volume_number)


def predict_volumes_pages(task_id: int,
                          db: Session):
    predicator = VolumesPagesPredictor()
    for document in crud.get_unprocessed_task_documents(task_id, db):
        print(f"Processing document with id {document.id}")
        if document.volume_number is None:
            crud.set_document_error_type(
                task_id, document.id, TaskDocumentErrorType.MissingVolume, db)
        else:
            pages_count = predicator.predict(
                name=document.title,
                year=parse_volume_number(document.volume_number),
                issues_count=1,
                publishers=document.publishers,
            )
            crud.set_predicted_pages_count(
                task_id, document.id, int(pages_count), db)
        crud.set_document_processed(task_id, document.id, db)
