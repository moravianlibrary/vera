from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from services.database import get_db
from . import crud, schemas


router = APIRouter()


@router.post("/roles", response_model=schemas.RoleActions)
def create_role(role: schemas.RoleCreate,
                db: Session = Depends(get_db)):
    db_role = crud.create_role(role, db)
    crud.create_role_actions(db_role.id, role.actions, db)
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(db_role.id, db)
    )


@router.put("/roles/{role_id}", response_model=schemas.RoleActions)
def update_role(role: schemas.RoleActions,
                db: Session = Depends(get_db)):
    db_role = crud.update_role(role, db)
    crud.update_role_actions(role, db)
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(db_role.id, db)
    )


@router.delete("/roles/{role_id}", response_model=schemas.Role)
def delete_role(role_id: int,
                db: Session = Depends(get_db)):
    return crud.delete_role(role_id, db)


def get_role_actions(role_id: int, db: Session):
    return [action[0] for action in crud.get_role_actions(role_id, db)]


@router.get("/roles/{role_id}", response_model=schemas.RoleActions)
def get_role(role_id: int = Path(...),
             db: Session = Depends(get_db)):
    db_role = crud.get_role(role_id, db)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=get_role_actions(role_id, db)
    )


@router.get("/roles_names", response_model=schemas.RolesResponse)
def get_roles_names(db: Session = Depends(get_db)):
    return schemas.RolesResponse(
        roles=[schemas.Role(id=role.id, name=role.name)
               for role in crud.get_roles(db)])


@router.get("/roles", response_model=schemas.RolesActionsResponse)
def get_roles(db: Session = Depends(get_db)):
    return schemas.RolesActionsResponse(roles=[schemas.RoleActions(
        id=role.id,
        name=role.name,
        actions=get_role_actions(role.id, db)
    ) for role in crud.get_roles(db)])
