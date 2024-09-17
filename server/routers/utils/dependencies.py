from fastapi import Depends
from sqlalchemy.orm import Session
from schemas import CurrentUser
from models.base_engine import get_session
from services.documents_indexer import DocumentsIndexer
from services.keycloak_client import get_user_from_token, oauth2_scheme
from .access_emulation import emulated_users
from typing import Generator
from exceptions import IndexIsNotAvailableException


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_session),
) -> CurrentUser:
    user = get_user_from_token(token, db)
    if user.username in emulated_users:
        user.actions = emulated_users[user.username]
    return user


def get_caller_username(
    current_user: CurrentUser = Depends(get_current_user),
) -> str:
    return current_user.username


def get_documents_indexer() -> Generator["DocumentsIndexer", None, None]:
    if not DocumentsIndexer.is_indexer_available():
        raise IndexIsNotAvailableException()
    indexer = DocumentsIndexer.get_instance()
    try:
        yield indexer
    finally:
        indexer.close()


DependsOnCurrentUser = Depends(get_current_user)
DependsOnCallerUsername = Depends(get_caller_username)
DependsOnDbSession = Depends(get_session)
DependsOnDocumentsIndexer = Depends(get_documents_indexer)
