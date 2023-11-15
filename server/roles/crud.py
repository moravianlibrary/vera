from sqlalchemy import update
from sqlalchemy.orm import Session

from services.database import create
from .enums import ActionType
from . import models, schemas
from typing import List


def create_role(role: schemas.RoleBase,
                db: Session):
    return create(db, models.Role(
        name=role.name
    ))


def set_role_actions(role_id: int,
                     actions: List[ActionType],
                     db: Session):
    for action in actions:
        create(db, models.Action(
            role_id=role_id,
            action=action,
        ))
    db.commit()


def update_role(role: schemas.Role,
                db: Session):
    db.execute(update(models.Role)
               .where(models.Role.id == role.id)
               .values(name=role.name))
    return db.query(models.Role).filter(models.Role.id == role.id).first()


def update_role_actions(role: schemas.RoleActions,
                        db: Session):
    actions_to_delete = get_role_actions_values(role.id, db)
    for action in actions_to_delete:
        db.delete(action)
    set_role_actions(role.id, role.actions, db)


def delete_role(role_id: int,
                db: Session):
    actions_to_delete = get_role_actions_values(role_id, db)
    for action in actions_to_delete:
        db.delete(action)

    db_role = db.query(models.Role).where(models.Role.id == role_id).first()
    db.delete(db_role)

    db.commit()
    return db_role


def get_role(role_id: int,
             db: Session):
    return db.query(models.Role).filter(models.Role.id == role_id).first()


def get_role_actions_values(role_id: int,
                            db: Session):
    return (db.query(models.Action)
            .filter(models.Action.role_id == role_id)
            .all())


def get_role_actions(role_id: int,
                     db: Session):
    return (db.query(models.Action.action)
            .filter(models.Action.role_id == role_id)
            .all())


def get_roles(db: Session):
    return db.query(models.Role).order_by(models.Role.name).all()
