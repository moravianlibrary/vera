from fastapi import APIRouter, Path
from sqlalchemy.orm import Session
from typing import List
from .utils.dependencies import DependsOnDbSession
from .utils.permissions import CanManageAccess
from schemas import (
    RoleCreate,
    RoleResponse,
)
from models import Role


router = APIRouter(prefix="/roles")


@router.post("", dependencies=[CanManageAccess], response_model=RoleResponse)
def create_role(role: RoleCreate, db: Session = DependsOnDbSession):
    return role.load_to_model(Role()).save(db).save_actions(db, role.actions)


@router.put(
    "/{role_id}",
    dependencies=[CanManageAccess],
    response_model=RoleResponse,
)
def update_role(
    role: RoleCreate,
    role_id: int = Path(...),
    db: Session = DependsOnDbSession,
):
    return (
        role.load_to_model(db, Role.get(db, role_id))
        .save(db)
        .save_actions(db, role.actions)
    )


@router.delete(
    "/{role_id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def delete_role(role_id: int = Path(...), db: Session = DependsOnDbSession):
    return Role.get(db, role_id).delete(db)


@router.get(
    "/{role_id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def get_role(role_id: int = Path(...), db: Session = DependsOnDbSession):
    return Role.get(db, role_id)


@router.get(
    "", dependencies=[CanManageAccess], response_model=List[RoleResponse]
)
def get_roles(db: Session = DependsOnDbSession):
    return Role.all(db)
