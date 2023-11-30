from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from services.database import get_db
from categories.quotas import crud, schemas
from typing import List


router = APIRouter()


@router.post("/categories/quota", response_model=schemas.Quota)
def create_quota(quota: schemas.QuotaCreate,
                 db: Session = Depends(get_db)):
    return crud.create_quota(quota, db)


@router.put("/categories/quota/{id}", response_model=schemas.Quota)
def update_quota(quota: schemas.QuotaCreate,
                 id: int = Path(...),
                 db: Session = Depends(get_db)):
    return crud.update_quota(id, quota, db)


@router.delete("/categories/quota/{id}", response_model=schemas.Quota)
def delete_quota(id: int = Path(...),
                 db: Session = Depends(get_db)):
    return crud.delete_quota(id, db)


@router.get("/categories/quota", response_model=List[schemas.Quota])
def get_quotas(db: Session = Depends(get_db)):
    return crud.get_quotas(db)
