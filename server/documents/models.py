from sqlalchemy import ARRAY, Column, Enum, ForeignKey, Integer, String, \
    TIMESTAMP, UniqueConstraint, func
from sqlalchemy.orm import aliased, Session

from services.database import Base
from categories.models import Category
from extractions.models import Extraction
from users.models import User
from catalogs.enums import DigitizationState, MaterialType


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint(
        'sysno', 'volume_number', 'item_number'),)

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)
    item_number = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    material_type = Column(Enum(MaterialType))
    title = Column(String)
    publishers = Column(ARRAY(String))

    pages_count = Column(Integer)
    size = Column(String)
    digitization_state = Column(Enum(DigitizationState))
    dedicated_scanner = Column(String)

    signature = Column(String)
    barcode = Column(String)
    ccnb = Column(String)
    isbn = Column(String)

    creator_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)


def document_view(db: Session):
    creator = aliased(User)
    extractor = aliased(User)

    return db.query(
        Document.id,
        Document.sysno,
        Document.volume_number,
        Document.item_number,
        Document.category_id,
        Category.name.label('category_name'),
        Document.material_type,
        Document.title,
        Document.publishers,
        Document.pages_count,
        Document.size,
        Document.digitization_state,
        Document.dedicated_scanner,
        Document.signature,
        Document.barcode,
        Document.ccnb,
        Document.isbn,
        Document.creator_id,
        Document.created_at,
        creator.department_id.label('creator_department_id'),
        creator.username.label('creator'),
        Document.extraction_id,
        Extraction.extractor_id,
        extractor.username.label('extractor'),
        Extraction.extracted_at,
    ).outerjoin(
        Category, Document.category_id == Category.id
    ).outerjoin(
        creator, Document.creator_id == creator.id
    ).outerjoin(
        Extraction, Document.extraction_id == Extraction.id
    ).outerjoin(
        extractor, Extraction.extractor_id == extractor.id
    )
