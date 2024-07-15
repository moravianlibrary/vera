from sqlalchemy.orm import Session
from sqlalchemy import update, or_
from datetime import datetime
import pytz

import models.tasks as models
from tasks.types import TaskState


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


def set_failed_tasks_on_start(db: Session):
    db.execute(
        update(models.Task)
        .where(
            or_(
                models.Task.task_state == TaskState.Planned,
                models.Task.task_state == TaskState.Running,
            )
        )
        .values(
            task_state=TaskState.Failed,
            finished=datetime.now(tz=pytz.timezone("Europe/Prague")),
        )
    )
    db.commit()
