from typing import Annotated

from fastapi import APIRouter, Body, Path, Query

from definitions.permission import GeneralPermission
from repositories.watchlist import WatchlistRepository
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import Page
from schemas.task import Task
from schemas.watchlist import (
    SubscribedWatchlist,
    Watchlist,
    WatchlistNotificationSettings,
    WatchlistPaginateParams,
    WatchlistProperties,
)
from services.watchlist import WatchlistService

from .resources import (
    DependsOnAuthenticatedUser,
    DependsOnWatchlistRepository,
    DependsOnWatchlistService,
    WithPermission,
)

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=Page[Watchlist],
)
def paginate(
    params: Annotated[WatchlistPaginateParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate(params.page_params, params.filter_params)


@router.patch(
    "/{watchlist_id}/properties",
    dependencies=[WithPermission(GeneralPermission.ManageWatchlists)],
    response_model=Watchlist,
)
async def update_properties(
    watchlist_id: Annotated[int, Path(...)],
    properties: Annotated[WatchlistProperties, Body(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: WatchlistService = DependsOnWatchlistService,
):
    return await service.update_properties(watchlist_id, properties, user.id)


@router.delete(
    "/{watchlist_id}",
    dependencies=[WithPermission(GeneralPermission.ManageWatchlists)],
    response_model=Task,
)
async def delete(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: WatchlistService = DependsOnWatchlistService,
):
    return await service.delete(watchlist_id, user.id)


@router.get(
    "/subscriptions",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=Page[SubscribedWatchlist],
)
def paginate_subscriptions(
    params: Annotated[WatchlistPaginateParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate_subscriptions(
        params.page_params, params.filter_params
    )


@router.patch(
    "/{watchlist_id}/subscribe",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def subscribe(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: WatchlistService = DependsOnWatchlistService,
):
    return service.subscribe(watchlist_id, user.id)


@router.patch(
    "/{watchlist_id}/unsubscribe",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def unsubscribe(
    watchlist_id: Annotated[int, Path(...)],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: WatchlistService = DependsOnWatchlistService,
):
    return service.unsubscribe(watchlist_id, user.id)


@router.patch(
    "/{watchlist_id}/notifications",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=SubscribedWatchlist,
)
def update_notifications(
    watchlist_id: Annotated[int, Path(...)],
    settings: Annotated[WatchlistNotificationSettings, Query()],
    user: AuthenticatedUser = DependsOnAuthenticatedUser,
    service: WatchlistService = DependsOnWatchlistService,
):
    return service.update_notifications(watchlist_id, settings, user.id)
