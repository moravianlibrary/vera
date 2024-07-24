import logging
from sqlalchemy.orm import Session
from typing import List
from datatypes import TaskDocumentErrorType
from models import Task, TaskDocument


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_task(task_id: int, func: callable, db: Session):
    task = Task.get(db, task_id)
    task_documents: List[TaskDocument] = task.documents

    for task_document in task_documents:
        logger.info(f"Processing document with id {task_document.document_id}")
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
