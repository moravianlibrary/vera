from datetime import datetime
from typing import List

from adapters.indexer import IndexerQuery
from definitions.watchlist import WatchlistTarget
from repositories.models.watchlist import (
    WatchlistModel,
    WatchlistSubscriptionModel,
)
from schemas.watchlist import (
    WatchlistNotificationSettings,
    WatchlistProperties,
    WatchlistPropertiesParams,
)

from ._db_repository import (
    DbRepository,
    EnforceNameUniquenessMixin,
    GetByIdMixin,
    PaginationMixin,
)


class WatchlistRepository(
    DbRepository[WatchlistModel],
    GetByIdMixin[WatchlistModel, int],
    PaginationMixin[WatchlistModel],
    EnforceNameUniquenessMixin[WatchlistModel, int],
):
    _entity_name = "Watchlist"
    _db_model = WatchlistModel

    def create(
        self,
        params: WatchlistPropertiesParams,
        target: WatchlistTarget,
        query: IndexerQuery,
    ) -> WatchlistModel:
        self.enforce_name_uniqueness(params.name)
        # TODO: enforce short name uniqueness
        return self.save(
            WatchlistModel(
                name=params.name,
                short_name=params.short_name,
                target=target,
                query=query,
            )
        )

    def update_properties(
        self, watchlist: WatchlistModel, properties: WatchlistProperties
    ) -> WatchlistModel:
        watchlist.name = properties.name
        watchlist.short_name = properties.short_name
        return self.save(watchlist)

    def _find_subscription(
        self,
        watchlist_id: int,
        user_id: str,
    ) -> WatchlistSubscriptionModel | None:
        return (
            self._database_session.query(self._db_model)
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
    ) -> WatchlistModel:
        pass
        # self._database_session.query(self._db_model).filter(
        #     WatchlistSubscriptionModel.watchlist_id == watchlist.id,
        #     WatchlistSubscriptionModel.user_id.in_(assignment.user_ids),
        # ).update(
        #     {
        #         WatchlistSubscriptionModel.cron_expression: (
        #             settings.cron_expression
        #         ),
        #         WatchlistSubscriptionModel.include_report: (
        #             settings.include_report
        #         ),
        #         WatchlistSubscriptionModel.return_fields: (
        #             settings.return_fields
        #         ),
        #     }
        # )
        # self._database_session.commit()

        # self._database_session.refresh(watchlist)
        # return watchlist

    # def get_notifications(
    #     self, user_id: str
    # ) -> List[WatchlistNotificationModel]:
    #     return (
    #         self._database_session.query(self._db_model)
    #         .filter(WatchlistNotificationModel.user_id == user_id)
    #         .all()
    #     )

    # def mark_notification_read(
    #     self, notification: WatchlistNotificationModel
    # ) -> None:
    #     notification.last_read_at = notification.last_sent_at = datetime.now()
    #     self._database_session.commit()
