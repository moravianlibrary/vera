from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from base64 import b64decode
from datetime import datetime, timedelta
from os import environ

from database import get_db
from crud import get_user_by_username


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


def verify_password(plain_password, hashed_password):
    return password_hasher.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + EXPIRES_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# TODO: rework to has_access
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise CREDENTIALS_EXCEPTION
    except JWTError as jwt_error:
        raise CREDENTIALS_EXCEPTION
    user = get_user_by_username(db, username)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user
