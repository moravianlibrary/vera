from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session
from typing import List

from services.database import get_db
from roles import crud, schemas


router = APIRouter()


@router.post("/roles", response_model=schemas.RoleActions)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    db_role = crud.create_role(role, db)
    return schemas.RoleActions(
        id=db_role.id,
        name=db_role.name,
        actions=crud.get_role_actions(db_role.id, db),
    )


@router.put("/roles/{id}", response_model=schemas.RoleActions)
def update_role(
    role: schemas.RoleCreate,
    id: int = Path(...),
    db: Session = Depends(get_db),
):
    db_role = crud.update_role(id, role, db)
    return schemas.RoleActions(
        id=id, name=db_role.name, actions=crud.get_role_actions(id, db)
    )


@router.delete("/roles/{id}", response_model=schemas.Role)
def delete_role(id: int = Path(...), db: Session = Depends(get_db)):
    return crud.delete_role(id, db)


@router.get("/roles/{id}", response_model=schemas.RoleActions)
def get_role(d: int = Path(...), db: Session = Depends(get_db)):
    db_role = crud.get_role(id, db)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return schemas.RoleActions(
        id=db_role.id, name=db_role.name, actions=crud.get_role_actions(id, db)
    )


@router.get("/roles", response_model=List[schemas.RoleActions])
def get_roles(db: Session = Depends(get_db)):
    return [
        schemas.RoleActions(
            id=role.id,
            name=role.name,
            actions=crud.get_role_actions(role.id, db),
        )
        for role in crud.get_roles(db)
    ]


@router.get("/roles_names", response_model=List[schemas.Role])
def get_roles_names(db: Session = Depends(get_db)):
    return [
        schemas.Role(id=role.id, name=role.name) for role in crud.get_roles(db)
    ]
