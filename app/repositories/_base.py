from typing import Type, TypeVar

from sqlalchemy.orm import Session

EntityModel = TypeVar("T")


class BaseRepository:
    def __init__(
        self, db_session: Session, model: Type[EntityModel], entity_name: str
    ):
        """
        Initialize repository with the session, model and entity name.
        """
        self._db_session = db_session
        self._model = model
        self._entity_name = entity_name
