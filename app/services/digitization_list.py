from typing import List, Optional

from adapters.indexer import IndexerQuery
from definitions.digitization_registry import DigitizationState
from repositories import DigiListRepository, IntentionRepository
from repositories.document_iteration import DocumentIterationRepository
from repositories.models.digitization_list import DigitizationListModel
from schemas.digitization_list import (
    AddDocumentsResponse,
    CreateDigitizationListResponse,
    RemoveDocumentsResponse,
)


class DigiListService:
    def __init__(
        self,
        digi_list_repository: DigiListRepository,
        document_iteration_repository: DocumentIterationRepository,
        intention_repository: IntentionRepository,
    ):
        self._digi_list_repository = digi_list_repository
        self._document_iteration_repository = document_iteration_repository
        self._intention_repository = intention_repository

    def create(
        self,
        query: IndexerQuery,
        intention_ids: List[int],
        ignored_states: List[DigitizationState],
        user_id: str,
    ):
        digi_list_model: Optional[DigitizationListModel] = None
        ignored_states_set = set(ignored_states) | {
            DigitizationState.NotDigitized
        }

        already_in_list = 0
        ignored_by_state = 0
        added = 0

        for di in self._document_iteration_repository.get_by_query(query):
            if di.digitization_list_id is not None:
                already_in_list += 1
                continue

            if di.document.digitization_state not in ignored_states_set:
                ignored_by_state += 1
                continue

            if digi_list_model is None:
                digi_list_model = self._digi_list_repository.create(
                    user_id,
                    self._intention_repository.get_by_ids(intention_ids),
                )

            di.digitization_list_id = digi_list_model.id
            self._document_iteration_repository.save_and_index(di)
            added += 1

        if added > 0:
            self._digi_list_repository.save_and_index(digi_list_model)

        return CreateDigitizationListResponse(
            digitization_list=digi_list_model,
            ignored_by_state=ignored_by_state,
            already_in_list=already_in_list,
            added=added,
        )

    def change_intentions(
        self,
        digitization_list_id: int,
        intention_ids: List[int],
    ) -> DigitizationListModel:
        return self._digi_list_repository.change_intentions(
            self._digi_list_repository.get_by_id(digitization_list_id),
            self._intention_repository.get_by_ids(intention_ids),
        )

    def add_documents(
        self,
        query: IndexerQuery,
        digitization_list_id: int,
        ignored_states: List[DigitizationState],
    ) -> AddDocumentsResponse:
        digi_list_model = self._digi_list_repository.get_by_id(
            digitization_list_id
        )

        ignored_states_set = set(ignored_states) | {
            DigitizationState.NotDigitized
        }

        already_in_this_list = 0
        already_in_other_list = 0
        ignored_by_state = 0
        added = 0

        for di in self._document_iteration_repository.get_by_query(query):
            if di.digitization_list_id == digitization_list_id:
                already_in_this_list += 1
                continue

            if di.digitization_list_id is not None:
                already_in_other_list += 1
                continue

            if di.document.digitization_state not in ignored_states_set:
                ignored_by_state += 1
                continue

            di.digitization_list_id = digitization_list_id
            self._document_iteration_repository.save_and_index(di)
            added += 1

        if added > 0:
            self._digi_list_repository.save_and_index(digi_list_model)

        return AddDocumentsResponse(
            digitization_list=digi_list_model,
            already_in_this_list=already_in_this_list,
            already_in_other_list=already_in_other_list,
            ignored_by_state=ignored_by_state,
            added=added,
        )

    def remove_documents(
        self, query: IndexerQuery, digitization_list_id: int
    ) -> RemoveDocumentsResponse:
        digi_list_model = self._digi_list_repository.get_by_id(
            digitization_list_id
        )

        not_in_any_list = 0
        not_in_this_list = 0
        removed = 0

        for di in self._document_iteration_repository.get_by_query(query):
            if di.digitization_list_id is None:
                not_in_any_list += 1
                continue

            if di.digitization_list_id != digitization_list_id:
                not_in_this_list += 1
                continue

            self._document_iteration_repository.update_digitization_list(
                di, None
            )
            removed += 1

        if removed > 0:
            self._digi_list_repository.save_and_index(digi_list_model)

        return RemoveDocumentsResponse(
            digitization_list=digi_list_model,
            not_in_any_list=not_in_any_list,
            not_in_this_list=not_in_this_list,
            removed=removed,
        )

    def delete(self, digitization_list_id: int):
        digi_list_model = self._digi_list_repository.get_by_id(
            digitization_list_id
        )

        if any(di.is_archived for di in digi_list_model.document_iterations):
            # TODO: http exception
            raise ValueError(
                "Cannot delete a digitization list with archived documents."
            )

        for di in digi_list_model.document_iterations:
            self._document_iteration_repository.update_digitization_list(
                di, None
            )

        return self._digi_list_repository.delete(digitization_list_id)
