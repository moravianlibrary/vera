from typing import Optional, List, Tuple
from pymarc import Record
from sqlalchemy.orm import Session, relationship, Query
from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    func,
    and_,
    or_,
    exists,
)
from sqlalchemy.ext.hybrid import hybrid_property
from datatypes import IdentifierType, CatalogSource, CZECH_LANGUAGE
from services.marc_comparator import MarcFieldDifferenceType
from .utils.parsers import marc_binary_to_record
from .base import BaseModel


class CatalogRecord(BaseModel):
    __tablename__ = "catalog_records"

    sysno = Column(String, primary_key=True, index=True, unique=True)
    marc = Column(LargeBinary, nullable=False)

    cnb = Column(String)
    language = Column(String, nullable=False, default=CZECH_LANGUAGE)
    signature = Column(String)
    isxn = Column(String)

    skc_sysno = Column(String)
    skc_marc = Column(LargeBinary)

    cnb_sysno = Column(String)
    cnb_marc = Column(LargeBinary)

    added_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP,
        server_default=func.now(),
        nullable=False,
        onupdate=func.now(),
    )

    record_barcodes = relationship(
        "CatalogRecordBarcode",
        back_populates="catalog_record",
        cascade="all, delete-orphan",
    )
    field_differences = relationship(
        "CatalogRecordFieldDifference", back_populates="catalog_record"
    )
    skc_difference = relationship(
        "CatalogRecordFieldDifference",
        primaryjoin=(
            "and_("
            "CatalogRecord.sysno == CatalogRecordFieldDifference.sysno, "
            "CatalogRecordFieldDifference.source == 'SKC',"
            "CatalogRecordFieldDifference.deleted == False"
            ")"
        ),
        back_populates="catalog_record",
        viewonly=True,
    )
    cnb_difference = relationship(
        "CatalogRecordFieldDifference",
        primaryjoin=(
            "and_("
            "CatalogRecord.sysno == CatalogRecordFieldDifference.sysno, "
            "CatalogRecordFieldDifference.source == 'CNB', "
            "CatalogRecordFieldDifference.deleted == False"
            ")"
        ),
        back_populates="catalog_record",
        viewonly=True,
    )
    documents = relationship("Document", back_populates="catalog_record")

    @hybrid_property
    def main_record(self) -> Record:
        return marc_binary_to_record(self.marc)

    @hybrid_property
    def skc_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.skc_marc) if self.skc_marc else None

    @hybrid_property
    def cnb_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.cnb_marc) if self.cnb_marc else None

    @hybrid_property
    def has_valid_main_record(self) -> bool:
        return self.skc_marc is not None and all(
            difference.approved_by is not None
            for difference in self.skc_difference
        )

    @has_valid_main_record.expression
    def has_valid_main_record(cls):
        return and_(
            cls.skc_marc.is_not(None),
            ~exists().where(
                CatalogRecordFieldDifference.sysno == cls.sysno,
                CatalogRecordFieldDifference.source == CatalogSource.SKC,
                CatalogRecordFieldDifference.approved_by.is_(None),
            ),
        )

    @hybrid_property
    def has_valid_cnb(self) -> bool:
        return (
            self.language == CZECH_LANGUAGE
            and self.cnb_marc is not None
            and all(
                difference.approved_by is not None
                for difference in self.cnb_difference
            )
        ) or (
            self.language != CZECH_LANGUAGE and len(self.cnb_difference) == 0
        )

    @has_valid_cnb.expression
    def has_valid_cnb(cls):
        return or_(
            and_(
                cls.language == CZECH_LANGUAGE,
                cls.cnb_marc.is_not(None),
                ~exists().where(
                    CatalogRecordFieldDifference.sysno == cls.sysno,
                    CatalogRecordFieldDifference.source == CatalogSource.CNB,
                    CatalogRecordFieldDifference.approved_by.is_(None),
                ),
            ),
            and_(
                cls.language != CZECH_LANGUAGE,
                ~exists().where(
                    CatalogRecordFieldDifference.sysno == cls.sysno,
                    CatalogRecordFieldDifference.source == CatalogSource.CNB,
                ),
            ),
        )

    @hybrid_property
    def skc_sysno_resolved(self) -> bool:
        return self.skc_sysno is not None

    @hybrid_property
    def without_cnb(self) -> bool:
        return self.language != CZECH_LANGUAGE

    @hybrid_property
    def cnb_sysno_resolved(self) -> bool:
        return self.cnb_sysno is not None

    @hybrid_property
    def has_documents(self) -> bool:
        return bool(self.documents)

    @hybrid_property
    def has_active_documents(self) -> bool:
        return any(d.digitization_list_id is None for d in self.documents)

    @hybrid_property
    def barcodes(self) -> List[str]:
        return [barcode.barcode for barcode in self.record_barcodes]

    @hybrid_property
    def document_ids(self) -> List[int]:
        return [d.id for d in self.documents]

    @classmethod
    def find(cls, session: Session, sysno: str) -> Optional["CatalogRecord"]:
        return session.query(cls).filter_by(sysno=sysno).first()

    @classmethod
    def find_by_identifier(
        cls, session: Session, identifier_type: IdentifierType, value: str
    ) -> Optional["CatalogRecord"]:
        if identifier_type == IdentifierType.Sysno:
            return cls.find(session, value)
        if identifier_type == IdentifierType.Cnb:
            return session.query(cls).filter_by(cnb=value).first()
        if identifier_type == IdentifierType.Signature:
            return session.query(cls).filter_by(signature=value).first()
        if identifier_type == IdentifierType.Isxn:
            return session.query(cls).filter_by(isxn=value).first()
        return (
            session.query(cls)
            .join(CatalogRecordBarcode)
            .filter(CatalogRecordBarcode.barcode == value)
            .first()
        )

    @classmethod
    def query_base(cls, session: Session) -> Query:
        return session.query(cls)

    def is_persisted(self, session: Session) -> bool:
        return CatalogRecordBarcode.find(session, self.sysno) is not None


class CatalogRecordBarcode(BaseModel):
    __tablename__ = "catalog_record_barcode"

    sysno = Column(
        String, ForeignKey("catalog_records.sysno"), primary_key=True
    )
    barcode = Column(String, primary_key=True)

    catalog_record = relationship(
        "CatalogRecord", back_populates="record_barcodes"
    )

    @classmethod
    def find(
        cls, session: Session, sysno_barcode_id: Tuple[str, str]
    ) -> Optional["CatalogRecordBarcode"]:
        return (
            session.query(cls)
            .filter_by(sysno=sysno_barcode_id[0], barcode=sysno_barcode_id[1])
            .first()
        )

    def save(self, session: Session) -> "CatalogRecordBarcode":
        merged_instance = session.merge(self)
        session.commit()
        session.refresh(merged_instance)
        return merged_instance


class CatalogRecordFieldDifference(BaseModel):
    __tablename__ = "catalog_record_field_differences"

    id = Column(Integer, primary_key=True)

    sysno = Column(String, ForeignKey("catalog_records.sysno"), index=True)
    source = Column(Enum(CatalogSource), index=True, nullable=False)
    tag = Column(String, index=True, nullable=False)
    indicator1 = Column(String, index=True)
    indicator2 = Column(String, index=True)

    difference_type = Column(Enum(MarcFieldDifferenceType), nullable=False)

    approved_by = Column(String)
    approved_at = Column(TIMESTAMP)
    rescinded_by = Column(String)
    rescinded_at = Column(TIMESTAMP)
    deleted = Column(Boolean, server_default="false", nullable=False)

    catalog_record = relationship(
        "CatalogRecord", back_populates="field_differences"
    )
    subfield_differences = relationship(
        "CatalogRecordSubfieldDifference",
        back_populates="field_difference",
        cascade="all, delete-orphan",
    )

    @hybrid_property
    def control_field(self) -> bool:
        return self.tag < "010" and self.tag.isdigit()

    @hybrid_property
    def is_skc_difference(self) -> bool:
        return self.source == CatalogSource.SKC

    @hybrid_property
    def is_cnb_difference(self) -> bool:
        return self.source == CatalogSource.CNB

    def delete(self, session: Session) -> "CatalogRecordFieldDifference":
        if self.approved_by is not None:
            self.deleted = True
            session.commit()
            session.refresh(self)
        else:
            session.delete(self)
            session.commit()
        return self


class CatalogRecordSubfieldDifference(BaseModel):
    __tablename__ = "catalog_record_subfield_differences"

    id = Column(Integer, primary_key=True)

    field_difference_id = Column(
        Integer, ForeignKey("catalog_record_field_differences.id"), index=True
    )

    code = Column(String, index=True)
    value = Column(String)
    different_to = Column(String)
    differs = Column(Boolean)

    field_difference = relationship(
        "CatalogRecordFieldDifference",
        back_populates="subfield_differences",
    )
