from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from services.database import get_db
from . import crud, schemas


router = APIRouter()


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user_enlistment(user: schemas.User,
                           user_id: int = Path(...),
                           db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.update_user(user, db)


@router.delete("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int = Path(...),
                db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.delete_user(user_id, db)


@router.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int = Path(...),
             db: Session = Depends(get_db)):
    db_user = crud.get_user(user_id, db)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.get("/users", response_model=schemas.UsersResponse)
def get_users(offset: int = Query(0, description="Offset for pagination"),
              limit: int = Query(100, description="Limit for pagination"),
              db: Session = Depends(get_db)):
    users = crud.get_users(db, offset=offset, limit=limit),
    return schemas.UsersResponse(
        users=users[0],
        num_found=crud.get_users_num_found(db))


# @router.get("/users/{user_id}/actions", response_model=schemas.RoleActions)
# def get_user(user_id: int = Path(...),
#              db: Session = Depends(get_db)):
#     db_user = crud.get_user(user_id, db)
#     if db_user is None:
#         raise HTTPException(status_code=404, detail="User not found")

#     db_role = crud.get_role(db_user.role_id, db)
#     if db_role is None:
#         raise HTTPException(status_code=404, detail="Role not found")
#     return schemas.RoleActions(
#         id=db_role.id,
#         name=db_role.name,
#         actions=get_role_actions(db_user.role_id, db)
#     )
