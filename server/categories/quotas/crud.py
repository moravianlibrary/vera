from sqlalchemy.orm import Session

from services.database import create
from categories.quotas import models, schemas


def create_quota(quota: schemas.QuotaCreate,
                 db: Session):
    db_quota = create(db, models.Quota(
        name=quota.name,
        description=quota.description,
        pages_count=quota.pages_count,
        active=False
    ))
    if quota.active:
        set_active_quota(quota.id, db)
    return db_quota


def set_active_quota(id: int,
                     db: Session):
    db.query(models.Quota).update({models.Quota.active: models.Quota.id == id})
    db.commit()


def update_quota(quota_id: int,
                 quota: schemas.QuotaCreate,
                 db: Session):
    db_query = db.query(models.Quota).filter(models.Quota.id == quota_id)
    db_query.update(quota)
    db.commit()
    return db_query.first()


def delete_quota(quota_id: int,
                 db: Session):
    db_quota = (db.query(models.Quota)
                .filter(models.Quota.id == quota_id).first())
    if db_quota:
        db.delete(db_quota)
        db.commit()
        return db_quota


def get_quotas(db: Session):
    return db.query(models.Quota).all()
