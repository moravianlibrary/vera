from sqlalchemy import update
from sqlalchemy.orm import Session

from auth import models
from . import schemas
from typing import Optional


def get_user(user_id: int,
             db: Session):
    return (db.query(models.UserView)
            .filter(models.UserView.id == user_id)
            .first())


def update_user(user: schemas.User,
                db: Session):
    db.execute(update(models.User).where(models.User.id == user.id)
               .values(username=user.username)
               .values(department_id=user.department_id)
               .values(role_id=user.role_id))
    db.commit()
    return get_user(user.id, db)


def delete_user(user_id: int,
                db: Session):
    db_user = db.query(models.User).where(models.User.id == user_id).first()
    db.delete(db_user)
    db.commit()
    return db_user


def get_users(db: Session,
              department_id: Optional[int] = None,
              role_id: Optional[int] = None,
              offset: int = 0,
              limit: int = 100):
    q = db.query(models.UserView)

    if department_id is not None:
        q = q.filter(models.UserView.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.UserView.role_id == role_id)

    return q.offset(offset).limit(limit).all()


def get_users_num_found(db: Session,
                        department_id: Optional[int] = None,
                        role_id: Optional[int] = None):
    q = db.query(models.UserView)

    if department_id is not None:
        q = q.filter(models.UserView.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.UserView.role_id == role_id)

    return q.count()
