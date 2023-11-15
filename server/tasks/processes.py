from sqlalchemy.orm import Session

import tasks.crud


async def predict_pages(task_id: int, db: Session):
    pass