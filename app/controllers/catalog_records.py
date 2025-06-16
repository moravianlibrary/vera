from fastapi import APIRouter, Path

from adapters.indexer import IndexerQuery
from controllers._security import WithPermission
from definitions.permission import GeneralPermission

router = APIRouter(prefix="/catalog-records", tags=["Catalog records"])


@router.post(
    "/search",
    dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
    response_model=None,
)
def search_catalog_records(
    query: IndexerQuery,
):
    pass


@router.get(
    "/{record_id}/details",
    dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
    response_model=None,
)
def get_details(
    record_id: str = Path(...),
):
    pass


@router.patch(
    "/set-validity",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=None,
)
def set_validity(
    query: IndexerQuery,
    is_valid: bool = True,
):
    pass


@router.delete(
    "",
    dependencies=[WithPermission(GeneralPermission.ManageCatalogRecords)],
    response_model=None,
)
def delete(
    query: IndexerQuery,
):
    pass


# @router.get(
#     "/notification-lists",
#     dependencies=[WithPermission(GeneralPermission.ReadCatalogRecords)],
# )
# def paginate_notification_lists(
#     page: int = 1,
#     page_size: int = 10,
# ):
#     pass
