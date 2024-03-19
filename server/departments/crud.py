from sqlalchemy import update
from sqlalchemy.orm import Session

from departments import models, schemas
from services.database import create


def create_department(
    department: schemas.DepartmentCreate, db: Session
) -> models.Department:
    db_department = create(
        db,
        models.Department(
            abbreviation=department.abbreviation,
            name=department.name,
            users=department.users,
        ),
    )
    return db_department


def update_department(
    id: int, department: schemas.DepartmentCreate, db: Session
):
    db.execute(
        update(models.Department)
        .where(models.Department.id == id)
        .values(abbreviation=department.abbreviation)
        .values(name=department.name)
        .values(users=department.users)
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
