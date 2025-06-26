from typing import Annotated

from fastapi import APIRouter, Path, Query

from controllers._resources import DependsOnWatchlistRepository
from definitions.permission import GeneralPermission
from repositories.notification_list import WatchlistRepository
from schemas.pagination import Page, PageParams
from schemas.watchlist import (
    FilterWatchlistsParams,
    Watchlist,
    WatchlistParams,
)

from ._security import WithPermission

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=Page[Watchlist],
)
def paginate(
    page_params: Annotated[PageParams, Query()],
    filter_params: Annotated[FilterWatchlistsParams | None, Query(None)],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate(page_params, filter_params)


@router.put(
    "/{watchlist_id}",
    dependencies=[WithPermission(GeneralPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def update(
    watchlist_id: Annotated[int, Path(...)],
    watchlist_params: Annotated[WatchlistParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update(
        repository.get_by_id(watchlist_id), watchlist_params
    )


@router.delete(
    "/{list_id}",
    dependencies=[WithPermission(GeneralPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def delete(
    watchlist_id: Annotated[int, Path(...)],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.delete(watchlist_id)
