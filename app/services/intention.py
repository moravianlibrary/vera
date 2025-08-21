from datetime import timedelta

from errors.intention import (
    DeleteNotAllowedLinkedToProjectError,
    DeleteNotAllowedWithDigitizationListsError,
    EndDateTooCloseToStartDateError,
    StartDateUpdateNotAllowedError,
)
from repositories.intention import IntentionRepository
from repositories.models.intention import IntentionModel
from schemas.intention import IntentionEdit


class IntentionService:
    def __init__(
        self,
        intention_repository: IntentionRepository,
    ):
        self._intention_repository = intention_repository
        self._margin_days = 7

    def _raise_on_dates_too_close(self, intention_edit: IntentionEdit):
        if (
            intention_edit.start_date is not None
            and intention_edit.end_date is not None
            and intention_edit.start_date + timedelta(days=self._margin_days)
            > intention_edit.end_date
        ):
            raise EndDateTooCloseToStartDateError(self._margin_days)

    async def create(self, intention_edit: IntentionEdit) -> IntentionModel:
        self._raise_on_dates_too_close(intention_edit)

        return await self._intention_repository.create(intention_edit)

    async def update(
        self, intention_id: int, intention_edit: IntentionEdit
    ) -> IntentionModel:
        intention = self._intention_repository.get_by_id(intention_id)

        self._raise_on_dates_too_close(intention_edit)

        if (
            intention.start_date != intention_edit.start_date
            and intention.digitization_lists
        ):
            raise StartDateUpdateNotAllowedError()

        return await self._intention_repository.update(
            intention, intention_edit
        )

    async def delete(self, intention_id: int) -> IntentionModel:
        intention = self._intention_repository.get_by_id(intention_id)

        if intention.digitization_lists:
            raise DeleteNotAllowedWithDigitizationListsError()

        if intention.project:
            raise DeleteNotAllowedLinkedToProjectError()

        return await self._intention_repository.delete(intention)
