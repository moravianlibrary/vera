from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pytz import timezone, UTC
from os import environ

from roles.enums import ActionType
from services import exceptions
from . import crud, schemas


SECRET_KEY = environ.get("JWT_SECRET_KEY")
ALGORITHM = environ.get("JWT_ALGORITHM")
TIMEZONE = environ.get("TIMEZONE")
EXPIRES_DELTA = timedelta(minutes=int(
    environ.get("ACCESS_TOKEN_EXPIRE_MINUTES")))

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
    if TIMEZONE is not None:
        expire = expire.replace(tzinfo=UTC).astimezone(timezone(TIMEZONE))
    return encoded_jwt, expire


def get_current_user(db: Session, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise exceptions.CredentialsException
    except JWTError:
        raise exceptions.CredentialsException
    user_base = crud.get_user_by_username(username, db)
    if user_base is None:
        raise exceptions.CredentialsException
    user = crud.get_user_view(user_base.id, db)
    return schemas.CurrentUser(
        id=user.id,
        username=user.username,
        department_id=user.department_id,
        department_abbreviation=user.department_abbreviation,
        department_name=user.department_name,
        role_id=user.role_id,
        role_name=user.role_name,
        actions=[ActionType(action[0]) for action
                 in crud.get_role_actions(user.role_id, db)]
    )


def change_user_password(user_change_password: schemas.UserChangePassword,
                         db: Session):
    user = crud.get_user(user_change_password.id, db)
    if not verify_password(user_change_password.password, user.password):
        raise exceptions.CredentialsException
    return crud.update_user_password(user.id, user_change_password)
