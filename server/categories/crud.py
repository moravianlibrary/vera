from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from services.database import create
from categories import models, schemas
from documents.models import Document


def create_root_category(category: schemas.CategoryCreate, db: Session):
    return create(
        db,
        models.Category(
            name=category.name,
            description=category.description,
            level=0,
            assignable=category.assignable,
            percentage=0,
            extract_whole=category.extract_whole,
            disabled=False,
        ),
    )


def create_category(category: schemas.CategoryCreate, db: Session):
    db_parent = get_category(category.parent_id, db)
    return create(
        db,
        models.Category(
            name=category.name,
            description=category.description,
            parent_id=category.parent_id,
            level=(db_parent.level + 1),
            assignable=category.assignable,
            percentage=0,
            extract_whole=category.extract_whole,
            disabled=False,
        ),
    )


def update_category(id: int, category: schemas.CategoryCreate, db: Session):
    db_category = (
        db.query(models.Category).filter(models.Category.id == id).first()
    )

    if db_category:
        db_category.name = category.name
        db_category.description = category.description
        db_category.assignable = category.assignable
        db_category.extract_whole = category.extract_whole
        db_category.disabled = category.disabled

        if category.departments is not None:
            set_category_departments(id, category.departments, db)

        db.commit()
        db.refresh(db_category)
        return db_category


def update_distribution(
    distribution: List[schemas.CategoryPercentage], db: Session
):
    for item in distribution:
        db_category = get_category(item.id, db)
        db_category.percentage = item.percentage
    db.commit()


def delete_category(category_id: int, db: Session):
    for child_id in (
        db.query(models.Category.id)
        .where(models.Category.parent_id == category_id)
        .all()
    ):
        delete_category(child_id[0], db)
    db_category = (
        db.query(models.Category)
        .where(models.Category.id == category_id)
        .first()
    )
    db.delete(db_category)
    db.commit()
    return db_category


def get_category(id: int, db: Session):
    return db.query(models.Category).filter(models.Category.id == id).first()


def get_root_categories(db: Session):
    return (
        db.query(models.Category)
        .filter(models.Category.parent_id.is_(None))
        .all()
    )


def get_children_categories(parent_id: int, db: Session):
    return (
        db.query(models.Category)
        .filter(models.Category.parent_id == parent_id)
        .all()
    )


def get_assignable_categories(db: Session):
    return db.query(models.Category).filter(models.Category.assignable).all()


def get_enabled_for_parent(parent_id: int, db: Session):
    query = db.query(models.Category)
    if parent_id is None:
        query = query.filter(models.Category.parent_id.is_(None))
    else:
        query = query.filter(models.Category.parent_id == parent_id)
    return query.filter(models.Category.disabled.is_(False)).all()


def set_category_departments(id: int, departments_ids: List[int], db: Session):
    delete_category_departments(id, db)
    for department_id in departments_ids:
        create(
            db,
            models.CategoryDepartments(
                category_id=id, department_id=department_id
            ),
        )
    db.commit()


def delete_category_departments(id: int, db: Session):
    delete_departments = (
        db.query(models.CategoryDepartments)
        .filter(models.CategoryDepartments.category_id == id)
        .all()
    )
    for item in delete_departments:
        db.delete(item)
    db.commit()


def get_category_departments(id: int, db: Session):
    return (
        db.query(models.CategoryDepartments.department_id)
        .filter(models.CategoryDepartments.category_id == id)
        .all()
    )


def get_pages_count(id: int, db: Session):
    return (
        db.query(func.sum(Document.pages_count))
        .filter(Document.category_id == id)
        .scalar()
    ) or 0


def get_documents_count(id: int, only_with_pages: bool, db: Session):
    query = db.query(func.count(Document.id)).filter(
        Document.category_id == id
    )
    if only_with_pages:
        return query.filter(
            Document.pages_count is not None and Document.pages_count > 0
        ).scalar()
    return query.scalar()
