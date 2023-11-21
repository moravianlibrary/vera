from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from services.database import get_db
from users import crud, schemas


router = APIRouter()


@router.put("/users/{id}", response_model=schemas.User)
def update_user_enlistment(user: schemas.UserUpdate,
                           id: int = Path(...),
                           db: Session = Depends(get_db)):
    db_user = crud.get_user(id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.update_user(id, user, db)


@router.delete("/users/{id}", response_model=schemas.User)
def update_user(id: int = Path(...),
                db: Session = Depends(get_db)):
    db_user = crud.get_user(id, db)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.delete_user(id, db)


@router.get("/users/{id}", response_model=schemas.User)
def get_user(id: int = Path(...),
             db: Session = Depends(get_db)):
    db_user = crud.get_user(id, db)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.get("/users", response_model=schemas.UsersResponse)
def get_users(offset: int = Query(0, description="Offset for pagination"),
              limit: int = Query(100, description="Limit for pagination"),
              db: Session = Depends(get_db)):
    return schemas.UsersResponse(
        users=crud.get_users(db, offset=offset, limit=limit),
        num_found=crud.get_users_num_found(db))
