from sqlalchemy.orm import Session
from sqlalchemy import desc, update
from typing import List

from services.database import create

from models import Task, TaskDataset, TaskDocument
import schemas.tasks as schemas
from tasks.types import TaskType


# Create
def create_task(
    task_type: TaskType,
    owner: str,
    db: Session,
):
    return create(db, Task(task_type=task_type, owner=owner))


def create_query_task(
    task_type: TaskType,
    documents_ids: List[int],
    owner: str,
    query: str,
    db: Session,
):
    db_task = create(db, Task(task_type=task_type, query=query, owner=owner))

    for document_id in documents_ids:
        create(
            db,
            TaskDocument(task_id=db_task.id, document_id=document_id),
        )

    return db_task


# Select by id
def get_task(task_id: int, db: Session) -> Task:
    return db.query(Task).filter(Task.id == task_id).first()


def get_task_document(task_id: int, document_id: int, db: Session):
    return (
        db.query(TaskDocument)
        .filter(
            TaskDocument.task_id == task_id
            and TaskDocument.document_id == document_id
        )
        .first()
    )


# Update
def update_task(task_id: int, task: schemas.TaskDefinition, db: Session):
    db.execute(
        update(Task)
        .where(Task.id == id)
        .values(
            task_state=task.task_state,
            started=task.started,
            finished=task.finished,
        )
    )
    db.commit()
    return get_task(task_id, db)


def update_task_document(
    task_id: int,
    task_document: schemas.TaskDocument,
    db: Session,
):
    db.execute(
        update(TaskDocument)
        .where(
            TaskDocument.task_id == task_id
            and TaskDocument.document_id == task_document.document_id
        )
        .values(
            deleted=task_document.deleted,
            processed=task_document.processed,
            error_type=task_document.error_type,
            error_message=task_document.error_message,
        )
    )
    db.commit()
    return get_task_document(task_id, task_document.document_id, db)


# Delete
def delete_task(task_id: int, db: Session):
    db_task_documents = (
        db.query(TaskDocument).where(TaskDocument.task_id == task_id).all()
    )
    for db_task_document in db_task_documents:
        db.delete(db_task_document)

    db_task_dataset = (
        db.query(TaskDataset).where(TaskDataset.task_id == task_id).first()
    )
    if db_task_dataset:
        db.delete(db_task_dataset)
        db.commit()

    db_task = db.query(Task).where(Task.id == task_id).first()
    db.delete(db_task)

    db.commit()
    return db_task


# Select
def get_tasks(db: Session, offset: int = 0, limit: int = 50):
    return (
        db.query(Task)
        .order_by(desc(Task.planned))
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_tasks_num_found(db: Session):
    return db.query(Task).count()
