from enum import Enum
from typing import List, Optional, Tuple, Type, TypeVar, Union

import yaml
from exceptions import (
    InvalidPageNumberException,
    InvalidPageSizeException,
    ObjectNotFoundException,
)
from sqlalchemy import desc
from sqlalchemy.orm import Query, Session

from .base_engine import Base

T = TypeVar("T", bound=Base)
IdType = Union[str, int, Tuple[int, int]]


class BaseOperationsModel(Base):
    __abstract__ = True

    @classmethod
    def find(cls: Type[T], session: Session, item_id: IdType) -> Optional[T]:
        return session.query(cls).filter_by(id=item_id).first()

    @classmethod
    def get(cls: Type[T], session: Session, item_id: IdType) -> T:
        item = cls.find(session, item_id)
        if not item:
            raise ObjectNotFoundException(cls.__name__, item_id)
        return item

    @classmethod
    def query_base(cls: Type[T], session: Session) -> Query:
        return session.query(cls).order_by(desc(cls.id))

    @classmethod
    def get_page(
        cls: Type[T], session: Session, page=1, page_size=50
    ) -> Tuple[List[T], int]:
        if page < 1:
            raise InvalidPageNumberException()
        if page_size < 1:
            raise InvalidPageSizeException()

        offset = (page - 1) * page_size
        return (
            cls.query_base(session).offset(offset).limit(page_size).all(),
            cls.query_base(session).count(),
        )

    @classmethod
    def all(cls: Type[T], session: Session) -> List[T]:
        return cls.query_base(session).all()

    def is_persisted(self: T, session: Session) -> bool:
        return self.id is not None

    def save(self: T, session: Session) -> T:
        if hasattr(self, "validate_before_save") and callable(
            getattr(self, "validate_before_save")
        ):
            self.validate_before_save(session)

        if not self.is_persisted(session):
            session.add(self)
        session.commit()
        session.refresh(self)
        return self

    def merge(self: T, session: Session) -> T:
        merged_instance = session.merge(self)
        session.commit()
        session.refresh(merged_instance)
        return merged_instance

    def delete(self: T, session: Session) -> T:
        if hasattr(self, "validate_before_delete") and callable(
            getattr(self, "validate_before_delete")
        ):
            self.validate_before_delete(session)

        session.delete(self)
        session.commit()
        return self


class BaseModel(Base, ModelOperationsMixin, ModelParsingMixin):
    __abstract__ = True
    pass
