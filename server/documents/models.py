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
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.hybrid import hybrid_property

from services.database import Base
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

    pages_count_catalog = Column(Integer)
    pages_count_predicted = Column(Integer)
    pages_count_manual = Column(Integer)

    size = Column(String)
    locationUri = Column(String)

    publisher = Column(String)
    publishing_place = Column(String)
    publishing_year = Column(String)
    languages = Column(ARRAY(String))

    frequencies = Column(JSON)

    dedicated_scanner = Column(String)

    created_at = Column(TIMESTAMP, server_default=func.now())
    creator = Column(String, index=True)

    extraction_id = Column(
        Integer, ForeignKey("digitization_extractions.id"), index=True
    )

    category = relationship("Category", back_populates="documents")
    extraction = relationship(
        "DigitizationExtraction", back_populates="documents"
    )
    task_documents = relationship(
        "TaskDocument",
        primaryjoin="TaskDocument.document_id == Document.id",
        back_populates="document",
        foreign_keys="TaskDocument.document_id",
    )

    @hybrid_property
    def pages_count(self):
        return (
            self.pages_count_manual
            or self.pages_count_catalog
            or self.pages_count_predicted
        )

    @pages_count.expression
    def pages_count(cls):
        return func.coalesce(
            cls.pages_count_manual,
            cls.pages_count_catalog,
            cls.pages_count_predicted,
        )

    @hybrid_property
    def is_extractable(self):
        return self.pages_count and self.cnb and self.extraction_id is None
