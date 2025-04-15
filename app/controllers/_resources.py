from fastapi import Depends
from sqlalchemy.orm import Session

from adapters.elasticsearch import EsSession, get_es_session
from models.base_engine import get_session
from repositories import (
    CategoryRepository,
    GroupRepository,
    IntentionRepository,
    RoleRepository,
)
from services import CategoryService

DependsOnDbSession = Depends(get_session)
DependsOnEsSession = Depends(get_es_session)


def get_category_repository(
    db_session: Session = Depends(get_session),
    es_session: EsSession = Depends(get_es_session),
) -> CategoryRepository:
    return CategoryRepository(db_session, es_session)


def get_category_service(
    db_session: Session = Depends(get_session),
    es_session: EsSession = Depends(get_es_session),
) -> CategoryService:
    return CategoryService(db_session, es_session)


def get_group_repository(
    db_session: Session = Depends(get_session),
) -> GroupRepository:
    return GroupRepository(db_session)


def get_intention_repository(
    db_session: Session = Depends(get_session),
) -> IntentionRepository:
    return IntentionRepository(db_session)


def get_role_repository(
    db_session: Session = Depends(get_session),
) -> RoleRepository:
    return RoleRepository(db_session)


DependsOnCategoryRepository = Depends(get_category_repository)
DependsOnCategoryService = Depends(get_category_service)
DependsOnGroupRepository = Depends(get_group_repository)
DependsOnIntentionRepository = Depends(get_intention_repository)
DependsOnRoleRepository = Depends(get_role_repository)
