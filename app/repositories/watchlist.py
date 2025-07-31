from datetime import datetime
from typing import List

from adapters.database import DatabaseSession
from adapters.indexer import IndexerQuery
from repositories.models.watchlist import (
    WatchlistModel,
    WatchlistSubscriptionModel,
)
from schemas.common import UserAssignment, UserAssignmentChange
from schemas.watchlist import (
    WatchlistCreate,
    WatchlistNotificationSettings,
    WatchlistParams,
)

from ._db_repository import (
    DbRepository,
    DeleteMixin,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
    SaveMixin,
)


class WatchlistRepository(
    DbRepository,
    DeleteMixin[WatchlistModel],
    EnforceNameUniquenessMixin[WatchlistModel, int],
    GetByIdMixin[WatchlistModel, int],
    PaginationMixin[WatchlistModel],
    SaveMixin[WatchlistModel],
):
    def __init__(self, database_session: DatabaseSession):
        super().__init__("Watchlist", database_session, WatchlistModel)

    def create(self, watchlist: WatchlistCreate) -> WatchlistModel:
        self.enforce_name_uniqueness(watchlist.name)
        return self.save(
            WatchlistModel(
                name=watchlist.name,
                mode=watchlist.mode,
                target=watchlist.target,
                query=watchlist.query,
            )
        )

    def update_properties(
        self, watchlist: WatchlistModel, properties: WatchlistParams
    ) -> WatchlistModel:
        watchlist.name = properties.name
        watchlist.mode = properties.mode
        return self.save(watchlist)

    def update_query(
        self, watchlist: WatchlistModel, query: IndexerQuery
    ) -> WatchlistModel:
        watchlist.query = query
        return self.save(watchlist)

    def update_assignment(
        self,
        watchlist: WatchlistModel,
        assignment_change: UserAssignmentChange,
    ) -> WatchlistModel:
        user_ids = {sub.user_id for sub in watchlist.subscriptions}

        if assignment_change.add:
            user_ids |= set(assignment_change.add.user_ids)
        if assignment_change.remove:
            user_ids -= set(assignment_change.remove.user_ids)

        watchlist.subscriptions = [
            WatchlistSubscriptionModel(
                watchlist_id=watchlist.id,
                user_id=user_id,
            )
            for user_id in user_ids
        ]

        return self.save(watchlist)

    def _find_subscription(
        self,
        watchlist_id: int,
        user_id: str,
    ) -> WatchlistSubscriptionModel | None:
        return (
            self._database_session.query(self._database_entity)
            .filter(
                WatchlistSubscriptionModel.watchlist_id == watchlist_id,
                WatchlistSubscriptionModel.user_id == user_id,
            )
            .first()
        )

    def subscribe(
        self,
        watchlist: WatchlistModel,
        user_id: str,
    ) -> WatchlistModel:
        if self._find_subscription(watchlist.id, user_id) is not None:
            raise ValueError(
                f"User {user_id} is already subscribed "
                f"to watchlist {watchlist.id}"
            )
        self.save(
            WatchlistSubscriptionModel(
                watchlist_id=watchlist.id, user_id=user_id
            )
        )

        self._database_session.refresh(watchlist)
        return watchlist

    def unsubscribe(
        self,
        watchlist: WatchlistModel,
        user_id: str,
    ) -> WatchlistSubscriptionModel:
        subscription = self._find_subscription(watchlist.id, user_id)
        if subscription is None:
            raise ValueError(
                f"User {user_id} is not subscribed to watchlist {watchlist.id}"
            )
        self._database_session.delete(subscription)
        self._database_session.commit()

        self._database_session.refresh(watchlist)
        return watchlist

    def update_notification_settings(
        self,
        watchlist: WatchlistModel,
        settings: WatchlistNotificationSettings,
        assignment: UserAssignment,
    ) -> WatchlistModel:
        self._database_session.query(self._database_entity).filter(
            WatchlistSubscriptionModel.watchlist_id == watchlist.id,
            WatchlistSubscriptionModel.user_id.in_(assignment.user_ids),
        ).update(
            {
                WatchlistSubscriptionModel.cron_expression: (
                    settings.cron_expression
                ),
                WatchlistSubscriptionModel.include_report: (
                    settings.include_report
                ),
                WatchlistSubscriptionModel.return_fields: (
                    settings.return_fields
                ),
            }
        )
        self._database_session.commit()

        self._database_session.refresh(watchlist)
        return watchlist

    # def get_notifications(
    #     self, user_id: str
    # ) -> List[WatchlistNotificationModel]:
    #     return (
    #         self._database_session.query(self._database_entity)
    #         .filter(WatchlistNotificationModel.user_id == user_id)
    #         .all()
    #     )

    # def mark_notification_read(
    #     self, notification: WatchlistNotificationModel
    # ) -> None:
    #     notification.last_read_at = notification.last_sent_at = datetime.now()
    #     self._database_session.commit()
