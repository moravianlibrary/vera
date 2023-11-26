from sqlalchemy.orm import desc, Session, update
from sqlalchemy import and_
from datetime import datetime
from typing import List

from services.database import create
from tasks import models, schemas
from documents.models import Document
from tasks.enums import TaskState


def create_task(task: schemas.TaskCreate,
                documents_ids: List[int],
                owner_id: int,
                query: str,
                db: Session):
    db_task = create(db, models.Task(
        task_type=task.task_type,
        task_scope=task.task_scope,
        query=query,
        owner_id=owner_id
    ))

    for document_id in documents_ids:
        create(db, models.TaskDocument(
            task_id=db_task.id,
            document_id=document_id
        ))

    return db_task


def get_task_documents(task_id: int,
                       db: Session):
    return (db.query(Document)
            .join(models.TaskDocument, and_(
                Document.id == models.TaskDocument.document_id,
                models.TaskDocument.task_id == task_id,
                not models.TaskDocument.processed
                ))
            .all())


def set_document_processed(document_id: int,
                           db: Session):
    db.execute(update(models.TaskDocument)
               .where(models.TaskDocument.document_id == document_id)
               .values(processed=True))


def update_task_state(id: int,
                      task_state: TaskState,
                      db: Session):
    db.execute(update(models.Task)
               .where(models.Task.id == id)
               .values(task_state=task_state))


def set_task_started(id: int,
                     started: datetime,
                     db: Session):
    # TODO: check if its already set
    db.execute(update(models.Task)
               .where(models.Task.id == id)
               .values(started=started))


def set_task_finsihed(id: int,
                      finished: datetime,
                      db: Session):
    # TODO: check if its already set
    db.execute(update(models.Task)
               .where(models.Task.id == id)
               .values(finished=finished))


def get_task(id: int,
             db: Session):
    return models.task_view(db).filter(models.Task.id == id).first()


def get_tasks(db: Session,
              offset: int = 0,
              limit: int = 100):
    return (models.task_view(db)
            .order_by(desc(models.Task.planned))
            .offset(offset).limit(limit)
            .all())


def get_tasks_num_found(db: Session):
    return db.query(models.Task).count()
