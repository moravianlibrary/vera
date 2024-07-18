from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy import (
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
)

from services.database import Base
from services.external.aleph.types import IssuanceType
from services.external.digitization_registry.types import DigitizationState
from .catalog_records import CatalogRecord


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint(
            "sysno", "barcode", "volume", "volume_year", "bundle"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    sysno = Column(String, ForeignKey("catalog_records.sysno"), index=True)
    barcode = Column(String)
    volume = Column(String)
    volume_year = Column(String)
    bundle = Column(String)
    issuance_type = Column(Enum(IssuanceType))
    document_signature = Column(String)

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

    catalog_record = relationship("CatalogRecord", back_populates="documents")
    category = relationship("Category", back_populates="documents")
    extraction = relationship("DigitizationList", back_populates="documents")
    task_documents = relationship(
        "TaskDocument",
        primaryjoin="TaskDocument.document_id == Document.id",
        back_populates="document",
        foreign_keys="TaskDocument.document_id",
    )

    @hybrid_property
    def title(self) -> str:
        return self.catalog_record.title if self.catalog_record.title else ""

    @hybrid_property
    def cnb(self) -> Optional[str]:
        return self.catalog_record.cnb

    @hybrid_property
    def signature(self) -> Optional[str]:
        return (
            self.document_signature
            if self.document_signature
            else self.catalog_record.signature
        )

    @signature.expression
    def signature(cls):
        return func.coalesce(
            cls.document_signature, cls.catalog_record.signature
        )

    @hybrid_property
    def isxn(self) -> Optional[str]:
        return self.catalog_record.isxn

    @hybrid_property
    def pages_count(self) -> Optional[int]:
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
    def is_extractable(self) -> bool:
        return (
            self.pages_count is not None
            and self.pages_count > 0
            and self.catalog_record.cnb is not None
            and self.extraction_id is None
        )

    # @is_extractable.inplace.expression
    @is_extractable.expression
    def is_extractable(cls):
        return (
            cls.pages_count.is_not(None)
            & (cls.pages_count > 0)
            # & cls.cnb.is_not(None)
            & cls.catalog_record.has(CatalogRecord.cnb.isnot(None))
            & cls.extraction_id.is_(None)
        )

    @hybrid_property
    def category_name(self) -> Optional[str]:
        return self.category.name if self.category else None

    @hybrid_property
    def category_path(self) -> Optional[List[Dict[int, str]]]:
        curr_category = self.category
        category_path = []

        while curr_category:
            category_path.insert(
                0,
                {
                    "category_id": curr_category.id,
                    "category_name": curr_category.name,
                },
            )
            curr_category = curr_category.parent_category

        return category_path if category_path else None

    @hybrid_property
    def extractor(self) -> Optional[str]:
        return self.extraction.extractor if self.extraction else None

    @hybrid_property
    def extracted_at(self) -> Optional[datetime]:
        return self.extraction.extracted_at if self.extraction else None

    @hybrid_property
    def comments_count(self) -> int:
        return 0

    @classmethod
    def find(cls, session: Session, document_id: int) -> Optional["Document"]:
        return session.query(cls).filter_by(id=document_id).first()

    @classmethod
    def get(cls, session: Session, document_id: int) -> "Document":
        document = cls.find(session, document_id)
        if not document:
            raise ValueError(f"Document with id {document_id} not found")
        return document

    @classmethod
    def all(cls, session, page=1, page_size=50):
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class DocumentComment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    username = Column(String, index=True)
    text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)
