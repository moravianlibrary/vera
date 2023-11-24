from sqlalchemy import ARRAY, Column, Enum, ForeignKey, Integer, String, \
    TIMESTAMP, UniqueConstraint, func

from services.database import Base
from catalogs.enums import DigitizationState, MaterialType


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint('sysno'),)

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

    signature = Column(String)
    barcode = Column(String)
    ccnb = Column(String)
    isbn = Column(String)

    creator_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)


class DocumentView(Base):
    __tablename__ = 'document_view'

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume_number = Column(String)
    item_number = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    category_name = Column(String, ForeignKey("categories.name"))

    material_type = Column(Enum(MaterialType))
    title = Column(String)
    publishers = Column(ARRAY(String))

    pages_count = Column(Integer)
    size = Column(String)
    digitization_state = Column(Enum(DigitizationState))

    signature = Column(String)
    barcode = Column(String)
    ccnb = Column(String)
    isbn = Column(String)

    creator_id = Column(Integer, ForeignKey("users.id"), index=True)
    creator_department_id = Column(Integer, ForeignKey("users.department_id"))
    creator = Column(String, ForeignKey("users.username"))
    created_at = Column(TIMESTAMP, server_default=func.now())

    extraction_id = Column(Integer, ForeignKey("extractions.id"), index=True)
    extractor_id = Column(Integer, ForeignKey("users.id"), index=True)
    extractor = Column(String, ForeignKey("users.username"))
    extracted_at = Column(TIMESTAMP)

    comments_count = Column(Integer)
