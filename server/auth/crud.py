from sqlalchemy import update
from sqlalchemy.orm import Session

from services.database import create
from . import models, schemas


def create_user(user_create: schemas.UserCreate,
                db: Session):
    return create(db, models.User(
        username=user_create.username,
        password=user_create.password
    ))


def get_user_by_username(username: str,
                         db: Session):
    return (db.query(models.User)
            .filter(models.User.username == username)
            .first())


def get_user(user_id: int,
             db: Session):
    return (db.query(models.User)
            .filter(models.User.id == user_id)
            .first())


def get_user_view(user_id: int,
                  db: Session):
    return (db.query(models.User)
            .filter(models.User.id == user_id)
            .first())


def get_user_actions(user_id: int,
                     db: Session):
    return (db.query(models.UserActionsView)
            .filter(models.User.id == user_id)
            .all())


def update_user_password(user_change_password: schemas.UserChangePassword,
                         db: Session):
    db.execute(update(models.User)
               .where(models.User.id == user_change_password.id)
               .values(password=user_change_password.new_password))
    db.commit()
    return get_user_view(user_change_password.id, db)
