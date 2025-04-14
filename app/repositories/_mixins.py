from typing import List, Optional

from ._base import EntityModel, IdType


class FindByNameMixin:
    def find_by_name(self, name: str) -> Optional[EntityModel]:
        """
        Find a model by its name.
        """
        return (
            self._db_session.query(self._model)
            .filter(self._model.name == name)
            .first()
        )


class GetByIdMixin:
    def get_by_id(self, entity_id: int) -> EntityModel:
        """
        Get a model by its ID.
        """
        entity = (
            self._db_session.query(self._model)
            .filter(self._model.id == entity_id)
            .first()
        )
        if not entity:
            raise ValueError(
                f"{self._entity_name} with ID '{entity_id}' not found"
            )
        return entity


class PaginationMixin:
    def paginate(self, page: int, page_size: int) -> List[EntityModel]:
        """
        List models with pagination.
        """
        return (
            self._db_session.query(self._model)
            .sort(self._model.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )


class EnforceNameUniquenessMixin:
    def enforce_name_uniqueness(
        self, name: str, entity_id: IdType | None = None
    ) -> None:
        """
        Check if the role name is unique.
        """
        query = self._db_session.query(self._model).filter(
            self._model.name == name
        )
        if entity_id:
            query = query.filter(self._model.id != entity_id)
        if query.first() is not None:
            # TODO: Use a custom exception
            raise ValueError(
                f"{self._entity_name} with the name '{name}' already exists"
            )


class SaveMixin:
    def save(self, entity: EntityModel) -> EntityModel:
        """
        Save a model to the database.
        """
        self._db_session.add(entity)
        self._db_session.commit()
        self._db_session.refresh(entity)
        return entity


class DeleteMixin:
    def delete(self, entity: EntityModel) -> EntityModel:
        """
        Delete a model from the database.
        """
        self._db_session.delete(entity)
        self._db_session.commit()
        return entity
