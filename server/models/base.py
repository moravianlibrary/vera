from typing import List, Tuple, Optional, TypeVar, Type, Union
from sqlalchemy.orm import Session, Query
from sqlalchemy.ext.declarative import declarative_base
from services.exceptions import ObjectNotFoundException
from enum import Enum
import yaml

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


class ModelBaseDict:
    def to_dict(self):
        dict_ = {}
        for column in self.__table__.columns:
            name = str(column.name)
            value = getattr(self, name)
            if not value:
                continue
            if isinstance(value, Enum):
                value = str(value.name)
            elif isinstance(value, list):
                value = [
                    str(item.name) if isinstance(item, Enum) else item
                    for item in value
                ]
            dict_[name] = value
        return dict_

    @classmethod
    def from_dict(cls, dict):
        columns = cls.__table__.columns
        for name, value in dict.items():
            if name in columns:
                setattr(cls, name, value)
        return cls(**dict)


class ModelBaseYaml(ModelBaseDict):
    def to_yaml(self):
        return yaml.dump(
            self.to_dict(), default_flow_style=False, sort_keys=False
        )

    @classmethod
    def from_yaml(cls, yaml_string):
        return cls.from_dict(yaml.safe_load(yaml_string))

    @classmethod
    def export_to_yaml(cls, session: Session) -> str:
        # TODO: use ModelBase all
        instances = session.query(cls).all()
        tablename = cls.__tablename__
        return yaml.dump(
            {tablename: [instance.to_dict() for instance in instances]},
            default_flow_style=False,
            sort_keys=False,
        )

    @classmethod
    def import_from_yaml(cls, session: Session, yaml_string: str):
        pass
