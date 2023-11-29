from sqlalchemy import update
from sqlalchemy.orm import Session

from services.database import create
from .enums import ActionType
from . import models, schemas
from typing import List


def create_role(role: schemas.RoleCreate,
                db: Session):
    db_role = create(db, models.Role(
        name=role.name
    ))
    if role.actions:
        set_role_actions(db_role.id, role.actions, db)
    return db_role


def update_role(id: int,
                role: schemas.Role,
                db: Session):
    db.execute(update(models.Role)
               .where(models.Role.id == id)
               .values(name=role.name))

    return db.query(models.Role).filter(models.Role.id == id).first()


def delete_role(id: int,
                db: Session):
    delete_role_actions(id, db)

    db_role = db.query(models.Role).where(models.Role.id == id).first()
    db.delete(db_role)

    db.commit()
    return db_role


def get_role(id: int,
             db: Session):
    return db.query(models.Role).filter(models.Role.id == id).first()


def get_roles(db: Session):
    return db.query(models.Role).order_by(models.Role.name).all()


def get_role_actions(role_id: int,
                     db: Session):
    return [action for action, in db.query(models.Action.action)
            .filter(models.Action.role_id == role_id)]


def set_role_actions(id: int,
                     actions: List[ActionType],
                     db: Session):
    delete_role_actions(id, db)
    for action in actions:
        create(db, models.Action(
            role_id=id,
            action=action,
        ))
    db.commit()


def delete_role_actions(id: int,
                        db: Session):
    actions_to_delete = (db.query(models.Action)
                         .filter(models.Action.role_id == id)
                         .all())
    for action in actions_to_delete:
        db.delete(action)
    db.commit()
