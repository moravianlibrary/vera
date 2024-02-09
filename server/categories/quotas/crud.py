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
        set_active_quota(db_quota.id, db)
    if len(get_quotas(db)) == 1:
        set_active_quota(db_quota.id, db)
    return db_quota


def set_active_quota(id: int,
                     db: Session):
    db.query(models.Quota).update({models.Quota.active: models.Quota.id == id})
    db.commit()


def update_quota(quota_id: int,
                 quota: schemas.QuotaCreate,
                 db: Session):
    db_quota = (db.query(models.Quota)
                .filter(models.Quota.id == quota_id).first())

    if db_quota:
        db_quota.name = quota.name
        db_quota.description = quota.description
        db_quota.pages_count = quota.pages_count
        if quota.active:
            set_active_quota(db_quota.id, db)

        db.commit()
        db.refresh(db_quota)
        return db_quota


def delete_quota(quota_id: int,
                 db: Session):
    db_quota = (db.query(models.Quota)
                .filter(models.Quota.id == quota_id).first())
    if db_quota:
        db.delete(db_quota)
        db.commit()
        return db_quota


def get_quotas(db: Session):
    return db.query(models.Quota).order_by(models.Quota.id).all()


def get_quota_by_name(name: str,
                      db: Session):
    return (db.query(models.Quota)
            .filter(models.Quota.name == name)
            .first())


def get_quota(quota_id: int,
              db: Session):
    return (db.query(models.Quota)
            .filter(models.Quota.id == quota_id)
            .first())
