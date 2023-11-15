from sqlalchemy.orm import Session

from . import models, schemas


def create_task(task: schemas.TaskCreate,
                db: Session):
    pass
    # return create(db, models.Task(
    # ))


def get_task(id: int,
             db: Session):
    return db.query(models.Task).filter(models.Task.id == id).first()
