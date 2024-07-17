from fastapi import Depends
from schemas.security import CurrentUser
from services.database import get_db
from security.api import get_current_user
from services.documents_indexer import get_indexer


def get_caller_username(
    current_user: CurrentUser = Depends(get_current_user),
) -> str:
    return current_user.username


DependsOnCurrentUser = Depends(get_current_user)
DependsOnCallerUsername = Depends(get_caller_username)
DependsOnDbSession = Depends(get_db)
DependsOnDocumentsIndexer = Depends(get_indexer)
