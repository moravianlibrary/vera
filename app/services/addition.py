from pymarc import List

from adapters.indexer import IndexerQuery
from definitions.addition import AdditionUpdateType
from repositories import AdditionRepository
from schemas.addition import (
    AdditionCreate,
    ArchiveAdditionResponse,
    DeleteAdditionResponse,
    EnqueueAdditionResponse,
    UpdateAdditionResponse,
)
from services import TaskService


class AdditionService:
    def __init__(
        self,
        addition_repository: AdditionRepository,
        task_service: TaskService,
    ):
        self._addition_repository = addition_repository
        self._task_service = task_service

    def create(
        self, additions: List[AdditionCreate], created_by: str
    ) -> EnqueueAdditionResponse:
        enqueued = []

        for addition in additions:
            enqueued.append(
                self._addition_repository.create(
                    addition, created_by=created_by
                )
            )

        if enqueued:
            self._task_service.Additions.process(enqueued)

        return EnqueueAdditionResponse(enqueued=len(enqueued))

    def update(
        self, query: IndexerQuery, update_type: AdditionUpdateType
    ) -> UpdateAdditionResponse:
        updated = []

        for addition in self._addition_repository.search(query).hits:
            if (
                update_type == AdditionUpdateType.IgnoreDigitizationCheck
                and addition.ignore_digitization_check is False
            ):
                addition.ignore_digitization_check = True
                updated.append(self._addition_repository.save(addition))
            elif (
                update_type == AdditionUpdateType.AllowNewIteration
                and addition.allow_new_iteration is False
            ):
                addition.allow_new_iteration = True
                updated.append(self._addition_repository.save(addition))

        if updated:
            self._task_service.Additions.process(updated)

        return UpdateAdditionResponse(updated=len(updated))

    def archive(self, query: IndexerQuery) -> ArchiveAdditionResponse:
        archived = []

        for addition in self._addition_repository.search(query):
            if not addition.is_archived:
                addition.is_archived = True
                archived.append(self._addition_repository.save(addition))

        if archived > 0:
            self._task_service.Additions.reindex(archived)

        return ArchiveAdditionResponse(archived=archived)

    def delete(self, query: IndexerQuery) -> DeleteAdditionResponse:
        deleted = []
        ignored = 0

        for addition in self._addition_repository.search(query):
            if addition.is_archived:
                deleted.append(self._addition_repository.delete(addition))
            else:
                ignored += 1

        if deleted:
            self._task_service.Additions.reindex(deleted)

        return DeleteAdditionResponse(deleted=len(deleted), ignored=ignored)
