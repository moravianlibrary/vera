from sqlalchemy.orm import Session
from sqlalchemy import update

from services.database import create
from categories import models, schemas


def create_category(category_create: schemas.CategoryCreate,
                    db: Session):
    return create(db, models.Category(
        name=category_create.name
    ))


def update_category(id: int,
                    category: schemas.Category,
                    db: Session):
    db.execute(update(models.Category).where(models.Category.id == id)
               .values(name=category.name))
    db.commit()
    return (db.query(models.Category)
            .where(models.Category.id == id)
            .first())


def delete_category(category_id: int,
                    db: Session):
    db_category = (db.query(models.Category)
                   .where(models.Category.id == category_id)
                   .first())
    db.delete(db_category)
    db.commit()
    return db_category


def get_categories(db: Session):
    return db.query(models.Category).all()
