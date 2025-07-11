from datetime import datetime

from esorm.query import ESBool, ESRange, FieldRange

from adapters.indexer import IndexerQuery
from definitions.watchlist import WatchlistTarget
from repositories.addition import AdditionRepository
from repositories.catalog_record import CatalogRecordRepository
from repositories.category import CategoryRepository
from repositories.document import DocumentRepository
from repositories.models.user import UserModel
from repositories.project import ProjectRepository
from repositories.proposal import ProposalRepository
from repositories.watchlist import WatchlistRepository
from schemas.user import UserNotifications
from schemas.watchlist import WatchlistNotification


class UserService:
    def __init__(
        self,
        addition_repository: AdditionRepository,
        catalog_record_repository: CatalogRecordRepository,
        category_repository: CategoryRepository,
        document_repository: DocumentRepository,
        project_repository: ProjectRepository,
        proposal_repository: ProposalRepository,
        watchlist_repository: WatchlistRepository,
    ):
        self._addition_repository = addition_repository
        self._catalog_record_repository = catalog_record_repository
        self._category_repository = category_repository
        self._document_repository = document_repository
        self._project_repository = project_repository
        self._proposal_repository = proposal_repository
        self._watchlist_repository = watchlist_repository

    def _get_target_repository(self, target: WatchlistTarget):
        return {
            WatchlistTarget.Additions: self._addition_repository,
            WatchlistTarget.CatalogRecords: self._catalog_record_repository,
            WatchlistTarget.Categories: self._category_repository,
            WatchlistTarget.Documents: self._document_repository,
            WatchlistTarget.Projects: self._project_repository,
            WatchlistTarget.Proposals: self._proposal_repository,
        }[target]

    def _get_count_changes(
        self,
        last_read_at: datetime,
        target: WatchlistTarget,
        query: IndexerQuery,
    ) -> int:
        restricted_query = query.copy()
        created_at_filter = FieldRange(
            "created_at", ESRange(gte=last_read_at.isoformat())
        )

        if restricted_query.bool and restricted_query.bool.filter:
            restricted_query.bool.filter.append(created_at_filter)
        elif restricted_query.bool and not restricted_query.bool.filter:
            restricted_query.bool.filter = [created_at_filter]
        else:
            restricted_query.bool = ESBool(filter=[created_at_filter])

        return self._get_target_repository(target).count(restricted_query)

    def read_notifications(self, user: UserModel) -> UserNotifications:
        notifications = UserNotifications(watchlist=[])

        for notification in self._watchlist_repository.get_notifications(
            user.id
        ):
            notifications.watchlist.append(
                WatchlistNotification.from_orm_with_count(
                    notification,
                    self._get_count_changes(
                        notification.last_read_at,
                        notification.watchlist.target,
                        notification.watchlist.query,
                    ),
                )
            )
            self._watchlist_repository.mark_notification_read(notification)

        return notifications
