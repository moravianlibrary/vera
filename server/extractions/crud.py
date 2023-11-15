from sqlalchemy.orm import Session
from sqlalchemy import update

from services.database import create
from . import models, schemas


def create_extraction(extraction: schemas.ExtractionCreate,
                      user_id: int,
                      db: Session):
    if not extraction.extracted_records:
        return

    db_extraction = create(db, models.Extraction(
        extractor_id=user_id
    ))

    for record_id in extraction.extracted_records:
        db.execute(update(models.Record).where(models.Record.id == record_id)
                   .values(extraction_id=db_extraction.id))

    return db_extraction
