import logging
from sqlalchemy.orm import Session
from datatypes import TaskDocumentErrorType
from models import Task


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_task(session: Session, task_id: int, func: callable):
    for task_document in Task.get(session, task_id).documents:
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
        task_document.save(session)
