from typing import List

from adapters.indexer import IndexerQuery
from definitions.digitization_registry import DigitizationListState
from definitions.task import DigitizationListTask, TaskScope
from repositories import DigiListRepository, IntentionRepository
from repositories.document_iteration import DocumentIterationRepository
from repositories.models.task import TaskModel
from repositories.task import TaskRepository
from schemas.digitization_list import (
    AddDocumentsToListData,
    AddDocumentsToListParams,
    ChangeStateData,
    ChangeStateRequest,
    CreateDigitizationListParams,
    DeleteDigitizationListData,
    DigitizationList,
    RemoveDocumentsFromListData,
)
from services.task import TaskBasedService

TASK_TYPE_NAMES_MAPPING = {
    DigitizationListTask.Create: "Create digitization list",
    DigitizationListTask.ChangeState: "Change digitization list state",
    DigitizationListTask.AddDocuments: "Add documents to digitization list",
    DigitizationListTask.RemoveDocuments: (
        "Remove documents from digitization list"
    ),
    DigitizationListTask.Delete: "Delete digitization list",
}


class DigiListService(TaskBasedService):
    _task_scope = TaskScope.DigitizationList
    _task_names_mapping = TASK_TYPE_NAMES_MAPPING

    def __init__(
        self,
        digi_list_repository: DigiListRepository,
        document_iteration_repository: DocumentIterationRepository,
        intention_repository: IntentionRepository,
        task_repository: TaskRepository,
    ):
        super().__init__(task_repository)
        self._digi_list_repository = digi_list_repository
        self._document_iteration_repository = document_iteration_repository
        self._intention_repository = intention_repository

    async def create(
        self,
        query: IndexerQuery,
        create_params: CreateDigitizationListParams,
        created_by: str,
    ) -> TaskModel:
        if create_params.state is None:
            # TODO: default from settings
            create_params.state = DigitizationListState.InProgress
        return await self._create_task(
            DigitizationListTask.Create, created_by, query, create_params
        )
        # digi_list_model: Optional[DigitizationListModel] = None
        # ignored_states_set = set(create_params.skip_state_validation_for) | {
        #     DigitizationState.NotDigitized
        # }

        # already_in_list = 0
        # ignored_by_state = 0
        # added = 0

        # async for di in self._document_iteration_repository.get_by_query(
        #     query
        # ):
        #     if di.digitization_list_id is not None:
        #         already_in_list += 1
        #         continue

        #     if di.document.digitization_state not in ignored_states_set:
        #         ignored_by_state += 1
        #         continue

        #     if digi_list_model is None:
        #         digi_list_model = self._digi_list_repository.create(
        #             user_id,
        #             self._intention_repository.get_by_ids(
        #                 create_params.intention_ids
        #             ),
        #         )

        #     di.digitization_list_id = digi_list_model.id
        #     self._document_iteration_repository.save_and_index(di)
        #     added += 1

        # if added > 0:
        #     self._digi_list_repository.save_and_index(digi_list_model)

        # return CreateDigitizationListResponse(
        #     digitization_list=digi_list_model,
        #     ignored_by_state=ignored_by_state,
        #     already_in_list=already_in_list,
        #     added=added,
        # )

    async def change_state(
        self,
        digitization_list_id: int,
        change_request: ChangeStateRequest,
        created_by: str,
    ) -> TaskModel:
        return await self._create_task(
            DigitizationListTask.ChangeState,
            created_by,
            data=ChangeStateData(
                digitization_list_id=digitization_list_id,
                state=change_request.state,
            ),
        )

    async def change_intentions(
        self,
        digitization_list_id: int,
        intention_ids: List[int],
    ) -> DigitizationList:
        return self._digi_list_repository.serialize_entity(
            await self._digi_list_repository.change_intentions(
                self._digi_list_repository.get_by_id(digitization_list_id),
                self._intention_repository.get_by_ids(intention_ids),
            )
        )

    async def add_documents(
        self,
        digitization_list_id: int,
        query: IndexerQuery,
        add_params: AddDocumentsToListParams,
        created_by: str,
    ) -> TaskModel:
        self._digi_list_repository.get_by_id(digitization_list_id)

        return await self._create_task(
            DigitizationListTask.AddDocuments,
            created_by,
            query,
            AddDocumentsToListData(
                digitization_list_id=digitization_list_id,
                skip_state_validation_for=add_params.skip_state_validation_for,
            ),
        )
        # digi_list_model = self._digi_list_repository.get_by_id(
        #     digitization_list_id
        # )

        # ignored_states_set = set(ignored_states) | {
        #     DigitizationState.NotDigitized
        # }

        # already_in_this_list = 0
        # already_in_other_list = 0
        # ignored_by_state = 0
        # added = 0

        # for di in self._document_iteration_repository.get_by_query(query):
        #     if di.digitization_list_id == digitization_list_id:
        #         already_in_this_list += 1
        #         continue

        #     if di.digitization_list_id is not None:
        #         already_in_other_list += 1
        #         continue

        #     if di.document.digitization_state not in ignored_states_set:
        #         ignored_by_state += 1
        #         continue

        #     di.digitization_list_id = digitization_list_id
        #     self._document_iteration_repository.save_and_index(di)
        #     added += 1

        # if added > 0:
        #     self._digi_list_repository.save_and_index(digi_list_model)

        # return AddDocumentsResponse(
        #     digitization_list=digi_list_model,
        #     already_in_this_list=already_in_this_list,
        #     already_in_other_list=already_in_other_list,
        #     ignored_by_state=ignored_by_state,
        #     added=added,
        # )

    async def remove_documents(
        self, digitization_list_id: int, query: IndexerQuery, created_by: str
    ) -> TaskModel:
        self._digi_list_repository.get_by_id(digitization_list_id)

        return await self._create_task(
            DigitizationListTask.RemoveDocuments,
            created_by,
            query,
            RemoveDocumentsFromListData(
                digitization_list_id=digitization_list_id
            ),
        )
        # digi_list_model = self._digi_list_repository.get_by_id(
        #     digitization_list_id
        # )

        # not_in_any_list = 0
        # not_in_this_list = 0
        # removed = 0

        # for di in self._document_iteration_repository.get_by_query(query):
        #     if di.digitization_list_id is None:
        #         not_in_any_list += 1
        #         continue

        #     if di.digitization_list_id != digitization_list_id:
        #         not_in_this_list += 1
        #         continue

        #     self._document_iteration_repository.update_digitization_list(
        #         di, None
        #     )
        #     removed += 1

        # if removed > 0:
        #     self._digi_list_repository.save_and_index(digi_list_model)

        # return RemoveDocumentsResponse(
        #     digitization_list=digi_list_model,
        #     not_in_any_list=not_in_any_list,
        #     not_in_this_list=not_in_this_list,
        #     removed=removed,
        # )

    async def delete(
        self, digitization_list_id: int, created_by: str
    ) -> TaskModel:
        self._digi_list_repository.get_by_id(digitization_list_id)

        return await self._create_task(
            DigitizationListTask.Delete,
            created_by,
            data=DeleteDigitizationListData(
                digitization_list_id=digitization_list_id
            ),
        )
        # digi_list_model = self._digi_list_repository.get_by_id(
        #     digitization_list_id
        # )

        # if any(di.is_archived for di in digi_list_model.document_iterations):
        #     # TODO: http exception
        #     raise ValueError(
        #         "Cannot delete a digitization list with archived documents."
        #     )

        # for di in digi_list_model.document_iterations:
        #     self._document_iteration_repository.update_digitization_list(
        #         di, None
        #     )

        # return self._digi_list_repository.delete(digitization_list_id)
