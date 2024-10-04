import logging
from sqlalchemy.orm import Session
from datatypes import TaskItemErrorType
from models import Task


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_items_processing_task(session: Session, task_id: int, func: callable):
    for task_item in Task.get(session, task_id).items:
        logger.info(f"Processing item with id {task_item.item_id}")
        try:
            func(task_item)
        except ValueError as e:
            task_item.error_type = TaskItemErrorType.ValueError
            task_item.error_message = str(e)
        except TypeError as e:
            task_item.error_type = TaskItemErrorType.ValueError
            task_item.error_message = str(e)
        except Exception as e:
            task_item.error_type = TaskItemErrorType.UnknownError
            task_item.error_message = str(e)
        task_item.processed = True
        task_item.save(session)
