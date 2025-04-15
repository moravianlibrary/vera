from sqlalchemy.orm import Session

from adapters.elasticsearch import EsSession
from schemas import CategoryEdit


class CategoryService:
    def __init__(self, db_session: Session, es_session: EsSession):
        pass

    def create(parent_id: int | None, category: CategoryEdit):
        pass
