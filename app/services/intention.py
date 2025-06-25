from repositories.intention import IntentionRepository
from repositories.models.intention import IntentionModel
from schemas.intention import Intention, IntentionEdit


class IntentionService:
    def __init__(
        self,
        intention_repository: IntentionRepository,
    ):
        self._intention_repository = intention_repository

    def update(
        self, intention_model: IntentionModel, intention_edit: IntentionEdit
    ) -> Intention:
        # TODO: Check if the intention is empty if changing start date
        #       Also if changing end date it has to be after start date
        #       and after the current date + some buffer - buffer can be
        #       a setting in the admin config
        pass

    def delete(self, intention_model: IntentionModel) -> Intention:
        # TODO: Check if the intention is empty
        #       If it is not empty, raise an error
        pass
