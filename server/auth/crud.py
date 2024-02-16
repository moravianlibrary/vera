from sqlalchemy.orm import Session

from services.database import create
from auth.models import Users


def add_user(username: str, db: Session):
    db_user = get_user(username, db)
    if not db_user:
        return create(db, Users(username=username))
    return db_user


def get_user(username: str, db: Session):
    return db.query(Users).filter(Users.username == username).first()


def get_users(db: Session):
    return db.query(Users).all()
