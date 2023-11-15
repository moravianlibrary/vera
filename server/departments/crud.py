from sqlalchemy import update
from sqlalchemy.orm import Session

from services.database import create
from . import models, schemas


def create_department(department: schemas.DepartmentBase,
                      db: Session):
    return create(db, models.Department(
        abbreviation=department.abbreviation,
        name=department.name
    ))


def update_department(id: int,
                      department: schemas.DepartmentBase,
                      db: Session):
    db.execute(update(models.Department).where(models.Department.id == id)
               .values(abbreviation=department.abbreviation)
               .values(name=department.name))
    db.commit()


def delete_department(department_id: int,
                      db: Session):
    db_department = (db.query(models.Department)
                     .where(models.Department.id == department_id)
                     .first())
    db.delete(db_department)
    db.commit()
    return db_department


def get_departments(db: Session):
    return db.query(models.Department).all()
