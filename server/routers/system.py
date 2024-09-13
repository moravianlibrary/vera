from fastapi import APIRouter
from sqlalchemy.orm import Session
from .utils.dependencies import DependsOnDbSession
from .utils.permissions import CanManageSystem


router = APIRouter(prefix="/system")


@router.get(
    "/database", dependencies=[CanManageSystem], response_model=CurrentUser
)
def get_database_dump(session: Session = DependsOnDbSession):
    pass
