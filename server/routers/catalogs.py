from fastapi import APIRouter, Path

from routers.utils.dependencies import DependsOnCurrentUser
from schemas.marc21_diff import Marc21DiffRecord
from schemas.security import CurrentUser
from services.exceptions import CatalogRecordNotFoundException


router = APIRouter(prefix="/catalogs")


@router.get("/mzk_skc_diff/{mzk_sysno}", response_model=Marc21DiffRecord)
def get_mzk_skc_diff(
    mzk_sysno: str = Path(..., description="MZK catalog system number"),
    user: CurrentUser = DependsOnCurrentUser,
):
    raise CatalogRecordNotFoundException(mzk_sysno)
    # record = validator.get_record_diff_against_skc(
    #     mzk_sysno, get_marc21_document(mzk_sysno)
    # )
    # if record is None:
    #     raise CatalogRecordNotFoundException(mzk_sysno)
    # return record


@router.get("/mzk_cnb_diff/{mzk_sysno}", response_model=Marc21DiffRecord)
def get_mzk_cnb_diff(
    mzk_sysno: str = Path(..., description="MZK catalog system number"),
    user: CurrentUser = DependsOnCurrentUser,
):
    raise CatalogRecordNotFoundException(mzk_sysno)
    # record = validator.get_record_diff_against_cnb(
    #     mzk_sysno, get_marc21_document(mzk_sysno)
    # )
    # if record is None:
    #     raise CatalogRecordNotFoundException(mzk_sysno)
    # return record


@router.get("/cnb_validity/{mzk_sysno}", response_model=float)
def get_cnb_validity(
    mzk_sysno: str = Path(..., description="MZK catalog system number"),
    user: CurrentUser = DependsOnCurrentUser,
):
    return 0.0
    # mzk_document = get_catalog_document(mzk_sysno)
    # if mzk_document is None or mzk_document.cnb is None:
    #     return 0.0
    # return validator.has_valid_cnb(mzk_sysno, mzk_document.cnb)
