from datetime import datetime
from typing import Optional
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import (
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)

from services.database import Base
from catalogs.enums import DigitizationState


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint(
            "sysno", "barcode", "volume", "volume_year", "bundle"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    sysno = Column(String, index=True, nullable=False)
    barcode = Column(String)
    volume = Column(String)
    volume_year = Column(String)
    bundle = Column(String)

    cnb = Column(String)
    signature = Column(String)
    isxn = Column(String)

    added_at = Column(TIMESTAMP, server_default=func.now())
    added_by = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    digitization_registry_id = Column(Integer)
    digitization_state = Column(Enum(DigitizationState))

    pages_count_catalog = Column(Integer)
    pages_count_predicted = Column(Integer)
    pages_count_manual = Column(Integer)

    dedicated_scanner = Column(String)
    extraction_priority = Column(
        Integer,
        CheckConstraint(
            "extraction_priority >= 1 AND extraction_priority <= 5"
        ),
        nullable=False,
        default=3,
    )
    extraction_id = Column(
        Integer, ForeignKey("digitization_extractions.id"), index=True
    )

    # TODO: only indexed attributes
    # material_type = Column(Enum(MaterialType))
    # issuance_type = Column(Enum(IssuanceType))
    # title = Column(String)

    # size = Column(String)
    # locationUri = Column(String)

    # publisher = Column(String)
    # publishing_place = Column(String)
    # publishing_year = Column(String)
    # languages = Column(ARRAY(String))

    # frequencies = Column(JSON)

    catalog_record = relationship("CatalogRecord", back_populates="documents")
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
    def pages_count(self) -> int:
        return (
            self.pages_count_manual
            or self.pages_count_catalog
            or self.pages_count_predicted
            or 0
        )

    @pages_count.expression
    def pages_count(cls):
        return func.coalesce(
            cls.pages_count_manual,
            cls.pages_count_catalog,
            cls.pages_count_predicted,
        )

    @hybrid_property
    def is_extractable(self) -> bool:
        return (
            self.pages_count is not None
            and self.pages_count > 0
            and self.cnb is not None
            and self.extraction_id is None
        )

    @is_extractable.inplace.expression
    def is_extractable(cls):
        return (
            cls.pages_count.is_not(None)
            & (cls.pages_count > 0)
            & cls.cnb.is_not(None)
            & cls.extraction_id.is_(None)
        )

    @hybrid_property
    def category_name(self) -> Optional[str]:
        return self.category.name if self.category else None

    @hybrid_property
    def extractor(self) -> Optional[str]:
        return self.extraction.extractor if self.extraction else None

    @hybrid_property
    def extracted_at(self) -> Optional[datetime]:
        return self.extraction.extracted_at if self.extraction else None

    @hybrid_property
    def comments_count(self) -> int:
        return 0
