from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from services.database import get_db
from categories.quotas import crud, schemas
from typing import List, Optional
from services.exceptions import UniqueQuotaNameViolationException


router = APIRouter()


def has_unique_name(quota: schemas.QuotaCreate,
                    quota_id: Optional[int],
                    db: Session):
    q = crud.get_quota_by_name(quota.name, db)
    return q is None if quota_id is None else q.id == quota_id


@router.post("/categories/quota", response_model=schemas.Quota)
def create_quota(quota: schemas.QuotaCreate,
                 db: Session = Depends(get_db)):
    if not has_unique_name(quota, None, db):
        raise UniqueQuotaNameViolationException
    return crud.create_quota(quota, db)


@router.put("/categories/quota/{id}", response_model=schemas.Quota)
def update_quota(quota: schemas.QuotaCreate,
                 id: int = Path(...),
                 db: Session = Depends(get_db)):
    if not has_unique_name(quota, id, db):
        raise UniqueQuotaNameViolationException
    return crud.update_quota(id, quota, db)


@router.delete("/categories/quota/{id}", response_model=schemas.Quota)
def delete_quota(id: int = Path(...),
                 db: Session = Depends(get_db)):
    return crud.delete_quota(id, db)


@router.get("/categories/quota", response_model=List[schemas.Quota])
def get_quotas(db: Session = Depends(get_db)):
    return crud.get_quotas(db)
