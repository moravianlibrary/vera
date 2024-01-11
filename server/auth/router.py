from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from services.database import get_db
from . import auth, schemas


router = APIRouter()


@router.get("/auth/token", response_model=schemas.TokenResponse)
def get_token_from_code(
        code: str = Query(..., description="Authorization code from Keycloak"),
        redirect_uri: str =
        Query(..., description="Redirect URI used during login")):
    return auth.get_token_from_code(code, redirect_uri)


@router.get("/auth/current_user", response_model=schemas.CurrentUser)
def get_current_user(db: Session = Depends(get_db),
                     token: str = Depends(auth.oauth2_scheme)):
    return auth.get_user_from_token(db, token)
