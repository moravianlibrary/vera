from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from base64 import b64decode
from datetime import datetime, timedelta
from os import environ

from database import get_db
from models import Role
from etypes import ActionType
import schemas
from typing import Set
import crud


SECRET_KEY=environ.get("JWT_SECRET_KEY")
ALGORITHM=environ.get("JWT_ALGORITHM")
EXPIRES_DELTA = timedelta(minutes=int(environ.get("ACCESS_TOKEN_EXPIRE_MINUTES")))

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

password_hasher = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# TODO: divide get_current_user login and token validation

def hash_password(plain_password: str) -> str:
    return password_hasher.hash(plain_password)


def verify_password(plain_password, hashed_password):
    return password_hasher.verify(plain_password, hashed_password)


def create_user(user: schemas.UserCreate,
                db: Session):
    return crud.create_user(schemas.UserCreate(
        username=user.username,
        password=hash_password(user.password)),
        db
    )


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + EXPIRES_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise CREDENTIALS_EXCEPTION
    except JWTError as jwt_error:
        raise CREDENTIALS_EXCEPTION
    user_base = crud.get_user_by_username(username, db)
    if user_base is None:
        raise CREDENTIALS_EXCEPTION
    user = crud.get_user(user_base.id, db)
    return schemas.CurrentUser(
        id=user.id,
        username=user.username,
        department_id=user.department_id,
        department_abbreviation=user.department_abbreviation,
        department_name=user.department_name,
        role_id=user.role_id,
        role_name=user.role_name,
        actions=[ActionType(action[0]) for action in crud.get_role_actions(user.role_id, db)]
    )


def change_user_password(user_id: int, user_change_password: schemas.UserChangePassword):
    user = get_current_user()
    if not verify_password(user_change_password.password, user.password):
        raise CREDENTIALS_EXCEPTION
    return crud.update_user_password(user_id, user_change_password)
