from sqlalchemy.orm import Session

from services.database import create
from tasks.models import Task


def create_task(task: schemas.TaskCreate,
                db: Session):
    pass
    # return create(db, models.Task(
    # ))


def get_task(id: int,
             db: Session):
    return db.query(Task).filter(Task.id == id).first()
