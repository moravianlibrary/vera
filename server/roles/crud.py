from sqlalchemy import update
from sqlalchemy.orm import Session
from typing import List, Optional

from services.database import create
from roles import models, schemas
from roles.types import ActionType


def create_role(role: schemas.RoleCreate, db: Session) -> models.Role:
    db_role = create(db, models.Role(name=role.name))
    if role.actions:
        set_role_actions(db_role.id, role.actions, db)
    return db_role


def update_role(
    id: int, role: schemas.RoleCreate, db: Session
) -> Optional[models.Role]:
    db.execute(
        update(models.Role).where(models.Role.id == id).values(name=role.name)
    )
    set_role_actions(id, role.actions, db)

    return get_role(id, db)


def delete_role(id: int, db: Session) -> Optional[models.Role]:
    delete_role_actions(id, db)

    db_role = get_role(id, db)
    db.delete(db_role)

    db.commit()
    return db_role


def get_role(id: int, db: Session) -> Optional[models.Role]:
    return db.query(models.Role).filter(models.Role.id == id).first()


def get_role_by_name(name: str, db: Session) -> Optional[models.Role]:
    return db.query(models.Role).filter(models.Role.name == name).first()


def get_roles(db: Session) -> List[models.Role]:
    return db.query(models.Role).order_by(models.Role.name).all()


def get_role_actions(role_id: int, db: Session) -> List[ActionType]:
    return [
        action
        for action, in db.query(models.Action.action).filter(
            models.Action.role_id == role_id
        )
    ]


def set_role_actions(id: int, actions: List[ActionType], db: Session):
    delete_role_actions(id, db)
    for action in actions:
        create(
            db,
            models.Action(
                role_id=id,
                action=action,
            ),
        )
    db.commit()


def delete_role_actions(id: int, db: Session):
    actions_to_delete = (
        db.query(models.Action).filter(models.Action.role_id == id).all()
    )
    for action in actions_to_delete:
        db.delete(action)
    db.commit()
