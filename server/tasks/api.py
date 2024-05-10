from sqlalchemy.orm import Session
from datetime import datetime
import pytz

from tasks import models
from tasks.enums import TaskState


# TODO: fix this


def update_task_state(task: models.Task, task_state: TaskState, db: Session):
    task.task_state = task_state
    db.commit()


def set_task_started(task: models.Task, db: Session):
    task.started = datetime.now(tz=pytz.timezone("Europe/Prague"))
    db.commit()


def set_task_finished(task: models.Task, db: Session):
    task.finished = datetime.now(tz=pytz.timezone("Europe/Prague"))
    db.commit()
