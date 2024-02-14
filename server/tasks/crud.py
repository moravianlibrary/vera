from sqlalchemy.orm import Session
from sqlalchemy import desc, update
from sqlalchemy import and_
from datetime import datetime
from typing import List

from services.database import create
from tasks import models, schemas
from tasks.enums import TaskDocumentErrorType
from documents.models import Document
from tasks.enums import TaskState


def create_task(task: schemas.TaskCreate,
                documents_ids: List[int],
                owner: str,
                query: str,
                db: Session):
    db_task = create(db, models.Task(
        task_type=task.task_type,
        query=query,
        owner=owner
    ))

    for document_id in documents_ids:
        create(db, models.TaskDocument(
            task_id=db_task.id,
            document_id=document_id
        ))

    return db_task


def get_unprocessed_task_documents(task_id: int,
                                   db: Session):
    return (db.query(Document)
            .join(models.TaskDocument, and_(
                Document.id == models.TaskDocument.document_id,
                models.TaskDocument.task_id == task_id,
                models.TaskDocument.processed.is_(False)
                ))
            .all())


def update_task_state(id: int,
                      task_state: TaskState,
                      db: Session):
    db.execute(update(models.Task)
               .where(models.Task.id == id)
               .values(task_state=task_state))
    db.commit()


def set_task_started(id: int,
                     db: Session):
    db.execute(update(models.Task)
               .where(models.Task.id == id and models.Task.started is None)
               .values(started=datetime.utcnow()))
    db.commit()


def set_task_finsihed(id: int,
                      db: Session):
    db.execute(update(models.Task)
               .where(models.Task.id == id and models.Task.finished is None)
               .values(finished=datetime.utcnow()))
    db.commit()


def set_document_processed(task_id: int,
                           document_id: int,
                           db: Session):
    db.execute(update(models.TaskDocument)
               .where(models.TaskDocument.task_id == task_id
                      and models.TaskDocument.document_id == document_id)
               .values(processed=True))
    db.commit()


def set_document_error(task_id: int,
                       document_id: int,
                       error_type: TaskDocumentErrorType,
                       stack_trace: str,
                       db: Session):
    db.execute(update(models.TaskDocument)
               .where(models.TaskDocument.task_id == task_id
                      and models.TaskDocument.document_id == document_id)
               .values(error_type=error_type,
                       stack_trace=stack_trace))
    db.commit()


def set_predicted_pages_count(task_id: int,
                              document_id: int,
                              pages_count_predicted: int,
                              db: Session):
    db.execute(update(Document)
               .where(Document.id == document_id)
               .values(pages_count_predicted=pages_count_predicted))
    db.commit()


def get_task(id: int,
             db: Session) -> schemas.Task:
    return models.task_view(db).filter(models.Task.id == id).first()


def get_task_documents(task_id: int,
                       db: Session):
    return (db.query(models.TaskDocument)
            .filter(models.TaskDocument.task_id == task_id)
            .all())


def get_tasks(db: Session,
              offset: int = 0,
              limit: int = 50):
    return (models.task_view(db)
            .order_by(desc(models.Task.planned))
            .offset(offset).limit(limit)
            .all())


def get_tasks_num_found(db: Session):
    return db.query(models.Task).count()
