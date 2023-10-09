from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Set

import auth, crud, schemas
from database import get_db
from auth import Role


FORBIDDEN_EXCEPTION = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="User is not allowed to perform action",
    headers={"WWW-Authenticate": "Bearer"},
)


def is_allowed(db: Session, token: str, allowed_roles: Set[Role]):
    if not (auth.get_current_user_roles(db, token) & allowed_roles):
        raise FORBIDDEN_EXCEPTION


def is_allowed_for_record(db: Session, token: str, record: schemas.Record, allowed_roles: Set[Role]):
    owner_id = crud.get_record_owner(record.id)
    current_user = authget_current_user(db, token)

    if owner_id != current_user.id or not is_allowed(db, token, allowed_roles):
        raise FORBIDDEN_EXCEPTION


def can_edit_users(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed(db, token, {Role.admin})


def can_edit_user(user: schemas.User, db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    if auth.get_current_user(db, token).username == user.username:
        return
    is_allowed(db, token, {Role.admin})


def is_user(user: schemas.User, db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    if auth.get_current_user(db, token).username != user.username:
        raise FORBIDDEN_EXCEPTION


def can_browse_records(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed(db, token, {Role.admin, Role.insertor, Role.commentator, Role.editor})


def can_create_records(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed(db, token, {Role.admin, Role.insertor})


def can_edit_record(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed_for_record(db, token, record, {Role.admin, Role.editor})


def can_comment_on_record(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed_for_record(db, token, record, {Role.admin, Role.commentator})


def can_extract_records(db: Session = Depends(get_db), token: str = Depends(auth.oauth2_scheme)):
    is_allowed(db, token, {Role.admin, Role.extractor})
