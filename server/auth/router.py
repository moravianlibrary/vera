from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.database import get_db
from . import auth, schemas


router = APIRouter()


@router.get("/auth/current_user", response_model=schemas.CurrentUser)
def get_current_user(db: Session = Depends(get_db),
                     token: str = Depends(auth.oauth2_scheme)):
    return auth.get_user_from_token(db, token)
