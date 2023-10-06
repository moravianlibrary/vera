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
import crud


SECRET_KEY=environ.get("JWT_SECRET_KEY")
ALGORITHM=environ.get("JWT_ALGORITHM")
EXPIRES_DELTA = timedelta(minutes=int(environ.get("ACCESS_TOKEN_EXPIRE_MINUTES")))

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

FORBIDDEN_EXCEPTION = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="User is not allowed to perform action",
    headers={"WWW-Authenticate": "Bearer"},
)

password_hasher = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password, hashed_password):
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + EXPIRES_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise CREDENTIALS_EXCEPTION
    except JWTError as jwt_error:
        raise CREDENTIALS_EXCEPTION
    user = crud.get_user_by_username(db, username)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user


def get_current_user_roles(token: str, db: Session):
    return set(crud.get_user_roles(db, get_current_user(token, db).id))


def is_current_user_allowed_to(allowed_roles: Set[Role], token:str, db: Session):
    if not get_current_user_roles(token, db).issubset(allowed_roles):
        raise FORBIDDEN_EXCEPTION


def is_current_user_allowed_to(record: schemas.RecordView, allowed_roles: Set[Role], token:str, db: Session):
    owner_id = crud.get_record_owner(record.id)
    current_user = get_current_user(token, db)
    if owner_id == current_user.id:
        return
    if not get_current_user_roles(token, db).issubset(allowed_roles):
        raise FORBIDDEN_EXCEPTION


def can_edit_users(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to({Role.admin}, token, db)


def can_browse_records(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to({Role.admin, Role.insertor, Role.commentator, Role.editor}, token, db)


def can_create_records(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to({Role.admin, Role.insertor}, token, db)


def can_comment_on_record(record: schemas.RecordView, token: str = Depends(oauth3_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to(record, {Role.admin, Role.commentator}, token, db)


def can_edit_record(record: schemas.RecordView, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to(record, {Role.admin, Role.editor}, token, db)


def can_extract_records(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    is_current_user_allowed_to({Role.admin, Role.extractor}, token, db)
