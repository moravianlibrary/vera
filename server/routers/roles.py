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
def create_role(role: RoleCreate, session: Session = DependsOnDbSession):
    return role.load_to_model(Role()).save(session)


@router.put(
    "/{role_id}",
    dependencies=[CanManageAccess],
    response_model=RoleResponse,
)
def update_role(
    role: RoleCreate,
    role_id: int = Path(...),
    session: Session = DependsOnDbSession,
):
    return role.load_to_model(Role.get(session, role_id)).save(session)


@router.delete(
    "/{role_id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def delete_role(
    role_id: int = Path(...), session: Session = DependsOnDbSession
):
    return Role.get(session, role_id).delete(session)


@router.get(
    "/{role_id}", dependencies=[CanManageAccess], response_model=RoleResponse
)
def get_role(role_id: int = Path(...), session: Session = DependsOnDbSession):
    return Role.get(session, role_id)


@router.get(
    "", dependencies=[CanManageAccess], response_model=List[RoleResponse]
)
def get_roles(session: Session = DependsOnDbSession):
    return Role.all(session)
