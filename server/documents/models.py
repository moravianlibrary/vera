from sqlalchemy import Column, Enum, ForeignKey, Integer, String, \
    TIMESTAMP, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session

from services.database import Base
from categories.models import Category
from extractions.models import Extraction
from catalogs.enums import DigitizationState, MaterialType


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint(
        'sysno', 'volume_number', 'barcode'),)

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    signature = Column(String)
    barcode = Column(String)
    ccnb = Column(String)
    isbn = Column(String)

    material_type = Column(Enum(MaterialType))
    title = Column(String)

    pages_count = Column(Integer)
    size = Column(String)
    digitization_state = Column(Enum(DigitizationState))

    pages_count_predicted = Column(Integer)
    dedicated_scanner = Column(String)

    publishers = Column(ARRAY(String))
    places = Column(ARRAY(String))
    languages = Column(ARRAY(String))
    frequencies = Column(ARRAY(String))

    created_at = Column(TIMESTAMP, server_default=func.now())
    creator = Column(String, index=True)

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)


def document_view(db: Session):
    return db.query(
        Document.id,
        Document.sysno,
        Document.volume_number,
        Document.category_id,
        Category.name.label('category_name'),
        Document.signature,
        Document.barcode,
        Document.ccnb,
        Document.isbn,
        Document.material_type,
        Document.title,
        Document.pages_count,
        Document.size,
        Document.digitization_state,
        Document.pages_count_predicted,
        Document.dedicated_scanner,
        Document.publishers,
        Document.places,
        Document.languages,
        Document.frequencies,
        Document.created_at,
        Document.creator,
        Document.extraction_id,
        Extraction.extractor,
        Extraction.extracted_at,
    ).outerjoin(
        Category, Document.category_id == Category.id
    ).outerjoin(
        Extraction, Document.extraction_id == Extraction.id
    )
