from typing import Annotated

from fastapi import APIRouter, Path, Query

from controllers._resources import DependsOnWatchlistRepository
from definitions.permission import GeneralPermission
from repositories.notification_list import WatchlistRepository
from schemas.notifications_list import Watchlist, WatchlistParams
from schemas.pagination import Page

from ._security import WithPermission

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


# TODO: make page params and use them in all endpoints
@router.get(
    "",
    dependencies=[WithPermission(GeneralPermission.ReadWatchlists)],
    response_model=Page[Watchlist],
)
def paginate(
    page: int = Query(1, description="Page number"),
    page_size: int = Query(50, description="Page size"),
    filter_by_user_id: str | None = Query(None),
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.paginate(page, page_size, filter_by_user_id)


@router.put(
    "/{watchlist_id}",
    dependencies=[WithPermission(GeneralPermission.ManageWatchlists)],
    response_model=Watchlist,
)
def update(
    watchlist_id: Annotated[int, Path(...)],
    list_params: Annotated[WatchlistParams, Query()],
    repository: WatchlistRepository = DependsOnWatchlistRepository,
):
    return repository.update(repository.get_by_id(watchlist_id), list_params)


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
