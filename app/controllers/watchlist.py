from typing import Annotated

from fastapi import APIRouter, Path, Query

from adapters.indexer import IndexerQuery
from definitions.permission import GeneralPermission, OwnershipPermission
from definitions.watchlist import TARGET_PERMISSIONS
from repositories.watchlist import WatchlistRepository
from schemas.common import Assignment, AssignmentChange, Page, PageParams
from schemas.user import AuthenticatedUser
from schemas.watchlist import (
    SubscribedWatchlist,
    SubscribedWatchlistFilterParams,
    Watchlist,
    WatchlistCreate,
    WatchlistFilterParams,
    WatchlistNotificationSettings,
    WatchlistParams,
)

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnWatchlistRepository,
    RestrictedFilterParams,
    WithEnforcedOwnership,
    WithPermission,
)

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get(
    "",
    dependencies=[WithPermission(OwnershipPermission.ReadWatchlists)],
    response_model=Page[Watchlist],
)
def paginate(
    page_params: Annotated[PageParams, Query()],
    filter_params: WatchlistFilterParams | None = RestrictedFilterParams(
        OwnershipPermission.ReadWatchlists, WatchlistFilterParams
    ),
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate(page_params, filter_params)


@router.post(
    "",
    dependencies=[WithPermission(OwnershipPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def create(
    watchlist: WatchlistCreate,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    WithPermission(TARGET_PERMISSIONS[watchlist.target])
    return repository.create(watchlist)


@router.patch(
    "/{watchlist_id}/subscribe",
    dependencies=[WithPermission(OwnershipPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def subscribe(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.subscribe(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ReadWatchlists,
            user,
        ),
        user.id,
    )


@router.get(
    "/subscribed",
    dependencies=[WithPermission(OwnershipPermission.ReadWatchlists)],
    response_model=Page[SubscribedWatchlist],
)
def paginate_subscribed(
    page_params: Annotated[PageParams, Query()],
    filter_params: Annotated[SubscribedWatchlistFilterParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate(
        page_params,
        WatchlistFilterParams.from_subscribed_filter(filter_params, user.id),
    )


@router.patch(
    "/subscribed/{watchlist_id}/unsubscribe",
    dependencies=[WithPermission(OwnershipPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def unsubscribe(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.unsubscribe(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ReadWatchlists,
            user,
        ),
        user.id,
    )


@router.patch(
    "/subscribed/{watchlist_id}/notifications",
    dependencies=[WithPermission(OwnershipPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def update_own_notifications(
    watchlist_id: Annotated[int, Path(...)],
    settings: Annotated[WatchlistNotificationSettings | None, Query(None)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update_notifications(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ReadWatchlists,
            user,
        ),
        settings,
        Assignment(user_ids=[user.id]),
    )


@router.put(
    "/{watchlist_id}/notifications",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageWatchlists,
            GeneralPermission.ReadUsersAndGroups,
        )
    ],
    response_model=Watchlist,
)
def update_notifications_for_assignees(
    assignment: Assignment,
    watchlist_id: Annotated[int, Path(...)],
    settings: Annotated[WatchlistNotificationSettings | None, Query(None)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update_email_notifications(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ManageWatchlists,
            user,
        ),
        settings,
        assignment,
    )


@router.patch(
    "/{watchlist_id}/properties",
    dependencies=[WithPermission(OwnershipPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def update_properties(
    watchlist_id: Annotated[int, Path(...)],
    params: Annotated[WatchlistParams, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update_properties(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ManageWatchlists,
            user,
        ),
        params,
    )


@router.patch(
    "/{watchlist_id}/query",
    dependencies=[WithPermission(OwnershipPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def update_query(
    query: IndexerQuery,
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    watchlist = WithEnforcedOwnership(
        repository.get_by_id(watchlist_id),
        OwnershipPermission.ManageWatchlists,
        user,
    )
    WithPermission(TARGET_PERMISSIONS[watchlist.target])
    return repository.update_query(watchlist, query)


@router.patch(
    "/{watchlist_id}/assignment",
    dependencies=[
        WithPermission(
            OwnershipPermission.ManageWatchlists,
            GeneralPermission.ReadUsersAndGroups,
        )
    ],
    response_model=Watchlist,
)
def update_assignment(
    change: AssignmentChange,
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update_assignment(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ManageWatchlists,
            user,
        ),
        change,
    )


@router.delete(
    "/{watchlist_id}",
    dependencies=[WithPermission(OwnershipPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def delete(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.delete(
        WithEnforcedOwnership(
            repository.get_by_id(watchlist_id),
            OwnershipPermission.ManageWatchlists,
            user,
        )
    )
