from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from services.database import get_db
from . import auth, crud, schemas


router = APIRouter()


@router.post("/auth/register", response_model=schemas.User)
def register(
            user_create: schemas.UserCreate,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(user_create.username, db)
    if db_user is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Username is already taken")
    return auth.create_user(user_create, db)


@router.post("/auth/login", response_model=schemas.Token)
async def login(
            user_login: schemas.UserLogin,
            db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(user_login.username, db)
    if db_user is None or not auth.verify_password(user_login.password,
                                                   db_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password")
    access_token, expires_on = auth.create_access_token(
        data={"sub": db_user.username}
    )
    return schemas.Token(
        access_token=access_token,
        token_type="bearer",
        expires_on=expires_on
    )


@router.get("/auth/current_user", response_model=schemas.CurrentUser)
def get_current_user(db: Session = Depends(get_db),
                     token: str = Depends(auth.oauth2_scheme)):
    return auth.get_current_user(db, token)


@router.put("/auth/change_password", response_model=schemas.User)
def update_user_password(user_change_password: schemas.UserChangePassword,
                         db: Session = Depends(get_db)):
    return auth.change_user_password(user_change_password, db)
