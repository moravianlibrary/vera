from fastapi import Depends
from sqlalchemy.orm import Session

from models.base_engine import get_session
from repositories import CategoryRepository, GroupRepository, RoleRepository
from services.elasticsearch import get_es_session

DependsOnDbSession = Depends(get_session)
DependsOnEsSession = Depends(get_es_session)


def get_category_repository(
    db_session: Session = Depends(get_session),
    es_session: EsSession = Depends(get_es_session),
) -> CategoryRepository:
    return CategoryRepository(db_session, es_session)


def get_group_repository(
    db_session: Session = Depends(get_session),
) -> GroupRepository:
    return GroupRepository(db_session)


def get_role_repository(
    db_session: Session = Depends(get_session),
) -> RoleRepository:
    return RoleRepository(db_session)


DependsOnCategoryRepository = Depends(get_category_repository)
DependsOnGroupRepository = Depends(get_group_repository)
DependsOnRoleRepository = Depends(get_role_repository)
