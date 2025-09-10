from definitions.notification import NotificationType
from errors.user import NotificationOwnershipError
from repositories.task import TaskNotificationRepository
from repositories.user import UserRepository
from repositories.watchlist import WatchlistNotificationRepository
from schemas.common import Count, Page, PageParams, UserIdFilterParams
from schemas.notification import Notification, NotificationsSummary
from schemas.task import TaskNotification
from schemas.watchlist import WatchlistNotification


class UserService:
    def __init__(
        self,
        user_repository: UserRepository,
        task_notif_repository: TaskNotificationRepository,
        watchlist_notif_repository: WatchlistNotificationRepository,
    ):
        self._user_repository = user_repository
        self._task_notif_repository = task_notif_repository
        self._watchlist_notif_repository = watchlist_notif_repository

    def get_notifications_summary(self, user_id: str) -> NotificationsSummary:
        return NotificationsSummary(
            task_count=self._task_notif_repository.get_unread_count(user_id),
            watchlist_count=(
                self._watchlist_notif_repository.get_unread_count(user_id)
            ),
            task_push=[
                TaskNotification.model_validate(
                    task_notification, from_attributes=True
                )
                for task_notification in (
                    self._task_notif_repository.get_unpushed(user_id)
                )
            ],
            watchlist_push=[
                WatchlistNotification.model_validate(
                    watchlist_notification, from_attributes=True
                )
                for watchlist_notification in (
                    self._watchlist_notif_repository.get_unpushed(user_id)
                )
            ],
        )

    def _get_repository_by_type(self, notification_type: NotificationType):
        if notification_type == NotificationType.Task:
            return self._task_notif_repository
        elif notification_type == NotificationType.Watchlist:
            return self._watchlist_notif_repository

    def paginate_notifications(
        self,
        user_id: str,
        notification_type: NotificationType,
        page_params: PageParams,
    ) -> Page[Notification]:
        return self._get_repository_by_type(notification_type).paginate(
            page_params, UserIdFilterParams(user_id=user_id)
        )

    def mark_notification_as_read(
        self,
        user_id: str,
        notification_type: NotificationType,
        notification_id: int,
    ) -> Notification:
        repository = self._get_repository_by_type(notification_type)

        notification = repository.get_by_id(notification_id)

        if notification.user_id != user_id:
            raise NotificationOwnershipError(
                notification_type, notification_id, user_id
            )

        return repository.mark_as_read(notification)

    def mark_all_notifications_as_read(
        self,
        user_id: str,
        notification_type: NotificationType,
    ) -> Count:
        count = self._get_repository_by_type(
            notification_type
        ).mark_all_as_read(user_id)

        return Count(count=count)
