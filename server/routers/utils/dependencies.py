from fastapi import Depends
from sqlalchemy.orm import Session
from schemas import CurrentUser
from models.base_engine import get_session
from services.keycloak_client import get_user_from_token, oauth2_scheme
from .access_emulation import emulated_users
from typing import Generator
from exceptions import IndexIsNotAvailableException
from elasticsearch import Elasticsearch
from config import VeraConfig


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


def get_es_session() -> Generator["Elasticsearch", None, None]:
    session = Elasticsearch(
        VeraConfig.Elasticsearch.Url,
        basic_auth=(
            VeraConfig.Elasticsearch.Username,
            VeraConfig.Elasticsearch.Password,
        ),
    )
    try:
        yield session
    finally:
        session.close()


DependsOnCurrentUser = Depends(get_current_user)
DependsOnCallerUsername = Depends(get_caller_username)
DependsOnDbSession = Depends(get_session)
DependsOnEsSession = Depends(get_es_session)
