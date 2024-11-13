from datetime import datetime
from typing import Optional, List, Dict, Set
from sqlalchemy.orm import relationship, Session, joinedload
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
    or_,
)

from services.aleph import IssuanceType
from services.external.digitization_registry import DigitizationState
from exceptions import (
    CannotExtractDocumentWithInvalidCnb,
    CannotExtractDocumentWithInvalidMainRecord,
    CannotExtractDocumentWithoutPageCount,
    DocumentAlreadyExtractedException,
    ExtractingDocumentsWithDigitizationStateDisabled,
)
from .catalog_records import CatalogRecord
from .base import BaseModel


class Document(BaseModel):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint(
            "sysno", "barcode", "volume", "volume_year", "bundle"
        ),
    )

    id = Column(Integer, primary_key=True, index=True, unique=True)

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
    digitization_state = Column(
        Enum(DigitizationState),
        nullable=False,
        default=DigitizationState.NotDigitized,
    )

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
    digitization_list_id = Column(
        Integer, ForeignKey("digitization_lists.id"), index=True
    )

    catalog_record = relationship("CatalogRecord", back_populates="documents")
    category = relationship("Category", back_populates="documents")
    digitization_list = relationship(
        "DigitizationList", back_populates="documents"
    )
    extractions = relationship("ExtractionDocument", back_populates="document")

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
        return func.coalesce(cls.document_signature, CatalogRecord.signature)

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
            and self.catalog_record.has_valid_main_record
            and self.catalog_record.has_valid_cnb
            and self.digitization_list_id is None
        )

    @is_extractable.expression
    def is_extractable(cls):
        return (
            cls.pages_count.is_not(None)
            & (cls.pages_count > 0)
            & cls.catalog_record.has(CatalogRecord.has_valid_main_record)
            & cls.catalog_record.has(CatalogRecord.has_valid_cnb)
            & cls.digitization_list_id.is_(None)
        )

    @hybrid_property
    def extraction_ids(self) -> List[int]:
        return [e.extraction_id for e in self.extractions]

    def raise_for_extractibility(
        self, ignore_digitization_states: Set[DigitizationState]
    ) -> None:
        if self.is_extractable:
            if (
                self.digitization_state != DigitizationState.NotDigitized
                and self.digitization_state not in ignore_digitization_states
            ):
                raise ExtractingDocumentsWithDigitizationStateDisabled(
                    self.digitization_state.value
                )
            return
        if not self.catalog_record.has_valid_main_record:
            raise CannotExtractDocumentWithInvalidMainRecord()
        if not self.catalog_record.has_valid_cnb:
            raise CannotExtractDocumentWithInvalidCnb()
        if self.pages_count is None or self.pages_count == 0:
            raise CannotExtractDocumentWithoutPageCount()
        if self.digitization_list_id is not None:
            raise DocumentAlreadyExtractedException()

    @hybrid_property
    def category_name(self) -> Optional[str]:
        return self.category.name if self.category else None

    @hybrid_property
    def category_ids(self) -> List[int]:
        curr_category = self.category
        category_id_path = []

        while curr_category:
            category_id_path.append(curr_category.id)
            curr_category = curr_category.parent_category

        return category_id_path if category_id_path else []

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
    def digitization_list_created_by(self) -> Optional[str]:
        return (
            self.digitization_list.created_by
            if self.digitization_list
            else None
        )

    @hybrid_property
    def digitization_list_created_at(self) -> Optional[datetime]:
        return (
            self.digitization_list.created_at
            if self.digitization_list
            else None
        )

    @hybrid_property
    def comments_count(self) -> int:
        return 0

    @classmethod
    def find(cls, session: Session, document_id: int) -> Optional["Document"]:
        return (
            session.query(cls)
            .options(joinedload(Document.category))
            .options(joinedload(Document.catalog_record))
            .filter_by(id=document_id)
            .first()
        )

    def validate_before_save(self, session: Session) -> None:
        if self.barcode:
            other = (
                session.query(Document).filter_by(barcode=self.barcode).first()
            )
        elif self.volume or self.volume_year or self.bundle:
            other = (
                session.query(Document)
                .filter_by(
                    volume=self.volume,
                    volume_year=self.volume_year,
                    bundle=self.bundle,
                )
                .first()
            )
        else:
            other = session.query(Document).filter_by(sysno=self.sysno).first()

        if other is not None and (self.id is None or self.id != other.id):
            raise ValueError(
                f"Document with sysno {self.sysno}, barcode {self.barcode} "
                f"and issue {self.volume} {self.volume_year} {self.bundle} "
                "already exists"
            )

    @classmethod
    def find_id_by_identifiers(
        cls,
        session: Session,
        sysno: str,
        barcode: Optional[str] = None,
        volume: Optional[str] = None,
        volume_year: Optional[str] = None,
        bundle: Optional[str] = None,
    ) -> Optional[int]:
        if barcode:
            document = (
                session.query(cls)
                .filter_by(sysno=sysno, barcode=barcode)
                .one_or_none()
            )
        elif volume or volume_year or bundle:
            return (
                session.query(cls)
                .filter_by(
                    sysno=sysno,
                    volume=volume,
                    volume_year=volume_year,
                    bundle=bundle,
                )
                .one_or_none()
            )
        else:
            document = session.query(cls).filter_by(sysno=sysno).one_or_none()

        return document.id if document else None

    @classmethod
    def exists(
        cls,
        session: Session,
        sysno: str,
        barcode: Optional[str] = None,
        volume: Optional[str] = None,
        volume_year: Optional[str] = None,
        bundle: Optional[str] = None,
    ) -> bool:
        if barcode:
            return (
                session.query(cls)
                .filter_by(sysno=sysno, barcode=barcode)
                .count()
                > 0
            )
        if volume or volume_year or bundle:
            return (
                session.query(cls)
                .filter_by(
                    sysno=sysno,
                    volume=volume,
                    volume_year=volume_year,
                    bundle=bundle,
                )
                .count()
                > 0
            )
        return session.query(cls).filter_by(sysno=sysno).count() > 0

    @classmethod
    def get_extractable_documents(
        cls,
        session: Session,
        category_id: int,
        location_patterns: List[str] = [],
        ignore_digitization_states: Set[DigitizationState] = set(),
    ) -> List["Document"]:
        query = (
            session.query(cls)
            .join(CatalogRecord)
            .filter(cls.category_id == category_id)
            .filter(cls.is_extractable)
            .order_by(cls.extraction_priority.desc(), cls.added_at)
        )

        if location_patterns:
            regex_filters = [
                cls.signature.regexp_match(pattern)
                for pattern in location_patterns
            ]
            query = query.filter(or_(*regex_filters))

        ignore_digitization_states.add(DigitizationState.NotDigitized)
        query = query.filter(
            cls.digitization_state.in_(ignore_digitization_states)
        )

        return query.all()


class DocumentComment(BaseModel):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    username = Column(String, index=True)
    text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)
