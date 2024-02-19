from sqlalchemy import update
from sqlalchemy.orm import Session

from departments import models, schemas
from services.database import create
from services.exceptions import DepartmentNotFoundException


def create_department(department: schemas.DepartmentBase, db: Session):
    return create(
        db,
        models.Department(
            abbreviation=department.abbreviation, name=department.name
        ),
    )


def update_department(
    id: int, department: schemas.DepartmentBase, db: Session
):
    db.execute(
        update(models.Department)
        .where(models.Department.id == id)
        .values(abbreviation=department.abbreviation)
        .values(name=department.name)
    )
    db.commit()
    return (
        db.query(models.Department).where(models.Department.id == id).first()
    )


def delete_department(department_id: int, db: Session):
    db_department = (
        db.query(models.Department)
        .where(models.Department.id == department_id)
        .first()
    )
    db.delete(db_department)
    db.commit()
    return db_department


def add_user_to_department(department_id: int, username: str, db: Session):
    db_department = (
        db.query(models.Department)
        .where(models.Department.id == department_id)
        .first()
    )
    if not db_department:
        raise DepartmentNotFoundException(department_id)

    users = db_department.users
    if username in users:
        return db_department
    users.append(username)

    db.execute(
        update(models.Department)
        .where(models.Department.id == department_id)
        .values(users=users)
    )
    db.commit()
    db.refresh(db_department)
    return db_department


def delete_user_from_department(
    department_id: int, username: str, db: Session
):
    db_department = (
        db.query(models.Department)
        .where(models.Department.id == department_id)
        .first()
    )
    if not db_department:
        raise DepartmentNotFoundException(department_id)

    users = db_department.users
    if username not in users:
        return db_department
    users.remove(username)

    db.execute(
        update(models.Department)
        .where(models.Department.id == department_id)
        .values(users=users)
    )
    db.commit()
    db.refresh(db_department)
    return db_department


def get_department(name: str, db: Session):
    return (
        db.query(models.Department)
        .filter(models.Department.name == name)
        .first()
    )


def get_user_departments(username: str, db: Session):
    return (
        db.query(models.Department)
        .filter(models.Department.users.any(username))
        .all()
    )


def get_departments(db: Session):
    return db.query(models.Department).all()
