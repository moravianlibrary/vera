from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Set

import auth, crud, schemas
from database import get_db
from auth import Role
from etypes import ActionType, ActionScope


FORBIDDEN_EXCEPTION = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="User is not allowed to perform action",
    headers={"WWW-Authenticate": "Bearer"},
)


def extract_token(request: Request):
    authorization_header = request.headers.get("Authorization")

    if not authorization_header:
        return {"message": "No Authorization header provided"}

    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return {"message": "Invalid Authorization header format"}

    return parts[1]


def check_permissions(action_type: ActionType, allowed_scopes: Set[ActionScope], request: Request, db: Session = Depends(get_db)):
    token = extract_token(request)
    actions = auth.get_current_user_actions(db, token)
    for action in actions:
        print(action)
