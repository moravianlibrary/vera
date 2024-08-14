from typing import List, Tuple, Optional, TypeVar, Type, Union
from sqlalchemy.orm import Session, Query
from sqlalchemy.ext.declarative import declarative_base
from services.exceptions import ObjectNotFoundException

Base = declarative_base()

T = TypeVar("T", bound=Base)
IdType = Union[str, int, Tuple[int, int]]


class BaseMixin:
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
        return session.query(cls)

    @classmethod
    def get_page(
        cls: Type[T], session: Session, page=1, page_size=50
    ) -> Tuple[List[T], int]:
        offset = (page - 1) * page_size
        return (
            cls.query_base(session).offset(offset).limit(page_size).all(),
            cls.query_base(session).count(),
        )

    @classmethod
    def all(cls: Type[T], session: Session) -> List[T]:
        return cls.query_base(session).all()

    def save(self: T, session: Session) -> T:
        if hasattr(self, "validate_before_save") and callable(
            getattr(self, "validate_before_save")
        ):
            self.validate_before_save(session)

        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)
        return self

    def delete(self: T, session: Session) -> T:
        if hasattr(self, "validate_before_delete") and callable(
            getattr(self, "validate_before_delete")
        ):
            self.validate_before_delete(session)

        session.delete(self)
        session.commit()
        return self
