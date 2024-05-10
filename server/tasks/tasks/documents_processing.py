from sqlalchemy.orm import Session
from typing import List

from tasks.enums import TaskDocumentErrorType
from tasks import crud, models


def run_task(task_id: int, func: callable, db: Session):
    task: models.Task = crud.get_task(task_id, db)
    task_documents: List[models.TaskDocument] = task.documents

    for task_document in task_documents:
        print(f"Processing document with id {task_document.document_id}")
        try:
            func(task_document.document)
        except ValueError as e:
            task_document.error_type = TaskDocumentErrorType.ValueError
            task_document.error_message = str(e)
        except TypeError as e:
            task_document.error_type = TaskDocumentErrorType.ValueError
            task_document.error_message = str(e)
        except Exception as e:
            task_document.error_type = TaskDocumentErrorType.UnknownError
            task_document.error_message = str(e)
        task_document.processed = True
        db.commit()
