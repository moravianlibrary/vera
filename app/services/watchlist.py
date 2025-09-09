from definitions.task import SystemTask, TaskScope
from repositories.models.task import TaskModel
from repositories.models.watchlist import WatchlistModel
from repositories.watchlist import WatchlistRepository
from schemas.watchlist import (
    WatchlistChangeTaskData,
    WatchlistNotificationSettings,
    WatchlistProperties,
)
from services.task import TaskBasedService


class WatchlistService(TaskBasedService):
    def __init__(
        self,
        watchlist_repository: WatchlistRepository,
    ):
        self._watchlist_repository = watchlist_repository

    async def _create_change_task(
        self, watchlist: WatchlistModel, name: str, created_by: str
    ) -> TaskModel:
        return await self._task_service.create(
            TaskScope.System,
            SystemTask.WatchlistChange,
            name,
            created_by,
            data=WatchlistChangeTaskData(watchlist_id=watchlist.id),
        )

    async def update_properties(
        self,
        watchlist_id: int,
        properties: WatchlistProperties,
        created_by: str,
    ) -> TaskModel:
        watchlist = self._watchlist_repository.update_properties(
            self._watchlist_repository.get_by_id(watchlist_id), properties
        )

        return await self._create_change_task(
            watchlist, "Update Watchlist", created_by
        )

    async def delete(self, watchlist_id: int, created_by: str) -> TaskModel:
        watchlist = self._watchlist_repository.delete(
            self._watchlist_repository.get_by_id(watchlist_id)
        )

        return await self._create_change_task(
            watchlist, "Update Watchlist", created_by
        )

    async def subscribe(self, watchlist_id: int, user_id: str) -> TaskModel:
        pass

    async def unsubscribe(self, watchlist_id: int, user_id: str) -> TaskModel:
        pass

    async def update_notifications(
        watchlist_id: int,
        settings: WatchlistNotificationSettings,
        user_id: str,
    ):
        pass
