from sqlalchemy.orm import Session
from typing import List

from tasks.types import TaskDocumentErrorType
from crud.tasks import get_task
from models.tasks import Task, TaskDocument


def run_task(task_id: int, func: callable, db: Session):
    task: Task = get_task(task_id, db)
    task_documents: List[TaskDocument] = task.documents

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
