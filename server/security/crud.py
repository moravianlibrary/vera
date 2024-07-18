from sqlalchemy.orm import Session
from sqlalchemy import update
from typing import List, Optional

from services.database import create
import schemas.security as schemas
from models import User, Role, Department, RoleAction


# Create
def add_user(username: str, db: Session):
    db_user = get_user(username, db)
    return db_user if db_user else create(db, User(username=username))


def create_role(role: schemas.RoleCreate, db: Session) -> Role:
    db_role = create(db, Role(name=role.name))
    for action in role.actions:
        create(db, RoleAction(role_id=db_role.id, action=action))
    return db_role


def create_department(
    department: schemas.DepartmentCreate, db: Session
) -> Department:
    return create(
        db,
        Department.create_from_schema(department),
    )


# Select by id
def get_user(username: str, db: Session):
    return db.query(User).filter(User.username == username).first()


def get_role(role_id: int, db: Session) -> Optional[Role]:
    return db.query(Role).filter(Role.id == role_id).first()


def get_department(department_id: int, db: Session):
    return db.query(Department).where(Department.id == department_id).first()


# Update
def update_role(
    id: int, role: schemas.RoleCreate, db: Session
) -> Optional[Role]:
    db_role = get_role(id, db)
    db_role.name = role.name
    for role_action in db_role.role_actions:
        db.delete(role_action)
    db.commit()
    for action in role.actions:
        create(db, RoleAction(role_id=db_role.id, action=action))
    db.commit()
    db.refresh(db_role)
    return db_role


def update_department(
    id: int, department: schemas.DepartmentCreate, db: Session
):
    db.execute(
        update(Department)
        .where(Department.id == id)
        .values(
            abbreviation=department.abbreviation,
            name=department.name,
            users=department.users,
        )
    )
    db.commit()
    return get_department(id, db)


# Delete
def delete_role(id: int, db: Session) -> Optional[Role]:
    db_role = get_role(id, db)
    for role_action in db_role.role_actions:
        db.delete(role_action)
    db.delete(db_role)
    db.commit()
    return db_role


def delete_department(department_id: int, db: Session):
    db_department = (
        db.query(Department).where(Department.id == department_id).first()
    )
    db.delete(db_department)
    db.commit()
    return db_department


# Select all
def get_users(db: Session):
    return db.query(User).all()


def get_role_by_name(name: str, db: Session) -> Optional[Role]:
    return db.query(Role).filter(Role.name == name).first()


def get_roles(db: Session) -> List[Role]:
    return db.query(Role).order_by(Role.name).all()


def get_department_by_name(name: str, db: Session):
    return db.query(Department).filter(Department.name == name).first()


def get_user_departments(username: str, db: Session):
    return db.query(Department).filter(Department.users.any(username)).all()


def get_departments(db: Session):
    return db.query(Department).all()
