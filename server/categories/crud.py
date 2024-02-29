from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session
from typing import List

from services.database import create
from categories import models, schemas
from documents.models import Document


MAX_CATEGORY_LEVEL = 3


def create_root_category(category: schemas.CategoryCreate, db: Session):
    db_category = create(
        db,
        models.Category(
            name=category.name,
            description=category.description,
            level=0,
            assignable=False,
            percentage=0,
            extract_whole=category.extract_whole,
            disabled=False,
        ),
    )
    if category.departments is not None:
        set_category_departments(db_category.id, category.departments, db)

    return db_category


def create_category(category: schemas.CategoryCreate, db: Session):
    db_parent = get_category(category.parent_id, db)
    if db_parent.level == MAX_CATEGORY_LEVEL:
        raise Exception("Maximum category level reached")

    db_category = create(
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

    parent_departments = [
        department.department_id
        for department in get_category_departments(category.parent_id, db)
    ]
    if parent_departments:
        set_category_departments(db_category.id, parent_departments, db)

    return db_category


def update_category(id: int, category: schemas.CategoryCreate, db: Session):
    db_category = (
        db.query(models.Category).filter(models.Category.id == id).first()
    )

    if not db_category:
        return

    db_category.name = category.name
    db_category.description = category.description
    db_category.assignable = category.assignable
    db_category.extract_whole = category.extract_whole
    db_category.disabled = category.disabled

    if category.departments is not None and db_category.level == 0:
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
    for child_id in get_children_categories(category_id, db):
        delete_category(child_id.id, db)

    db.query(models.CategoryDepartments).filter(
        models.CategoryDepartments.category_id == category_id
    ).delete()
    db_category = get_category(category_id, db)
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
    return (
        query.filter(models.Category.disabled.is_(False))
        .order_by(models.Category.id)
        .all()
    )


def set_category_departments(
    category_id: int, departments_ids: List[int], db: Session
):
    db_departments_ids = [
        department.department_id
        for department in get_category_departments(category_id, db)
    ]

    for department_id in db_departments_ids:
        if department_id not in departments_ids:
            delete_category_department(category_id, department_id, db)

    for department_id in departments_ids:
        if department_id not in db_departments_ids:
            add_category_department(category_id, department_id, db)

    db.commit()


def add_category_department(category_id: int, department_id, db: Session):
    create(
        db,
        models.CategoryDepartments(
            category_id=category_id, department_id=department_id
        ),
    )
    for category in get_children_categories(category_id, db):
        add_category_department(category.id, department_id, db)


def delete_category_department(category_id: int, department_id, db: Session):
    db.query(models.CategoryDepartments).filter(
        models.CategoryDepartments.category_id == category_id
    ).filter(
        models.CategoryDepartments.department_id == department_id
    ).delete()
    for category in get_children_categories(category_id, db):
        delete_category_department(category.id, department_id, db)


def get_category_departments(
    id: int, db: Session
) -> List[models.CategoryDepartments]:
    return (
        db.query(models.CategoryDepartments.department_id)
        .filter(models.CategoryDepartments.category_id == id)
        .all()
    )


def get_pages_count(id: int, db: Session):
    return (
        db.query(
            func.sum(
                func.coalesce(
                    Document.pages_count, Document.pages_count_predicted
                )
            )
        )
        .filter(Document.category_id == id)
        .scalar()
    ) or 0


def get_documents_count(id: int, only_with_pages: bool, db: Session):
    query = db.query(func.count(Document.id)).filter(
        Document.category_id == id
    )
    if only_with_pages:
        return query.filter(
            or_(
                and_(
                    Document.pages_count.is_not(None), Document.pages_count > 0
                ),
                and_(
                    Document.pages_count_predicted.is_not(None),
                    Document.pages_count_predicted > 0,
                ),
            )
        ).scalar()
    return query.scalar()
