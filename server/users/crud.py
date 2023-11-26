from sqlalchemy import update
from sqlalchemy.orm import Session
from typing import Optional

from users import models, schemas


def get_user(id: int,
             db: Session):
    return (models.user_view(db)
            .filter(models.User.id == id)
            .first())


def update_user(id: int,
                user: schemas.UserBase,
                db: Session):
    db.execute(update(models.User).where(models.User.id == id)
               .values(username=user.username)
               .values(department_id=user.department_id)
               .values(role_id=user.role_id))
    db.commit()
    return get_user(id, db)


def delete_user(id: int,
                db: Session):
    db_user = db.query(models.User).where(models.User.id == id).first()
    db.delete(db_user)
    db.commit()
    return db_user


def get_users_query_base(db: Session,
                         department_id: Optional[int] = None,
                         role_id: Optional[int] = None):
    q = models.user_view(db)

    if department_id is not None:
        q = q.filter(models.User.department_id == department_id)
    if role_id is not None:
        q = q.filter(models.User.role_id == role_id)
    return q


def get_users(db: Session,
              department_id: Optional[int] = None,
              role_id: Optional[int] = None,
              offset: int = 0,
              limit: int = 100):
    return (get_users_query_base(db, department_id, role_id)
            .offset(offset)
            .limit(limit)
            .all())


def get_users_num_found(db: Session,
                        department_id: Optional[int] = None,
                        role_id: Optional[int] = None):
    return (get_users_query_base(db, department_id, role_id)
            .count())
