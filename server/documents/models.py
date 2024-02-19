from sqlalchemy import (
    Column,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session

from services.database import Base
from categories.models import Category
from extractions.models import Extraction
from catalogs.enums import DigitizationState, MaterialType, IssuanceType


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("sysno", "volume", "barcode"),)

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume = Column(String)
    barcode = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    cnb = Column(String)
    isbn_issn = Column(String)
    signature = Column(String)

    material_type = Column(Enum(MaterialType))
    issuance_type = Column(Enum(IssuanceType))
    title = Column(String)
    digitization_state = Column(Enum(DigitizationState))

    year = Column(String)
    bundle = Column(String)

    pages_count = Column(Integer)
    size = Column(String)

    publisher = Column(String)
    publishing_place = Column(String)
    publishing_year = Column(String)
    languages = Column(ARRAY(String))

    frequencies = Column(JSON)

    pages_count_predicted = Column(Integer)
    dedicated_scanner = Column(String)

    created_at = Column(TIMESTAMP, server_default=func.now())
    creator = Column(String, index=True)

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)


def document_view(db: Session):
    return (
        db.query(
            Document.id,
            Document.sysno,
            Document.volume,
            Document.barcode,
            Document.category_id,
            Category.name.label("category_name"),
            Document.cnb,
            Document.isbn_issn,
            Document.signature,
            Document.material_type,
            Document.issuance_type,
            Document.title,
            Document.digitization_state,
            Document.pages_count,
            Document.size,
            Document.publisher,
            Document.publishing_place,
            Document.languages,
            Document.frequencies,
            Document.pages_count_predicted,
            Document.dedicated_scanner,
            Document.created_at,
            Document.creator,
            Document.extraction_id,
            Extraction.extractor,
            Extraction.extracted_at,
        )
        .outerjoin(Category, Document.category_id == Category.id)
        .outerjoin(Extraction, Document.extraction_id == Extraction.id)
    )
